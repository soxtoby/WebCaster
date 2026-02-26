import { and, desc, eq, inArray, sql } from "drizzle-orm"
import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import { database } from "../db"
import { appDataDirectory } from "../db/location"
import { articlesTable, feedsTable, type Article, type Feed } from "../db/schema"
import { getCachedVoiceById, listProviderSettings } from "../settings/settings-repository"
import { type TtsProvider } from "../settings/settings-types"
import { streamSpeech, type StreamedAudio } from "../tts/tts"

type ParsedFeedArticle = {
    sourceUrl: string
    title: string
    summary: string | null
    content: string | null
    guid: string | null
    publishedAt: string | null
}

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

export function startFeedPolling(serverBaseUrl: string) {
    if (pollerStarted)
        return

    pollerStarted = true
    void syncAllFeeds(serverBaseUrl, 20)
    setInterval(() => {
        void syncAllFeeds(serverBaseUrl, 20)
    }, 10 * 60 * 1000)
}

export async function syncFeedById(feedId: number, serverBaseUrl: string, limit = 20) {
    let feed = database.select().from(feedsTable).where(eq(feedsTable.id, feedId)).get()
    if (!feed)
        return

    await syncFeed(feed, serverBaseUrl, limit)
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
        let audioReady = await Bun.file(resolveAudioPath(feed.podcastSlug, episodeKey)).exists()
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

export async function buildPodcastFeedXml(feed: Feed, serverBaseUrl: string) {
    await syncFeed(feed, serverBaseUrl, 20)

    let episodes = database
        .select()
        .from(articlesTable)
        .where(eq(articlesTable.feedId, feed.id))
        .orderBy(desc(articlesTable.publishedAt), desc(articlesTable.createdAt))
        .all()

    let safeTitle = escapeXml(feed.name)
    let safeDescription = escapeXml(feed.description || '')
    let channelImage = feed.imageUrl ? `<image><url>${escapeXml(feed.imageUrl)}</url><title>${safeTitle}</title><link>${escapeXml(feed.rssUrl)}</link></image>` : ''
    let items = episodes.map(episode => buildRssItem(feed, episode, serverBaseUrl)).join('')

    return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n<channel>\n<title>${safeTitle}</title>\n<link>${escapeXml(feed.rssUrl)}</link>\n<description>${safeDescription}</description>\n${channelImage}\n${items}\n</channel>\n</rss>`
}

export async function streamEpisodeAudio(feed: Feed, episodeKey: string, serverBaseUrl: string): Promise<Response> {
    let article = findArticleByEpisodeKey(feed.id, episodeKey)

    if (!article)
        return new Response('Episode not found', { status: 404 })

    let resolvedPath = resolveAudioPath(feed.podcastSlug, resolveEpisodeKey(article.episodeKey, article.title, article.sourceUrl))
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
    void persistAudioStream(toDisk, resolvedPath, article, feed, serverBaseUrl)

    return new Response(toClient, {
        headers: {
            'content-type': generated.mimeType,
            'cache-control': 'no-store'
        }
    })
}

async function syncAllFeeds(serverBaseUrl: string, limit: number) {
    let feeds = database.select().from(feedsTable).all()
    for (let feed of feeds)
        await syncFeed(feed, serverBaseUrl, limit)
}

async function syncFeed(feed: Feed, serverBaseUrl: string, limit: number) {
    let items: ParsedFeedArticle[]
    try {
        items = await fetchFeedArticles(feed.rssUrl)
    } catch {
        return
    }

    items = items.slice(0, limit)
    for (let item of items) {
        let episodeKey = buildEpisodeRouteKey(item.title, item.sourceUrl)
        database
            .insert(articlesTable)
            .values({
                feedId: feed.id,
                episodeKey,
                guid: item.guid,
                sourceUrl: item.sourceUrl,
                title: item.title,
                summary: item.summary,
                content: item.content,
                status: 'pending',
                generationMode: feed.generationMode,
                contentSource: feed.contentSource,
                publishedAt: item.publishedAt,
                updatedAt: sql`CURRENT_TIMESTAMP`
            })
            .onConflictDoNothing({ target: [articlesTable.feedId, articlesTable.sourceUrl] })
            .run()
    }

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
            await generateAndStoreAudio(feed, article, serverBaseUrl)
    }
}

async function generateAndStoreAudio(feed: Feed, article: Article, serverBaseUrl: string) {
    let resolvedPath = resolveAudioPath(feed.podcastSlug, resolveEpisodeKey(article.episodeKey, article.title, article.sourceUrl))
    let file = Bun.file(resolvedPath)
    if (await file.exists()) {
        markArticleReady(feed.id, article.episodeKey, buildAudioUrl(feed, article, serverBaseUrl))
        return
    }

    if (article.status == 'generating')
        return

    markArticleGenerating(feed.id, article.episodeKey, feed)
    try {
        let generated = await createAudioStream(feed, article)
        await persistAudioStream(generated.stream, resolvedPath, article, feed, serverBaseUrl)
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

async function persistAudioStream(stream: ReadableStream<Uint8Array>, outputPath: string, article: Article, feed: Feed, serverBaseUrl: string) {
    try {
        await mkdir(join(appDataDirectory, 'audio', feed.podcastSlug), { recursive: true })
        await writeStreamToFile(stream, outputPath)
        markArticleReady(feed.id, article.episodeKey, buildAudioUrl(feed, article, serverBaseUrl))
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

    let fallback = article.summary || article.title
    return [article.title, article.content || '', fallback].join('\n\n').trim()
}

async function readSourcePage(sourceUrl: string, article: Article) {
    try {
        let response = await fetch(sourceUrl)
        if (!response.ok)
            return fallbackArticleText(article)

        let html = await response.text()
        let extracted = extractReadableText(html)
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

function extractReadableText(html: string) {
    let withoutScripts = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')

    let articleMatch = withoutScripts.match(/<article[\s\S]*?<\/article>/i)
    let mainMatch = withoutScripts.match(/<main[\s\S]*?<\/main>/i)
    let candidate = articleMatch?.[0] || mainMatch?.[0] || withoutScripts

    let text = candidate
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

async function fetchFeedArticles(rssUrl: string): Promise<ParsedFeedArticle[]> {
    let response = await fetch(rssUrl, {
        headers: {
            Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5'
        }
    })

    if (!response.ok)
        throw new Error('Feed fetch failed')

    let xml = await response.text()
    return parseFeedArticles(xml)
}

function parseFeedArticles(xml: string): ParsedFeedArticle[] {
    let items = parseRssItems(xml)
    if (items.length > 0)
        return items

    return parseAtomEntries(xml)
}

function parseRssItems(xml: string): ParsedFeedArticle[] {
    let matches = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)]
    let articles: ParsedFeedArticle[] = []

    for (let match of matches) {
        let itemXml = match[0]
        let sourceUrl = firstTagValue(itemXml, ['link'])
        let title = firstTagValue(itemXml, ['title']) || 'Untitled episode'
        if (!sourceUrl)
            continue

        articles.push({
            sourceUrl,
            title: decodeEntities(stripTags(title)),
            summary: decodeEntities(stripTags(firstTagValue(itemXml, ['description']) || '')) || null,
            content: decodeEntities(stripTags(firstTagValue(itemXml, ['content:encoded', 'content']) || '')) || null,
            guid: firstTagValue(itemXml, ['guid']),
            publishedAt: normalizeDate(firstTagValue(itemXml, ['pubDate', 'published', 'updated']))
        })
    }

    return articles
}

function parseAtomEntries(xml: string): ParsedFeedArticle[] {
    let matches = [...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)]
    let articles: ParsedFeedArticle[] = []

    for (let match of matches) {
        let itemXml = match[0]
        let sourceUrl = extractAtomLink(itemXml)
        let title = firstTagValue(itemXml, ['title']) || 'Untitled episode'
        if (!sourceUrl)
            continue

        articles.push({
            sourceUrl,
            title: decodeEntities(stripTags(title)),
            summary: decodeEntities(stripTags(firstTagValue(itemXml, ['summary']) || '')) || null,
            content: decodeEntities(stripTags(firstTagValue(itemXml, ['content']) || '')) || null,
            guid: firstTagValue(itemXml, ['id']) || sourceUrl,
            publishedAt: normalizeDate(firstTagValue(itemXml, ['published', 'updated']))
        })
    }

    return articles
}

function extractAtomLink(xml: string) {
    let alt = xml.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["'][^>]*\/?\s*>/i)
    if (alt?.[1])
        return alt[1]

    let direct = xml.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?\s*>/i)
    if (direct?.[1])
        return direct[1]

    return ''
}

function firstTagValue(xml: string, tags: string[]) {
    for (let tag of tags) {
        let regex = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i')
        let found = xml.match(regex)
        if (found?.[1]) {
            let value = found[1].replace(/^<!\[CDATA\[|\]\]>$/g, '').trim()
            if (value)
                return value
        }
    }

    return ''
}

function stripTags(value: string) {
    return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function decodeEntities(value: string) {
    return value
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&quot;/g, '"')
}

function normalizeDate(value: string) {
    if (!value)
        return null

    let parsed = new Date(value)
    if (Number.isNaN(parsed.getTime()))
        return null

    return parsed.toISOString()
}

function buildRssItem(feed: Feed, article: Article, serverBaseUrl: string) {
    let enclosureUrl = buildAudioUrl(feed, article, serverBaseUrl)
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

function resolveAudioPath(podcastSlug: string, episodeKey: string) {
    return join(appDataDirectory, 'audio', podcastSlug, `${episodeKey}.mp3`)
}

function buildAudioUrl(feed: Feed, article: Pick<Article, 'episodeKey' | 'title' | 'sourceUrl'>, serverBaseUrl: string) {
    let episodeKey = resolveEpisodeKey(article.episodeKey, article.title, article.sourceUrl)
    return `${serverBaseUrl.replace(/\/+$/, '')}/feed/${feed.podcastSlug}/${episodeKey}`
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
