import { and, desc, eq, inArray, sql } from "drizzle-orm"
import { mkdir, unlink } from "node:fs/promises"
import { database } from "../db"
import { articlesTable, feedsTable, type Article, type Feed } from "../db/schema"
import { episodePath, podcastDirectory } from "../paths"
import { getCachedVoiceById, getEpisodeGenerationSettings, getServerBaseUrl, listProviderSettings } from "../settings/settings-repository"
import { type TtsProvider } from "../settings/settings-types"
import { streamSpeech, type StreamedAudio } from "../tts/tts"
import { fetchArticlePage, fetchFeed, type ParsedFeedArticle } from "./feed-parsing"
import { replaceImagesWithDescriptionsWithOptions } from "./image-description"
import { fetchSourceArticle } from "./source-article"

type EpisodeView = {
    episodeKey: string
    title: string
    sourceUrl: string
    episodePath: string
    publishedAt: string | null
    durationSeconds: number | null
    isDurationEstimated: boolean
    status: string
    errorMessage: string | null
    voice: string | null
    progressPercent: number
    chunksProcessed: number
    chunksTotal: number
    progressMode: string
    estimatedSecondsRemaining: number
    audioReady: boolean
}

type EpisodeProgress = {
    progressPercent: number
    chunksProcessed: number
    chunksTotal: number
    progressMode: string
    estimatedSecondsRemaining: number
}

type EpisodeGenerationJob = {
    key: string
    feedId: number
    episodeKey: string
    promise: Promise<void>
    resolve: () => void
    reject: (reason?: unknown) => void
}

type StoredEpisodeDurationSource = Pick<Article, 'feedId' | 'episodeKey' | 'title' | 'summary' | 'content' | 'transcript' | 'durationSeconds' | 'status'>

type EpisodeDurationInfo = {
    durationSeconds: number | null
    isDurationEstimated: boolean
}

let episodeProgress = new Map<string, EpisodeProgress>()
let episodeGenerationJobs = new Map<string, EpisodeGenerationJob>()
let queuedEpisodeJobKeys: string[] = []
let activeEpisodeJobKeys = new Set<string>()
let queuedEpisodeCancelledMessage = 'Episode generation was cancelled'

let pollerStarted = false

export async function resetInterruptedEpisodeGeneration() {
    let interrupted = database
        .select()
        .from(articlesTable)
        .where(inArray(articlesTable.status, ['generating', 'queued']))
        .all()

    for (let article of interrupted) {
        let feed = database.select().from(feedsTable).where(eq(feedsTable.id, article.feedId)).get()
        if (feed && article.status == 'generating') {
            let resolvedPath = episodePath(feed.podcastSlug, resolveEpisodeKey(article.episodeKey, article.title, article.sourceUrl))
            try {
                await unlink(resolvedPath)
            }
            catch {
            }
        }

        database
            .update(articlesTable)
            .set({
                status: 'pending',
                errorMessage: null,
                updatedAt: sql`CURRENT_TIMESTAMP`
            })
            .where(and(eq(articlesTable.feedId, article.feedId), eq(articlesTable.episodeKey, article.episodeKey)))
            .run()

        clearEpisodeProgress(article.feedId, article.episodeKey)
    }
}

export function startFeedPolling() {
    if (pollerStarted)
        return

    pollerStarted = true
    void syncAllFeeds(20)
    setInterval(() => {
        void syncAllFeeds(20)
    }, 10 * 60 * 1000)
}

export function resumeQueuedEpisodeGeneration() {
    startAvailableEpisodeGenerationJobs()
}

export async function syncFeedById(feedId: number, limit = 20) {
    let feed = database.select().from(feedsTable).where(eq(feedsTable.id, feedId)).get()
    if (!feed)
        return

    await syncFeed(feed, limit)
}

export async function getFeedByPodcastSlug(slug: string) {
    return database.select().from(feedsTable).where(eq(feedsTable.podcastSlug, slug)).get() || null
}

export async function listFeedEpisodes(feedId: number): Promise<EpisodeView[]> {
    let feed = database.select({ podcastSlug: feedsTable.podcastSlug }).from(feedsTable).where(eq(feedsTable.id, feedId)).get()
    if (!feed)
        return []

    let episodes = database
        .select({
            episodeKey: articlesTable.episodeKey,
            title: articlesTable.title,
            sourceUrl: articlesTable.sourceUrl,
            publishedAt: articlesTable.publishedAt,
            summary: articlesTable.summary,
            content: articlesTable.content,
            transcript: articlesTable.transcript,
            durationSeconds: articlesTable.durationSeconds,
            voice: articlesTable.voice,
            status: articlesTable.status,
            errorMessage: articlesTable.errorMessage
        })
        .from(articlesTable)
        .where(eq(articlesTable.feedId, feedId))
        .orderBy(desc(articlesTable.publishedAt), desc(articlesTable.createdAt))
        .all()

    return await Promise.all(episodes.map(async row => {
        let episodeKey = resolveEpisodeKey(row.episodeKey, row.title, row.sourceUrl)
        let audioReady = await Bun.file(episodePath(feed.podcastSlug, episodeKey)).exists()
        let progress = getEpisodeProgress(feedId, row.episodeKey)
        let duration = await resolveEpisodeDuration(feed, {
            feedId,
            episodeKey: row.episodeKey,
            title: row.title,
            sourceUrl: row.sourceUrl,
            summary: row.summary,
            content: row.content,
            transcript: row.transcript,
            durationSeconds: row.durationSeconds,
            status: row.status
        })

        return {
            episodeKey,
            title: row.title,
            sourceUrl: row.sourceUrl,
            episodePath: `/feed/${feed.podcastSlug}/${episodeKey}`,
            publishedAt: row.publishedAt,
            durationSeconds: duration.durationSeconds,
            isDurationEstimated: duration.isDurationEstimated,
            status: row.status,
            errorMessage: row.errorMessage,
            voice: row.voice,
            progressPercent: progress.progressPercent,
            chunksProcessed: progress.chunksProcessed,
            chunksTotal: progress.chunksTotal,
            progressMode: progress.progressMode,
            estimatedSecondsRemaining: progress.estimatedSecondsRemaining,
            audioReady
        }
    }))
}

export async function buildPodcastFeedXml(feed: Feed) {
    await syncFeed(feed, 20)

    let episodes = database
        .select()
        .from(articlesTable)
        .where(eq(articlesTable.feedId, feed.id))
        .orderBy(desc(articlesTable.publishedAt), desc(articlesTable.createdAt))
        .all()

    let safeTitle = escapeXml(feed.name)
    let safeDescription = escapeXml(feed.description || '')
    let selfLink = buildFeedUrl(feed)
    let siteLink = feed.rssUrl || selfLink
    let channelImage = feed.imageUrl ? `<image><url>${escapeXml(feed.imageUrl)}</url><title>${safeTitle}</title><link>${escapeXml(siteLink)}</link></image>` : ''
    let items = (await Promise.all(episodes.map(episode => buildRssItem(feed, episode)))).join('')

    return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">\n<channel>\n<title>${safeTitle}</title>\n<link>${escapeXml(siteLink)}</link>\n<description>${safeDescription}</description>\n<atom:link href="${escapeXml(selfLink)}" rel="self" type="application/rss+xml"/>\n${channelImage}\n${items}\n</channel>\n</rss>`
}

export async function streamEpisodeAudio(feed: Feed, episodeKey: string): Promise<Response> {
    let article = findArticleByEpisodeKey(feed.id, episodeKey)

    if (!article)
        return new Response('Episode not found', { status: 404 })

    let resolvedPath = episodePath(feed.podcastSlug, resolveEpisodeKey(article.episodeKey, article.title, article.sourceUrl))
    let preferredFile = Bun.file(resolvedPath)
    if (await preferredFile.exists())
        return new Response(preferredFile, { headers: { 'content-type': 'audio/mpeg' } })

    try {
        await scheduleEpisodeGeneration(feed, article)
    } catch (error) {
        let message = error instanceof Error ? error.message : 'Audio generation failed'
        if (!isCancelledEpisodeGenerationError(error))
            markArticleFailed(feed.id, article.episodeKey, message)
        return new Response(message, { status: 400 })
    }

    preferredFile = Bun.file(resolvedPath)
    if (await preferredFile.exists()) {
        return new Response(preferredFile, {
            headers: {
                'content-type': 'audio/mpeg',
                'cache-control': 'no-store'
            }
        })
    }

    return new Response('Generated audio was not found', { status: 500 })
}


export async function setEpisodeVoiceOverride(feedId: number, episodeKey: string, voiceId: string | null) {
    let feed = database.select().from(feedsTable).where(eq(feedsTable.id, feedId)).get()
    if (!feed)
        return { updated: false, reason: 'feed_not_found' as const }

    let article = findArticleByEpisodeKey(feed.id, episodeKey)
    if (!article)
        return { updated: false, reason: 'episode_not_found' as const }

    if (voiceId && !getCachedVoiceById(voiceId))
        return { updated: false, reason: 'voice_not_found' as const }

    cancelQueuedEpisodeGeneration(feed.id, article.episodeKey)

    database
        .update(articlesTable)
        .set({
            voice: voiceId,
            status: 'pending',
            errorMessage: null,
            audioUrl: null,
            updatedAt: sql`CURRENT_TIMESTAMP`
        })
        .where(and(eq(articlesTable.feedId, feed.id), eq(articlesTable.episodeKey, article.episodeKey)))
        .run()

    clearEpisodeProgress(feed.id, article.episodeKey)

    let resolvedPath = episodePath(feed.podcastSlug, resolveEpisodeKey(article.episodeKey, article.title, article.sourceUrl))

    try {
        await unlink(resolvedPath)
    }
    catch {
    }

    return { updated: true as const }
}

export async function getEpisodeTranscript(feedId: number, episodeKey: string, forceRegenerateImageDescriptions = false) {
    let feed = database.select().from(feedsTable).where(eq(feedsTable.id, feedId)).get()
    if (!feed)
        return { ok: false as const, reason: 'feed_not_found' as const }

    let article = findArticleByEpisodeKey(feed.id, episodeKey)
    if (!article)
        return { ok: false as const, reason: 'episode_not_found' as const }

    let transcript = await getStoredEpisodeTranscript(feed, article, {
        forceRegenerateTranscript: forceRegenerateImageDescriptions,
        refreshFeedArticle: false
    })

    return {
        ok: true as const,
        transcript,
        title: article.title,
        sourceUrl: article.sourceUrl
    }
}

export async function regenerateEpisodeTranscript(feedId: number, episodeKey: string) {
    let feed = database.select().from(feedsTable).where(eq(feedsTable.id, feedId)).get()
    if (!feed)
        return { ok: false as const, reason: 'feed_not_found' as const }

    let article = findArticleByEpisodeKey(feed.id, episodeKey)
    if (!article)
        return { ok: false as const, reason: 'episode_not_found' as const }

    let refreshedArticle = feed.contentSource == 'feed_article'
        ? await refreshStoredArticleFromFeed(feed, article)
        : article

    let transcript = await getStoredEpisodeTranscript(feed, refreshedArticle, {
        forceRegenerateTranscript: true,
        refreshFeedArticle: false
    })

    return {
        ok: true as const,
        transcript,
        title: refreshedArticle.title,
        sourceUrl: refreshedArticle.sourceUrl
    }
}

export async function updateEpisodeTranscript(feedId: number, episodeKey: string, transcript: string) {
    let feed = database.select().from(feedsTable).where(eq(feedsTable.id, feedId)).get()
    if (!feed)
        return { ok: false as const, reason: 'feed_not_found' as const }

    let article = findArticleByEpisodeKey(feed.id, episodeKey)
    if (!article)
        return { ok: false as const, reason: 'episode_not_found' as const }

    storeEpisodeTranscript(article, transcript)

    return {
        ok: true as const,
        transcript,
        title: article.title,
        sourceUrl: article.sourceUrl
    }
}

async function syncAllFeeds(limit: number) {
    let feeds = database.select().from(feedsTable).all()
    for (let feed of feeds)
        await syncFeed(feed, limit)
}

export async function insertFeedArticles(feedId: number, generationMode: string, contentSource: string, articles: ParsedFeedArticle[], options?: { limit?: number; articleSource?: string }) {
    let items = articles.slice(0, options?.limit ?? 20)
    let articleSource = options?.articleSource ?? 'feed'
    let storedArticles: Article[] = []

    for (let item of items) {
        let prepared = await prepareParsedFeedArticleForStorage(item, {
            forceRegenerateImageDescriptions: false
        })
        let episodeKey = buildEpisodeRouteKey(prepared.title, prepared.sourceUrl)
        let durationSeconds = estimateStoredEpisodeDurationSeconds({
            title: prepared.title,
            summary: prepared.summary,
            content: prepared.content,
            transcript: null
        })

        database
            .insert(articlesTable)
            .values({
                feedId,
                episodeKey,
                articleSource,
                guid: prepared.guid,
                sourceUrl: prepared.sourceUrl,
                title: prepared.title,
                summary: prepared.summary,
                content: prepared.content,
                durationSeconds,
                voice: null,
                status: 'pending',
                generationMode,
                contentSource,
                publishedAt: prepared.publishedAt,
                updatedAt: sql`CURRENT_TIMESTAMP`
            })
            .onConflictDoUpdate({
                target: [articlesTable.feedId, articlesTable.sourceUrl],
                set: {
                    episodeKey,
                    articleSource,
                    guid: prepared.guid,
                    title: prepared.title,
                    summary: prepared.summary,
                    content: prepared.content,
                    durationSeconds,
                    generationMode,
                    contentSource,
                    publishedAt: prepared.publishedAt,
                    updatedAt: sql`CURRENT_TIMESTAMP`
                }
            })
            .run()

        let stored = findArticleBySourceUrl(feedId, prepared.sourceUrl)
        if (stored)
            storedArticles.push(stored)
    }

    return storedArticles
}

async function syncFeed(feed: Feed, limit: number) {
    if (feed.contentSource == 'custom' || !feed.rssUrl.trim())
        return

    let parsed = await fetchFeed(feed.rssUrl)
    if (!parsed)
        return

    await insertFeedArticles(feed.id, feed.generationMode, feed.contentSource, parsed.articles, { limit })

    if (feed.generationMode == 'every_episode') {
        let pending = database
            .select()
            .from(articlesTable)
            .where(and(
                eq(articlesTable.feedId, feed.id),
                inArray(articlesTable.status, ['pending', 'failed', 'queued'])
            ))
            .orderBy(desc(articlesTable.publishedAt), desc(articlesTable.createdAt))
            .all()

        for (let article of pending)
            void generateAndStoreAudio(feed, article)
    }
}

export async function addManualArticle(feedId: number, sourceUrl: string) {
    let feed = database.select().from(feedsTable).where(eq(feedsTable.id, feedId)).get()
    if (!feed)
        return { ok: false as const, reason: 'feed_not_found' as const }

    if (feed.contentSource != 'custom')
        return { ok: false as const, reason: 'feed_not_custom' as const }

    let normalizedUrl = new URL(sourceUrl).toString()
    let existing = findArticleBySourceUrl(feed.id, normalizedUrl)
    if (existing)
        return { ok: false as const, reason: 'duplicate_article' as const }

    let parsed = await fetchArticlePage(normalizedUrl)
    if (!parsed)
        return { ok: false as const, reason: 'article_fetch_failed' as const }

    let inserted = await insertFeedArticles(feed.id, feed.generationMode, feed.contentSource, [parsed], {
        limit: 1,
        articleSource: 'manual'
    })
    let article = inserted[0]
    if (!article)
        return { ok: false as const, reason: 'article_insert_failed' as const }

    if (feed.generationMode == 'every_episode')
        void generateAndStoreAudio(feed, article)

    return {
        ok: true as const,
        episodeKey: resolveEpisodeKey(article.episodeKey, article.title, article.sourceUrl),
        title: article.title,
        sourceUrl: article.sourceUrl
    }
}

export async function removeManualArticle(feedId: number, episodeKey: string) {
    let feed = database.select().from(feedsTable).where(eq(feedsTable.id, feedId)).get()
    if (!feed)
        return { ok: false as const, reason: 'feed_not_found' as const }

    if (feed.contentSource != 'custom')
        return { ok: false as const, reason: 'feed_not_custom' as const }

    let article = findArticleByEpisodeKey(feed.id, episodeKey)
    if (!article)
        return { ok: false as const, reason: 'article_not_found' as const }

    if (article.status == 'generating')
        return { ok: false as const, reason: 'article_generating' as const }

    cancelQueuedEpisodeGeneration(feed.id, article.episodeKey)

    database
        .delete(articlesTable)
        .where(and(eq(articlesTable.feedId, feed.id), eq(articlesTable.episodeKey, article.episodeKey)))
        .run()

    clearEpisodeProgress(feed.id, article.episodeKey)

    let resolvedPath = episodePath(feed.podcastSlug, resolveEpisodeKey(article.episodeKey, article.title, article.sourceUrl))

    try {
        await unlink(resolvedPath)
    }
    catch {
    }

    return { ok: true as const }
}

async function generateAndStoreAudio(feed: Feed, article: Article) {
    try {
        await scheduleEpisodeGeneration(feed, article)
    } catch (error) {
        console.error("Failed to generate and store audio for feed", feed.id, "episode", article.episodeKey, error)
    }
}

async function scheduleEpisodeGeneration(feed: Feed, article: Article) {
    let resolvedPath = episodePath(feed.podcastSlug, resolveEpisodeKey(article.episodeKey, article.title, article.sourceUrl))
    let file = Bun.file(resolvedPath)
    if (await file.exists()) {
        markArticleReady(feed.id, article.episodeKey, buildAudioUrl(feed, article))
        return
    }

    let jobKey = buildEpisodeProgressKey(feed.id, article.episodeKey)
    let existingJob = episodeGenerationJobs.get(jobKey)
    if (existingJob)
        return await existingJob.promise

    let resolveJob!: () => void
    let rejectJob!: (reason?: unknown) => void
    let jobPromise = new Promise<void>((resolve, reject) => {
        resolveJob = resolve
        rejectJob = reject
    })

    let job: EpisodeGenerationJob = {
        key: jobKey,
        feedId: feed.id,
        episodeKey: article.episodeKey,
        promise: jobPromise,
        resolve: resolveJob,
        reject: rejectJob
    }

    episodeGenerationJobs.set(jobKey, job)

    if (hasEpisodeGenerationCapacity()) {
        startEpisodeGenerationJob(job)
    } else {
        queuedEpisodeJobKeys.push(job.key)
        markArticleQueued(feed.id, article.episodeKey)
    }

    return await job.promise
}

function startEpisodeGenerationJob(job: EpisodeGenerationJob) {
    activeEpisodeJobKeys.add(job.key)
    queuedEpisodeJobKeys = queuedEpisodeJobKeys.filter(key => key != job.key)
    void runEpisodeGenerationJob(job)
}

async function runEpisodeGenerationJob(job: EpisodeGenerationJob) {
    try {
        let feed = database.select().from(feedsTable).where(eq(feedsTable.id, job.feedId)).get()
        if (!feed)
            throw new Error('Feed not found')

        let article = database
            .select()
            .from(articlesTable)
            .where(and(eq(articlesTable.feedId, job.feedId), eq(articlesTable.episodeKey, job.episodeKey)))
            .get()

        if (!article)
            throw new Error('Episode not found')

        let resolvedPath = episodePath(feed.podcastSlug, resolveEpisodeKey(article.episodeKey, article.title, article.sourceUrl))
        let file = Bun.file(resolvedPath)
        if (await file.exists()) {
            markArticleReady(feed.id, article.episodeKey, buildAudioUrl(feed, article))
            job.resolve()
            return
        }

        markArticleGenerating(feed.id, article.episodeKey, feed)

        let generated = await createAudioStream(feed, article, progress => {
            updateArticleChunkProgress(feed.id, article.episodeKey, progress.chunksProcessed, progress.chunksTotal)
        })

        if (generated.provider == 'inworld')
            updateArticleChunkProgress(feed.id, article.episodeKey, 0, estimateChunkCount(generated.textLength))

        let stopEstimatedProgress = startEstimatedProgressUpdates(
            feed.id,
            article.episodeKey,
            generated.provider,
            generated.textLength
        )

        try {
            await persistAudioStream(generated.audio.stream, resolvedPath, article, feed)
        } finally {
            stopEstimatedProgress()
        }

        job.resolve()
    } catch (error) {
        let message = error instanceof Error ? error.message : 'Audio generation failed'
        markArticleFailed(job.feedId, job.episodeKey, message)
        job.reject(error)
    } finally {
        finishEpisodeGenerationJob(job.key)
    }
}

function finishEpisodeGenerationJob(jobKey: string) {
    episodeGenerationJobs.delete(jobKey)
    activeEpisodeJobKeys.delete(jobKey)

    queuedEpisodeJobKeys = queuedEpisodeJobKeys.filter(key => key != jobKey)

    startAvailableEpisodeGenerationJobs()
}

function startAvailableEpisodeGenerationJobs() {
    while (hasEpisodeGenerationCapacity() && queuedEpisodeJobKeys.length > 0) {
        let nextJobKey = queuedEpisodeJobKeys.shift()
        if (!nextJobKey)
            return

        let nextJob = episodeGenerationJobs.get(nextJobKey)
        if (nextJob)
            startEpisodeGenerationJob(nextJob)
    }
}

function cancelQueuedEpisodeGeneration(feedId: number, episodeKey: string) {
    let jobKey = buildEpisodeProgressKey(feedId, episodeKey)
    if (activeEpisodeJobKeys.has(jobKey))
        return

    let queuedJob = episodeGenerationJobs.get(jobKey)
    if (!queuedJob)
        return

    episodeGenerationJobs.delete(jobKey)
    queuedEpisodeJobKeys = queuedEpisodeJobKeys.filter(key => key != jobKey)
    queuedJob.reject(new Error(queuedEpisodeCancelledMessage))
}

function isCancelledEpisodeGenerationError(error: unknown) {
    return error instanceof Error && error.message == queuedEpisodeCancelledMessage
}

function hasEpisodeGenerationCapacity() {
    return activeEpisodeJobKeys.size < getEpisodeGenerationSettings().concurrentGenerations
}

type GeneratedAudio = {
    audio: StreamedAudio
    provider: TtsProvider
    textLength: number
}

async function createAudioStream(feed: Feed, article: Article, onChunkProgress?: (progress: { chunksProcessed: number; chunksTotal: number }) => void): Promise<GeneratedAudio> {
    let text = await getStoredEpisodeTranscript(feed, article, {
        forceRegenerateTranscript: false,
        refreshFeedArticle: false
    })
    if (!text.trim())
        throw new Error('Article text is empty')

    let selectedVoiceId = article.voice || feed.voice
    let voice = getCachedVoiceById(selectedVoiceId)
    if (!voice)
        throw new Error('Selected voice was not found in voice cache')

    if (!isTtsProvider(voice.provider))
        throw new Error('Selected voice provider is invalid')

    let settings = listProviderSettings()
    let audio = await streamSpeech(voice.provider, voice.providerVoiceId, text, settings, {
        onChunkProgress
    })

    return {
        audio,
        provider: voice.provider,
        textLength: text.length
    }
}

function isTtsProvider(value: string): value is TtsProvider {
    return value == 'inworld' || value == 'openai' || value == 'elevenlabs' || value == 'lemonfox'
}

async function getStoredEpisodeTranscript(
    feed: Feed,
    article: Article,
    options: {
        forceRegenerateTranscript: boolean
        refreshFeedArticle: boolean
    }
) {
    let resolvedArticle = article

    if (options.refreshFeedArticle && feed.contentSource == 'feed_article')
        resolvedArticle = await refreshStoredArticleFromFeed(feed, article)

    if (!options.forceRegenerateTranscript && resolvedArticle.transcript != null)
        return resolvedArticle.transcript

    let transcript = await resolveArticleText(feed, resolvedArticle, {
        forceRegenerateImageDescriptions: options.forceRegenerateTranscript
    })

    storeEpisodeTranscript(resolvedArticle, transcript)
    return transcript
}

function storeEpisodeTranscript(article: Article, transcript: string) {
    let durationSeconds = article.status == 'ready' && article.durationSeconds != null
        ? article.durationSeconds
        : estimateEpisodeDurationSeconds(transcript)

    database
        .update(articlesTable)
        .set({
            transcript,
            durationSeconds,
            updatedAt: sql`CURRENT_TIMESTAMP`
        })
        .where(and(eq(articlesTable.feedId, article.feedId), eq(articlesTable.episodeKey, article.episodeKey)))
        .run()
}

async function persistAudioStream(stream: ReadableStream<Uint8Array>, outputPath: string, article: Article, feed: Feed) {
    try {
        await mkdir(podcastDirectory(feed.podcastSlug), { recursive: true })
        await writeStreamToFile(stream, outputPath)
        markArticleReady(feed.id, article.episodeKey, buildAudioUrl(feed, article))
    }
    catch {
        markArticleFailed(feed.id, article.episodeKey, 'Failed to store generated audio')
    }
}

async function writeStreamToFile(stream: ReadableStream<Uint8Array>, outputPath: string) {
    let writer = Bun.file(outputPath).writer()
    let reader = stream.getReader()
    try {
        while (true) {
            let read = await reader.read()
            if (read.done)
                break

            if (read.value)
                await writer.write(read.value)
        }
        await writer.end()
    }
    finally {
        reader.releaseLock()
    }
}

function markArticleGenerating(feedId: number, episodeKey: string, feed: Feed) {
    database
        .update(articlesTable)
        .set({
            status: 'generating',
            errorMessage: null,
            generationMode: feed.generationMode,
            contentSource: feed.contentSource,
            lastGenerationAttemptAt: sql`CURRENT_TIMESTAMP`,
            updatedAt: sql`CURRENT_TIMESTAMP`
        })
        .where(and(eq(articlesTable.feedId, feedId), eq(articlesTable.episodeKey, episodeKey)))
        .run()

    setEpisodeProgress(feedId, episodeKey, {
        progressPercent: 0,
        chunksProcessed: 0,
        chunksTotal: 0,
        progressMode: 'none',
        estimatedSecondsRemaining: 0
    })
}

function markArticleQueued(feedId: number, episodeKey: string) {
    database
        .update(articlesTable)
        .set({
            status: 'queued',
            errorMessage: null,
            updatedAt: sql`CURRENT_TIMESTAMP`
        })
        .where(and(eq(articlesTable.feedId, feedId), eq(articlesTable.episodeKey, episodeKey)))
        .run()

    clearEpisodeProgress(feedId, episodeKey)
}

function markArticleReady(feedId: number, episodeKey: string, audioUrl: string) {
    database
        .update(articlesTable)
        .set({
            status: 'ready',
            errorMessage: null,
            audioUrl,
            updatedAt: sql`CURRENT_TIMESTAMP`
        })
        .where(and(eq(articlesTable.feedId, feedId), eq(articlesTable.episodeKey, episodeKey)))
        .run()

    clearEpisodeProgress(feedId, episodeKey)
}

function markArticleFailed(feedId: number, episodeKey: string, reason: string) {
    database
        .update(articlesTable)
        .set({
            status: 'failed',
            errorMessage: reason,
            updatedAt: sql`CURRENT_TIMESTAMP`
        })
        .where(and(eq(articlesTable.feedId, feedId), eq(articlesTable.episodeKey, episodeKey)))
        .run()

    clearEpisodeProgress(feedId, episodeKey)
}

function updateArticleChunkProgress(feedId: number, episodeKey: string, chunksProcessed: number, chunksTotal: number) {
    if (chunksTotal <= 0)
        return

    let safeProcessed = Math.max(0, chunksProcessed)
    let clampedProcessed = Math.min(safeProcessed, chunksTotal)
    let rawPercent = Math.floor((clampedProcessed / chunksTotal) * 100)
    let progressPercent = clampedProcessed >= chunksTotal ? 99 : Math.max(1, rawPercent)

    setEpisodeProgress(feedId, episodeKey, {
        progressPercent,
        chunksProcessed: clampedProcessed,
        chunksTotal,
        progressMode: 'chunk',
        estimatedSecondsRemaining: 0
    })
}

function startEstimatedProgressUpdates(feedId: number, episodeKey: string, provider: TtsProvider, textLength: number) {
    if (provider == 'inworld')
        return () => { }

    let estimatedDurationSeconds = estimateProviderDurationSeconds(provider, textLength)
    let startedAt = Date.now()

    updateArticleEstimatedProgress(feedId, episodeKey, startedAt, estimatedDurationSeconds)

    let timer = setInterval(() => {
        updateArticleEstimatedProgress(feedId, episodeKey, startedAt, estimatedDurationSeconds)
    }, 1000)

    return () => {
        clearInterval(timer)
    }
}

function updateArticleEstimatedProgress(feedId: number, episodeKey: string, startedAtMs: number, estimatedDurationSeconds: number) {
    let elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000))
    let ratio = estimatedDurationSeconds > 0 ? elapsedSeconds / estimatedDurationSeconds : 0
    let progressPercent = Math.min(95, Math.max(1, Math.floor(ratio * 100)))
    let estimatedSecondsRemaining = Math.max(0, Math.ceil(estimatedDurationSeconds - elapsedSeconds))

    setEpisodeProgress(feedId, episodeKey, {
        progressPercent,
        progressMode: 'estimated',
        estimatedSecondsRemaining,
        chunksProcessed: 0,
        chunksTotal: 0
    })
}

function estimateProviderDurationSeconds(provider: TtsProvider, textLength: number) {
    let charsPerSecond = provider == 'openai' || provider == 'lemonfox'
        ? 34
        : provider == 'elevenlabs'
            ? 28
            : 22

    let estimated = Math.ceil(textLength / charsPerSecond)
    return Math.max(8, estimated)
}

function estimateChunkCount(textLength: number) {
    return Math.max(1, Math.ceil(textLength / 2000))
}

function buildEpisodeProgressKey(feedId: number, episodeKey: string) {
    return `${feedId}:${episodeKey}`
}

function getEpisodeProgress(feedId: number, episodeKey: string): EpisodeProgress {
    return episodeProgress.get(buildEpisodeProgressKey(feedId, episodeKey)) || {
        progressPercent: 0,
        chunksProcessed: 0,
        chunksTotal: 0,
        progressMode: 'none',
        estimatedSecondsRemaining: 0
    }
}

function setEpisodeProgress(feedId: number, episodeKey: string, progress: EpisodeProgress) {
    episodeProgress.set(buildEpisodeProgressKey(feedId, episodeKey), progress)
}

function clearEpisodeProgress(feedId: number, episodeKey: string) {
    episodeProgress.delete(buildEpisodeProgressKey(feedId, episodeKey))
}

async function resolveArticleText(feed: Feed, article: Article, options: { forceRegenerateImageDescriptions: boolean }) {
    if (feed.contentSource == 'source_page')
        return await readSourcePage(article.sourceUrl, article, options)

    let preparedContent = normalizeStoredFeedText(article.content || article.summary || '')

    return [decodeTranscriptText(article.title), preparedContent].join('\n\n').trim()
}

async function readSourcePage(sourceUrl: string, article: Article, options: { forceRegenerateImageDescriptions: boolean }) {
    let sourceArticle = await fetchSourceArticle(sourceUrl, options)
    if (!sourceArticle?.text)
        return fallbackArticleText(article)

    return [decodeTranscriptText(article.title), sourceArticle.text].join('\n\n').trim()
}

function fallbackArticleText(article: Article) {
    return decodeTranscriptText([article.title, article.content || article.summary || ''].join('\n\n').trim())
}

async function prepareNarrationText(value: string, sourceUrl: string, options: { forceRegenerateImageDescriptions: boolean }) {
    let withImageDescriptions = await replaceImagesWithDescriptionsWithOptions(value, sourceUrl, {
        forceRegenerate: options.forceRegenerateImageDescriptions
    })

    let text = withImageDescriptions
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<\/?(p|h1|h2|h3|h4|h5|h6|li|blockquote|section|article|main|div|br)[^>]*>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .trim()

    return normalizeTranscriptText(decodeTranscriptText(text))
}

function normalizeStoredFeedText(value: string) {
    return normalizeTranscriptText(decodeTranscriptText(value))
}

function resolveStoredEpisodeDurationEstimate(article: StoredEpisodeDurationSource) {
    if (article.status == 'ready' && article.durationSeconds != null)
        return article.durationSeconds

    let durationSeconds = estimateStoredEpisodeDurationSeconds(article)
    if (durationSeconds == null)
        return null

    if (article.durationSeconds != durationSeconds) {
        database
            .update(articlesTable)
            .set({
                durationSeconds,
                updatedAt: sql`CURRENT_TIMESTAMP`
            })
            .where(and(eq(articlesTable.feedId, article.feedId), eq(articlesTable.episodeKey, article.episodeKey)))
            .run()
    }

    return durationSeconds
}

async function resolveEpisodeDuration(feed: Pick<Feed, 'podcastSlug'>, article: StoredEpisodeDurationSource & Pick<Article, 'sourceUrl'>): Promise<EpisodeDurationInfo> {
    if (article.status == 'ready' && article.durationSeconds != null) {
        return {
            durationSeconds: article.durationSeconds,
            isDurationEstimated: false
        }
    }

    let actualDurationSeconds = await getStoredAudioDurationSeconds(feed, article)
    if (actualDurationSeconds != null) {
        return {
            durationSeconds: actualDurationSeconds,
            isDurationEstimated: false
        }
    }

    return {
        durationSeconds: resolveStoredEpisodeDurationEstimate(article),
        isDurationEstimated: true
    }
}

async function getStoredAudioDurationSeconds(feed: Pick<Feed, 'podcastSlug'>, article: Pick<Article, 'feedId' | 'episodeKey' | 'title' | 'sourceUrl'>) {
    let file = Bun.file(episodePath(feed.podcastSlug, resolveEpisodeKey(article.episodeKey, article.title, article.sourceUrl)))
    if (!await file.exists())
        return null

    let bytes = new Uint8Array(await file.arrayBuffer())
    let durationSeconds = parseMp3DurationSeconds(bytes)
    if (durationSeconds == null)
        return null

    database
        .update(articlesTable)
        .set({
            durationSeconds,
            updatedAt: sql`CURRENT_TIMESTAMP`
        })
        .where(and(eq(articlesTable.feedId, article.feedId), eq(articlesTable.episodeKey, article.episodeKey)))
        .run()

    return durationSeconds
}

function estimateStoredEpisodeDurationSeconds(article: Pick<Article, 'title' | 'summary' | 'content' | 'transcript'>) {
    let narrationText = article.transcript ?? buildStoredNarrationFallback(article)
    return estimateEpisodeDurationSeconds(narrationText)
}

function buildStoredNarrationFallback(article: Pick<Article, 'title' | 'summary' | 'content'>) {
    let preparedContent = normalizeStoredFeedText(article.content || article.summary || '')
    return [decodeTranscriptText(article.title), preparedContent].join('\n\n').trim()
}

function estimateEpisodeDurationSeconds(value: string) {
    let text = normalizeTranscriptText(decodeTranscriptText(value))
    if (!text)
        return null

    let wordCount = text.split(/\s+/).filter(Boolean).length
    if (wordCount <= 0)
        return null

    return Math.max(10, Math.ceil((wordCount / 150) * 60))
}

function parseMp3DurationSeconds(bytes: Uint8Array) {
    let offset = skipId3Tag(bytes)
    let totalSamples = 0
    let sampleRate = 0
    let parsedFrames = 0

    while (offset + 4 <= bytes.length) {
        let header = readMp3FrameHeader(bytes, offset)
        if (!header) {
            if (parsedFrames > 0)
                break

            offset += 1
            continue
        }

        totalSamples += header.samplesPerFrame
        sampleRate = header.sampleRate
        parsedFrames += 1
        offset += header.frameLength
    }

    if (parsedFrames == 0 || sampleRate <= 0)
        return null

    return Math.max(1, Math.round(totalSamples / sampleRate))
}

function skipId3Tag(bytes: Uint8Array) {
    if (bytes.length < 10 || bytes[0] != 0x49 || bytes[1] != 0x44 || bytes[2] != 0x33)
        return 0

    let flags = bytes[5] ?? 0
    let size0 = bytes[6] ?? 0
    let size1 = bytes[7] ?? 0
    let size2 = bytes[8] ?? 0
    let size3 = bytes[9] ?? 0
    let tagSize = ((size0 & 0x7f) << 21)
        | ((size1 & 0x7f) << 14)
        | ((size2 & 0x7f) << 7)
        | (size3 & 0x7f)

    return 10 + tagSize + ((flags & 0x10) ? 10 : 0)
}

function readMp3FrameHeader(bytes: Uint8Array, offset: number) {
    if (offset + 4 > bytes.length)
        return null

    let byte0 = bytes[offset] ?? 0
    let byte1 = bytes[offset + 1] ?? 0
    let byte2 = bytes[offset + 2] ?? 0
    let byte3 = bytes[offset + 3] ?? 0
    let header = (byte0 << 24)
        | (byte1 << 16)
        | (byte2 << 8)
        | byte3

    if ((header & 0xffe00000) != 0xffe00000)
        return null

    let versionBits = (header >> 19) & 0x3
    let layerBits = (header >> 17) & 0x3
    let bitrateIndex = (header >> 12) & 0xf
    let sampleRateIndex = (header >> 10) & 0x3
    let padding = (header >> 9) & 0x1

    if (versionBits == 1 || layerBits == 0 || bitrateIndex == 0 || bitrateIndex == 0xf || sampleRateIndex == 0x3)
        return null

    let version: 'mpeg1' | 'mpeg2' | 'mpeg2.5' = versionBits == 3 ? 'mpeg1' : versionBits == 2 ? 'mpeg2' : 'mpeg2.5'
    let layer = layerBits == 3 ? 1 : layerBits == 2 ? 2 : 3
    let bitrate = getMp3Bitrate(version, layer, bitrateIndex)
    let sampleRate = getMp3SampleRate(version, sampleRateIndex)
    if (!bitrate || !sampleRate)
        return null

    let samplesPerFrame = getMp3SamplesPerFrame(version, layer)
    let frameLength = getMp3FrameLength(version, layer, bitrate, sampleRate, padding)
    if (!samplesPerFrame || frameLength <= 0 || offset + frameLength > bytes.length)
        return null

    return {
        sampleRate,
        samplesPerFrame,
        frameLength
    }
}

function getMp3Bitrate(version: 'mpeg1' | 'mpeg2' | 'mpeg2.5', layer: number, bitrateIndex: number) {
    let mpeg1Layer1 = [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448]
    let mpeg1Layer2 = [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384]
    let mpeg1Layer3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
    let mpeg2Layer1 = [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256]
    let mpeg2Layer23 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]

    let kbps = version == 'mpeg1'
        ? layer == 1 ? mpeg1Layer1[bitrateIndex] : layer == 2 ? mpeg1Layer2[bitrateIndex] : mpeg1Layer3[bitrateIndex]
        : layer == 1 ? mpeg2Layer1[bitrateIndex] : mpeg2Layer23[bitrateIndex]

    return kbps ? kbps * 1000 : 0
}

function getMp3SampleRate(version: 'mpeg1' | 'mpeg2' | 'mpeg2.5', sampleRateIndex: number) {
    let table = version == 'mpeg1'
        ? [44100, 48000, 32000]
        : version == 'mpeg2'
            ? [22050, 24000, 16000]
            : [11025, 12000, 8000]

    return table[sampleRateIndex] || 0
}

function getMp3SamplesPerFrame(version: 'mpeg1' | 'mpeg2' | 'mpeg2.5', layer: number) {
    if (layer == 1)
        return 384

    if (layer == 2)
        return 1152

    return version == 'mpeg1' ? 1152 : 576
}

function getMp3FrameLength(version: 'mpeg1' | 'mpeg2' | 'mpeg2.5', layer: number, bitrate: number, sampleRate: number, padding: number) {
    if (layer == 1)
        return Math.floor(((12 * bitrate) / sampleRate + padding) * 4)

    if (layer == 3 && version != 'mpeg1')
        return Math.floor((72 * bitrate) / sampleRate + padding)

    return Math.floor((144 * bitrate) / sampleRate + padding)
}

function normalizeTranscriptText(value: string) {
    return value
        .replace(/\r\n?/g, '\n')
        .replace(/[ \t\f\v]+\n/g, '\n')
        .replace(/\n[ \t\f\v]+/g, '\n')
        .replace(/[ \t\f\v]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}

function decodeTranscriptText(value: string) {
    let decoded = value

    for (let pass = 0; pass < 3; pass++) {
        let next = decoded
            .replace(/&nbsp;/gi, ' ')
            .replace(/&quot;/gi, '"')
            .replace(/&apos;/gi, "'")
            .replace(/&amp;/gi, '&')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/&#(\d+);/g, (_, codePointText) => decodeCodePoint(codePointText, 10))
            .replace(/&#x([\da-f]+);/gi, (_, codePointText) => decodeCodePoint(codePointText, 16))

        if (next == decoded)
            break

        decoded = next
    }

    return decoded
}

function decodeCodePoint(codePointText: string, radix: number) {
    let codePoint = parseInt(codePointText, radix)
    if (!Number.isFinite(codePoint) || codePoint <= 0)
        return ''

    try {
        return String.fromCodePoint(codePoint)
    }
    catch {
        return ''
    }
}

async function refreshStoredArticleFromFeed(feed: Feed, article: Article) {
    let parsed = await fetchFeed(feed.rssUrl)
    let refreshed = parsed?.articles.find(item => articleMatchesParsedArticle(article, item))
    if (!refreshed)
        return article

    let prepared = await prepareParsedFeedArticleForStorage(refreshed, {
        forceRegenerateImageDescriptions: true
    })
    let durationSeconds = article.transcript != null
        ? article.durationSeconds ?? estimateEpisodeDurationSeconds(article.transcript)
        : estimateStoredEpisodeDurationSeconds({
            title: prepared.title,
            summary: prepared.summary,
            content: prepared.content,
            transcript: null
        })
    if (article.status != 'ready')
        durationSeconds = estimateStoredEpisodeDurationSeconds({
            title: prepared.title,
            summary: prepared.summary,
            content: prepared.content,
            transcript: article.transcript
        })

    let nextArticle: Article = {
        ...article,
        title: prepared.title,
        summary: prepared.summary,
        content: prepared.content,
        durationSeconds,
        guid: prepared.guid,
        publishedAt: prepared.publishedAt,
        updatedAt: new Date().toISOString()
    }

    database
        .update(articlesTable)
        .set({
            title: prepared.title,
            summary: prepared.summary,
            content: prepared.content,
            durationSeconds,
            guid: prepared.guid,
            publishedAt: prepared.publishedAt,
            updatedAt: sql`CURRENT_TIMESTAMP`
        })
        .where(and(eq(articlesTable.feedId, article.feedId), eq(articlesTable.sourceUrl, article.sourceUrl)))
        .run()

    return nextArticle
}

function articleMatchesParsedArticle(article: Article, parsedArticle: ParsedFeedArticle) {
    if (parsedArticle.sourceUrl == article.sourceUrl)
        return true

    if (article.guid && parsedArticle.guid)
        return parsedArticle.guid == article.guid

    return false
}

async function prepareParsedFeedArticleForStorage(article: ParsedFeedArticle, options: { forceRegenerateImageDescriptions: boolean }) {
    let title = normalizeStoredFeedText(article.title)
    let summary = normalizeStoredFeedText(article.summary || '') || null
    let content = await prepareNarrationText(article.content || '', article.sourceUrl, options)

    return {
        ...article,
        title: title || article.title,
        summary,
        content: content || null,
    }
}

function ensureStoredEpisodeKey(article: Article, episodeKey: string) {
    if (article.episodeKey != episodeKey) {
        database
            .update(articlesTable)
            .set({
                episodeKey,
                updatedAt: sql`CURRENT_TIMESTAMP`
            })
            .where(and(eq(articlesTable.feedId, article.feedId), eq(articlesTable.sourceUrl, article.sourceUrl)))
            .run()

        return {
            ...article,
            episodeKey
        }
    }

    return article
}

async function buildRssItem(feed: Feed, article: Article) {
    let enclosureUrl = buildAudioUrl(feed, article)
    let enclosureLength = await getEnclosureLength(feed, article)
    let guid = article.sourceUrl || article.guid || enclosureUrl
    let published = article.publishedAt ? `<pubDate>${new Date(article.publishedAt).toUTCString()}</pubDate>` : ''
    let duration = await resolveEpisodeDuration(feed, article)
    let durationTag = duration.durationSeconds != null ? `<itunes:duration>${formatPodcastDuration(duration.durationSeconds)}</itunes:duration>` : ''
    let description = escapeXml(buildEpisodeDescription(article))
    let title = escapeXml(article.title)

    return `<item><title>${title}</title><guid isPermaLink="false">${escapeXml(guid)}</guid><link>${escapeXml(article.sourceUrl)}</link><description>${description}</description><enclosure url="${escapeXml(enclosureUrl)}" length="${enclosureLength}" type="audio/mpeg"/>${durationTag}${published}</item>`
}

function formatPodcastDuration(value: number) {
    let totalSeconds = Math.max(0, Math.floor(value))
    let hours = Math.floor(totalSeconds / 3600)
    let minutes = Math.floor((totalSeconds % 3600) / 60)
    let seconds = totalSeconds % 60

    if (hours > 0)
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

    return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function buildEpisodeDescription(article: Article) {
    let sourceLine = `Original article: ${article.sourceUrl}`
    let summary = normalizeDescriptionPreview(article.summary || '')
    let excerpt = isReasonableDescriptionSize(summary)
        ? summary
        : buildArticleExcerpt(article)

    if (excerpt)
        return `${sourceLine}\n\n${excerpt}`

    return sourceLine
}

function buildArticleExcerpt(article: Article) {
    let paragraphs = extractDescriptionParagraphs(article.content || article.transcript || article.summary || '')
    if (paragraphs.length == 0)
        return truncateDescriptionPreview(normalizeDescriptionPreview(article.summary || ''), 900)

    let excerpt = paragraphs[0] || ''
    let nextParagraph = paragraphs[1]
    if (excerpt.length < 220 && nextParagraph)
        excerpt = `${excerpt}\n\n${nextParagraph}`

    return truncateDescriptionPreview(excerpt, 900)
}

function extractDescriptionParagraphs(value: string) {
    let normalized = normalizeDescriptionPreview(value)
    if (!normalized)
        return []

    return normalized
        .split(/\n{2,}/)
        .map(part => part.trim())
        .filter(Boolean)
}

function normalizeDescriptionPreview(value: string) {
    return decodeTranscriptText(value)
        .replace(/\r\n?/g, '\n')
        .replace(/[ \t\f\v]+\n/g, '\n')
        .replace(/\n[ \t\f\v]+/g, '\n')
        .replace(/[ \t\f\v]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}

function isReasonableDescriptionSize(value: string) {
    return value.length >= 120 && value.length <= 1200
}

function truncateDescriptionPreview(value: string, maxLength: number) {
    if (value.length <= maxLength)
        return value

    let candidate = value.slice(0, maxLength)
    let sentenceBreak = Math.max(candidate.lastIndexOf('. '), candidate.lastIndexOf('! '), candidate.lastIndexOf('? '))
    if (sentenceBreak >= Math.floor(maxLength * 0.6))
        return candidate.slice(0, sentenceBreak + 1).trim()

    let wordBreak = candidate.lastIndexOf(' ')
    if (wordBreak >= Math.floor(maxLength * 0.6))
        return candidate.slice(0, wordBreak).trim() + '...'

    return candidate.trim() + '...'
}

async function getEnclosureLength(feed: Feed, article: Pick<Article, 'episodeKey' | 'title' | 'sourceUrl'>) {
    let resolvedPath = episodePath(feed.podcastSlug, resolveEpisodeKey(article.episodeKey, article.title, article.sourceUrl))
    let file = Bun.file(resolvedPath)
    return await file.exists() ? file.size : 0
}

function escapeXml(value: string) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
}

function buildAudioUrl(feed: Feed, article: Pick<Article, 'episodeKey' | 'title' | 'sourceUrl'>) {
    let episodeKey = resolveEpisodeKey(article.episodeKey, article.title, article.sourceUrl)
    return `${getServerBaseUrl()}/feed/${feed.podcastSlug}/${episodeKey}.mp3`
}

function buildFeedUrl(feed: Pick<Feed, 'podcastSlug'>) {
    return `${getServerBaseUrl()}/feed/${feed.podcastSlug}.xml`
}

function findArticleByEpisodeKey(feedId: number, episodeKey: string) {
    let normalizedKey = normalizeEpisodeKey(episodeKey)
    let direct = database
        .select()
        .from(articlesTable)
        .where(and(eq(articlesTable.feedId, feedId), eq(articlesTable.episodeKey, normalizedKey)))
        .get()
    if (direct)
        return direct

    let legacyArticles = database
        .select()
        .from(articlesTable)
        .where(eq(articlesTable.feedId, feedId))
        .all()

    for (let article of legacyArticles) {
        let resolvedKey = resolveEpisodeKey(article.episodeKey, article.title, article.sourceUrl)
        if (resolvedKey == normalizedKey)
            return ensureStoredEpisodeKey(article, resolvedKey)
    }

    return null
}

function findArticleBySourceUrl(feedId: number, sourceUrl: string) {
    return database
        .select()
        .from(articlesTable)
        .where(and(eq(articlesTable.feedId, feedId), eq(articlesTable.sourceUrl, sourceUrl)))
        .get() || null
}

function buildEpisodeRouteKey(title: string, sourceUrl: string) {
    let base = slugifyEpisodeTitle(title)
    let suffix = hashText(sourceUrl).slice(0, 8)
    return `${base}-${suffix}`
}

function resolveEpisodeKey(storedKey: string, title: string, sourceUrl: string) {
    let normalizedStored = normalizeEpisodeKey(storedKey)
    if (normalizedStored)
        return normalizedStored

    return buildEpisodeRouteKey(title, sourceUrl)
}

function normalizeEpisodeKey(value: string) {
    let decoded = value
    try {
        decoded = decodeURIComponent(value)
    }
    catch {
        decoded = value
    }

    return decoded.trim().replace(/\.mp3$/i, '')
}

function slugifyEpisodeTitle(value: string) {
    let normalized = value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 64)

    if (normalized)
        return normalized

    return 'episode'
}

function hashText(value: string) {
    let hash = 5381
    for (let char of value)
        hash = ((hash << 5) + hash) + char.charCodeAt(0)

    return Math.abs(hash >>> 0).toString(36)
}

