import { and, desc, eq, inArray, sql } from "drizzle-orm"
import { mkdir } from "node:fs/promises"
import { database } from "../db"
import { articlesTable, feedsTable, type Article, type Feed } from "../db/schema"
import { episodePath, podcastDirectory } from "../paths"
import { getCachedVoiceById, getServerBaseUrl, listProviderSettings } from "../settings/settings-repository"
import { type TtsProvider } from "../settings/settings-types"
import { streamSpeech, type StreamedAudio } from "../tts/tts"
import { fetchFeed, type ParsedFeedArticle } from "./feed-parsing"
import { replaceImagesWithDescriptions } from "./image-description"

type EpisodeView = {
    episodeKey: string
    title: string
    sourceUrl: string
    episodePath: string
    publishedAt: string | null
    status: string
    errorMessage: string | null
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
    let channelImage = feed.imageUrl ? `<image><url>${escapeXml(feed.imageUrl)}</url><title>${safeTitle}</title><link>${escapeXml(feed.rssUrl)}</link></image>` : ''
    let items = episodes.map(episode => buildRssItem(feed, episode)).join('')

    return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n<channel>\n<title>${safeTitle}</title>\n<link>${escapeXml(feed.rssUrl)}</link>\n<description>${safeDescription}</description>\n${channelImage}\n${items}\n</channel>\n</rss>`
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
    let text = await resolveArticleText(feed, article)
    if (!text.trim())
        throw new Error('Article text is empty')

    let voice = getCachedVoiceById(feed.voice)
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

async function resolveArticleText(feed: Feed, article: Article) {
    if (feed.contentSource == 'source_page')
        return await readSourcePage(article.sourceUrl, article)

    let preparedContent = await prepareNarrationText(article.content || '', article.sourceUrl)
        || await prepareNarrationText((article.summary || ''), article.sourceUrl)

    return [article.title, preparedContent].join('\n\n').trim()
}

async function readSourcePage(sourceUrl: string, article: Article) {
    try {
        let response = await fetch(sourceUrl)
        if (!response.ok)
            return fallbackArticleText(article)

        let html = await response.text()
        let extracted = await extractReadableText(html, sourceUrl)
        if (!extracted)
            return fallbackArticleText(article)

        return [article.title, extracted].join('\n\n').trim()
    }
    catch {
        return fallbackArticleText(article)
    }
}

function fallbackArticleText(article: Article) {
    return [article.title, article.content || article.summary || ''].join('\n\n').trim()
}

async function extractReadableText(html: string, sourceUrl: string) {
    let withoutScripts = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')

    let articleMatch = withoutScripts.match(/<article[\s\S]*?<\/article>/i)
    let mainMatch = withoutScripts.match(/<main[\s\S]*?<\/main>/i)
    let candidate = articleMatch?.[0] || mainMatch?.[0] || withoutScripts
    let withImageDescriptions = await replaceImagesWithDescriptions(candidate, sourceUrl)

    let text = withImageDescriptions
        .replace(/<\/?(p|h1|h2|h3|h4|h5|h6|li|blockquote|section|article|main|br)[^>]*>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/\s+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()

    if (text.length < 120)
        return ''

    return text
}

async function prepareNarrationText(value: string, sourceUrl: string) {
    let withImageDescriptions = await replaceImagesWithDescriptions(value, sourceUrl)

    return withImageDescriptions
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<\/?(p|h1|h2|h3|h4|h5|h6|li|blockquote|section|article|main|br)[^>]*>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/\s+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/\s+/g, ' ')
        .trim()
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

function buildRssItem(feed: Feed, article: Article) {
    let enclosureUrl = buildAudioUrl(feed, article)
    let guid = article.sourceUrl || article.guid || enclosureUrl
    let published = article.publishedAt ? `<pubDate>${new Date(article.publishedAt).toUTCString()}</pubDate>` : ''
    let description = escapeXml(article.summary || '')
    let title = escapeXml(article.title)

    return `<item><title>${title}</title><guid isPermaLink="false">${escapeXml(guid)}</guid><link>${escapeXml(article.sourceUrl)}</link><description>${description}</description><enclosure url="${escapeXml(enclosureUrl)}" type="audio/mpeg"/>${published}</item>`
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
    return `${getServerBaseUrl()}/feed/${feed.podcastSlug}/${episodeKey}`
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
