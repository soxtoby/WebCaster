import { and, desc, eq, inArray, sql } from "drizzle-orm"
import { mkdir, unlink } from "node:fs/promises"
import { database } from "../db"
import { articlesTable, feedsTable, type Article, type Feed } from "../db/schema"
import { episodePath, podcastDirectory } from "../paths"
import { getCachedVoiceById, getServerBaseUrl, listProviderSettings } from "../settings/settings-repository"
import { type TtsProvider } from "../settings/settings-types"
import { streamSpeech, type StreamedAudio } from "../tts/tts"
import { fetchFeed, type ParsedFeedArticle } from "./feed-parsing"
import { replaceImagesWithDescriptionsWithOptions } from "./image-description"

type EpisodeView = {
    episodeKey: string
    title: string
    sourceUrl: string
    episodePath: string
    publishedAt: string | null
    status: string
    errorMessage: string | null
    voice: string | null
    audioReady: boolean
}

let pollerStarted = false

export function startFeedPolling() {
    if (pollerStarted)
        return

    pollerStarted = true
    void syncAllFeeds(20)
    setInterval(() => {
        void syncAllFeeds(20)
    }, 10 * 60 * 1000)
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
        return {
            episodeKey,
            title: row.title,
            sourceUrl: row.sourceUrl,
            episodePath: `/feed/${feed.podcastSlug}/${episodeKey}`,
            publishedAt: row.publishedAt,
            status: row.status,
            errorMessage: row.errorMessage,
            voice: row.voice,
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
    let channelImage = feed.imageUrl ? `<image><url>${escapeXml(feed.imageUrl)}</url><title>${safeTitle}</title><link>${escapeXml(feed.rssUrl)}</link></image>` : ''
    let items = (await Promise.all(episodes.map(episode => buildRssItem(feed, episode)))).join('')

    return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n<channel>\n<title>${safeTitle}</title>\n<link>${escapeXml(feed.rssUrl)}</link>\n<description>${safeDescription}</description>\n<atom:link href="${escapeXml(selfLink)}" rel="self" type="application/rss+xml"/>\n${channelImage}\n${items}\n</channel>\n</rss>`
}

export async function streamEpisodeAudio(feed: Feed, episodeKey: string): Promise<Response> {
    let article = findArticleByEpisodeKey(feed.id, episodeKey)

    if (!article)
        return new Response('Episode not found', { status: 404 })

    let resolvedPath = episodePath(feed.podcastSlug, resolveEpisodeKey(article.episodeKey, article.title, article.sourceUrl))
    let preferredFile = Bun.file(resolvedPath)
    if (await preferredFile.exists())
        return new Response(preferredFile, { headers: { 'content-type': 'audio/mpeg' } })

    let generated: StreamedAudio
    try {
        generated = await createAudioStream(feed, article)
    } catch (error) {
        let message = error instanceof Error ? error.message : 'Audio generation failed'
        markArticleFailed(feed.id, article.episodeKey, message)
        return new Response(message, { status: 400 })
    }

    markArticleGenerating(feed.id, article.episodeKey, feed)
    let [toClient, toDisk] = generated.stream.tee()
    void persistAudioStream(toDisk, resolvedPath, article, feed)

    return new Response(toClient, {
        headers: {
            'content-type': generated.mimeType,
            'cache-control': 'no-store'
        }
    })
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

export function insertFeedArticles(feedId: number, generationMode: string, contentSource: string, articles: ParsedFeedArticle[], limit = 20) {
    let items = articles.slice(0, limit)
    for (let item of items) {
        let episodeKey = buildEpisodeRouteKey(item.title, item.sourceUrl)
        database
            .insert(articlesTable)
            .values({
                feedId,
                episodeKey,
                guid: item.guid,
                sourceUrl: item.sourceUrl,
                title: item.title,
                summary: item.summary,
                content: item.content,
                voice: null,
                status: 'pending',
                generationMode,
                contentSource,
                publishedAt: item.publishedAt,
                updatedAt: sql`CURRENT_TIMESTAMP`
            })
            .onConflictDoNothing({ target: [articlesTable.feedId, articlesTable.sourceUrl] })
            .run()
    }
}

async function syncFeed(feed: Feed, limit: number) {
    let parsed = await fetchFeed(feed.rssUrl)
    if (!parsed)
        return

    insertFeedArticles(feed.id, feed.generationMode, feed.contentSource, parsed.articles, limit)

    if (feed.generationMode == 'every_episode') {
        let pending = database
            .select()
            .from(articlesTable)
            .where(and(
                eq(articlesTable.feedId, feed.id),
                inArray(articlesTable.status, ['pending', 'failed'])
            ))
            .orderBy(desc(articlesTable.publishedAt), desc(articlesTable.createdAt))
            .all()

        for (let article of pending)
            await generateAndStoreAudio(feed, article)
    }
}

async function generateAndStoreAudio(feed: Feed, article: Article) {
    let resolvedPath = episodePath(feed.podcastSlug, resolveEpisodeKey(article.episodeKey, article.title, article.sourceUrl))
    let file = Bun.file(resolvedPath)
    if (await file.exists()) {
        markArticleReady(feed.id, article.episodeKey, buildAudioUrl(feed, article))
        return
    }

    if (article.status == 'generating')
        return

    markArticleGenerating(feed.id, article.episodeKey, feed)
    try {
        let generated = await createAudioStream(feed, article)
        await persistAudioStream(generated.stream, resolvedPath, article, feed)
    } catch (error) {
        let message = error instanceof Error ? error.message : 'Audio generation failed'
        markArticleFailed(feed.id, article.episodeKey, message)
    }
}

async function createAudioStream(feed: Feed, article: Article): Promise<StreamedAudio> {
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
    return await streamSpeech(voice.provider, voice.providerVoiceId, text, settings)
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
    database
        .update(articlesTable)
        .set({
            transcript,
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
}

async function resolveArticleText(feed: Feed, article: Article, options: { forceRegenerateImageDescriptions: boolean }) {
    if (feed.contentSource == 'source_page')
        return await readSourcePage(article.sourceUrl, article, options)

    let preparedContent = await prepareNarrationText(article.content || '', article.sourceUrl, options)
        || await prepareNarrationText((article.summary || ''), article.sourceUrl, options)

    return [decodeTranscriptText(article.title), preparedContent].join('\n\n').trim()
}

async function readSourcePage(sourceUrl: string, article: Article, options: { forceRegenerateImageDescriptions: boolean }) {
    try {
        let response = await fetch(sourceUrl)
        if (!response.ok)
            return fallbackArticleText(article)

        let html = await response.text()
        let extracted = await extractReadableText(html, sourceUrl, options)
        if (!extracted)
            return fallbackArticleText(article)

        return [decodeTranscriptText(article.title), extracted].join('\n\n').trim()
    }
    catch {
        return fallbackArticleText(article)
    }
}

function fallbackArticleText(article: Article) {
    return decodeTranscriptText([article.title, article.content || article.summary || ''].join('\n\n').trim())
}

async function extractReadableText(html: string, sourceUrl: string, options: { forceRegenerateImageDescriptions: boolean }) {
    let withoutScripts = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')

    let articleMatch = withoutScripts.match(/<article[\s\S]*?<\/article>/i)
    let mainMatch = withoutScripts.match(/<main[\s\S]*?<\/main>/i)
    let candidate = articleMatch?.[0] || mainMatch?.[0] || withoutScripts
    let withImageDescriptions = await replaceImagesWithDescriptionsWithOptions(candidate, sourceUrl, {
        forceRegenerate: options.forceRegenerateImageDescriptions
    })

    let text = withImageDescriptions
        .replace(/<\/?(p|h1|h2|h3|h4|h5|h6|li|blockquote|section|article|main|div|br)[^>]*>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .trim()

    text = normalizeTranscriptText(decodeTranscriptText(text))

    if (text.length < 120)
        return ''

    return text
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

    let nextArticle: Article = {
        ...article,
        title: refreshed.title,
        summary: refreshed.summary,
        content: refreshed.content,
        guid: refreshed.guid,
        publishedAt: refreshed.publishedAt,
        updatedAt: new Date().toISOString()
    }

    database
        .update(articlesTable)
        .set({
            title: refreshed.title,
            summary: refreshed.summary,
            content: refreshed.content,
            guid: refreshed.guid,
            publishedAt: refreshed.publishedAt,
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
    let description = escapeXml(article.summary || '')
    let title = escapeXml(article.title)

    return `<item><title>${title}</title><guid isPermaLink="false">${escapeXml(guid)}</guid><link>${escapeXml(article.sourceUrl)}</link><description>${description}</description><enclosure url="${escapeXml(enclosureUrl)}" length="${enclosureLength}" type="audio/mpeg"/>${published}</item>`
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

