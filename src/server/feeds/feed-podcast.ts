import { and, desc, eq, inArray, sql } from "drizzle-orm"
import { mkdirSync } from "node:fs"
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
    id: number
    title: string
    sourceUrl: string
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

export function listFeedEpisodes(feedId: number): EpisodeView[] {
    let rows = database
        .select({
            id: articlesTable.id,
            title: articlesTable.title,
            sourceUrl: articlesTable.sourceUrl,
            publishedAt: articlesTable.publishedAt,
            status: articlesTable.status,
            errorMessage: articlesTable.errorMessage,
            audioPath: articlesTable.audioPath
        })
        .from(articlesTable)
        .where(eq(articlesTable.feedId, feedId))
        .orderBy(desc(articlesTable.publishedAt), desc(articlesTable.id))
        .all()

    return rows.map(row => ({
        id: row.id,
        title: row.title,
        sourceUrl: row.sourceUrl,
        publishedAt: row.publishedAt,
        status: row.status,
        errorMessage: row.errorMessage,
        audioReady: Boolean(row.audioPath)
    }))
}

export async function buildPodcastFeedXml(feed: Feed, serverBaseUrl: string) {
    await syncFeed(feed, serverBaseUrl, 20)

    let episodes = database
        .select()
        .from(articlesTable)
        .where(eq(articlesTable.feedId, feed.id))
        .orderBy(desc(articlesTable.publishedAt), desc(articlesTable.id))
        .all()

    let safeTitle = escapeXml(feed.name)
    let safeDescription = escapeXml(feed.description || '')
    let channelImage = feed.imageUrl ? `<image><url>${escapeXml(feed.imageUrl)}</url><title>${safeTitle}</title><link>${escapeXml(feed.rssUrl)}</link></image>` : ''
    let items = episodes.map(episode => buildRssItem(feed, episode, serverBaseUrl)).join('')

    return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n<channel>\n<title>${safeTitle}</title>\n<link>${escapeXml(feed.rssUrl)}</link>\n<description>${safeDescription}</description>\n${channelImage}\n${items}\n</channel>\n</rss>`
}

export async function streamEpisodeAudio(feed: Feed, articleId: number, serverBaseUrl: string): Promise<Response> {
    let article = database
        .select()
        .from(articlesTable)
        .where(and(eq(articlesTable.id, articleId), eq(articlesTable.feedId, feed.id)))
        .get()

    if (!article)
        return new Response('Episode not found', { status: 404 })

    let resolvedPath = resolveAudioPath(feed.podcastSlug, article.id)
    if (article.audioPath) {
        let existing = Bun.file(article.audioPath)
        if (await existing.exists())
            return new Response(existing, { headers: { 'content-type': 'audio/mpeg' } })
    }

    let generated: StreamedAudio
    try {
        generated = await createAudioStream(feed, article)
    } catch (error) {
        let message = error instanceof Error ? error.message : 'Audio generation failed'
        markArticleFailed(article.id, message)
        return new Response(message, { status: 400 })
    }

    markArticleGenerating(article.id, feed)
    let [toClient, toDisk] = generated.stream.tee()
    void persistAudioStream(toDisk, resolvedPath, article.id, feed, serverBaseUrl)

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
        database
            .insert(articlesTable)
            .values({
                feedId: feed.id,
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
            .orderBy(desc(articlesTable.publishedAt), desc(articlesTable.id))
            .all()

        for (let article of pending)
            await generateAndStoreAudio(feed, article, serverBaseUrl)
    }
}

async function generateAndStoreAudio(feed: Feed, article: Article, serverBaseUrl: string) {
    let resolvedPath = resolveAudioPath(feed.podcastSlug, article.id)
    let file = Bun.file(resolvedPath)
    if (await file.exists()) {
        markArticleReady(article.id, resolvedPath, buildAudioUrl(feed, article.id, serverBaseUrl))
        return
    }

    if (article.status == 'generating')
        return

    markArticleGenerating(article.id, feed)
    try {
        let generated = await createAudioStream(feed, article)
        await persistAudioStream(generated.stream, resolvedPath, article.id, feed, serverBaseUrl)
    } catch (error) {
        let message = error instanceof Error ? error.message : 'Audio generation failed'
        markArticleFailed(article.id, message)
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

async function persistAudioStream(stream: ReadableStream<Uint8Array>, outputPath: string, articleId: number, feed: Feed, serverBaseUrl: string) {
    try {
        mkdirSync(join(appDataDirectory, 'audio', feed.podcastSlug), { recursive: true })
        await writeStreamToFile(stream, outputPath)
        markArticleReady(articleId, outputPath, buildAudioUrl(feed, articleId, serverBaseUrl))
    }
    catch {
        markArticleFailed(articleId, 'Failed to store generated audio')
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

function markArticleGenerating(articleId: number, feed: Feed) {
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
        .where(eq(articlesTable.id, articleId))
        .run()
}

function markArticleReady(articleId: number, audioPath: string, audioUrl: string) {
    database
        .update(articlesTable)
        .set({
            status: 'ready',
            errorMessage: null,
            audioPath,
            audioUrl,
            updatedAt: sql`CURRENT_TIMESTAMP`
        })
        .where(eq(articlesTable.id, articleId))
        .run()
}

function markArticleFailed(articleId: number, reason: string) {
    database
        .update(articlesTable)
        .set({
            status: 'failed',
            errorMessage: reason,
            updatedAt: sql`CURRENT_TIMESTAMP`
        })
        .where(eq(articlesTable.id, articleId))
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
    let enclosureUrl = buildAudioUrl(feed, article.id, serverBaseUrl)
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

function resolveAudioPath(podcastSlug: string, articleId: number) {
    return join(appDataDirectory, 'audio', podcastSlug, `${articleId}.mp3`)
}

function buildAudioUrl(feed: Feed, articleId: number, serverBaseUrl: string) {
    return `${serverBaseUrl.replace(/\/+$/, '')}/feed/${feed.podcastSlug}/${articleId}`
}
