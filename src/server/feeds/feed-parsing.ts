import { XMLParser } from "fast-xml-parser"
import { fetchSourceArticleFeedInput } from "./source-article"

export type ParsedFeed = {
    title: string | null
    description: string | null
    imageUrl: string | null
    articles: ParsedFeedArticle[]
}

export type ParsedFeedArticle = {
    sourceUrl: string
    title: string
    summary: string | null
    content: string | null
    guid: string | null
    publishedAt: string | null
}

let parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    trimValues: true,
    processEntities: true,
    isArray: (name) => name == 'item' || name == 'entry',
    stopNodes: [
        '*.title',
        '*.description',
        '*.summary',
        '*.content',
        '*.content:encoded',
        '*.itunes:summary',
    ],
})

export async function fetchFeed(rssUrl: string): Promise<ParsedFeed | null> {
    try {
        let response = await fetch(rssUrl, {
            headers: {
                Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5'
            }
        })

        if (!response.ok)
            return null

        let xml = await response.text()
        let doc = parser.parse(xml)

        let channel = doc?.rss?.channel
        if (channel)
            return parseRssChannel(channel)

        let feed = doc?.feed
        if (feed)
            return parseAtomFeed(feed)

        return null
    } catch {
        return null
    }
}

export async function fetchArticlePage(sourceUrl: string): Promise<ParsedFeedArticle | null> {
    return await fetchSourceArticleFeedInput(sourceUrl)
}

function parseRssChannel(channel: any): ParsedFeed {
    let title = cleanText(textOf(channel.title))
    let description = truncate(cleanText(textOf(channel.description) || textOf(channel['itunes:summary'])), 200)
    let imageUrl = extractRssImage(channel)
    let articles = (channel.item || []).map(parseRssItem).filter(Boolean) as ParsedFeedArticle[]

    return { title, description, imageUrl, articles }
}

function parseAtomFeed(feed: any): ParsedFeed {
    let title = cleanText(textOf(feed.title))
    let description = truncate(cleanText(textOf(feed.subtitle) || textOf(feed['itunes:summary'])), 200)
    let imageUrl = feed['itunes:image']?.['@_href'] || textOf(feed.logo) || textOf(feed.icon) || null
    let articles = (feed.entry || []).map(parseAtomEntry).filter(Boolean) as ParsedFeedArticle[]

    return { title, description, imageUrl, articles }
}

function extractRssImage(channel: any): string | null {
    let itunesImage = firstArrayValue(channel['itunes:image'], image => image?.['@_href'])
    if (itunesImage)
        return itunesImage

    let imageUrl = firstArrayValue(channel.image, image => textOf(image?.url))
    if (imageUrl)
        return imageUrl

    let mediaThumbnail = firstArrayValue(channel['media:thumbnail'], image => image?.['@_url'])
    if (mediaThumbnail)
        return mediaThumbnail

    return null
}

function parseRssItem(item: any): ParsedFeedArticle | null {
    let sourceUrl = textOf(item.link)
    if (!sourceUrl)
        return null

    return {
        sourceUrl,
        title: cleanText(textOf(item.title)) || "Untitled episode",
        summary: cleanText(textOf(item.description)) || null,
        content: textOf(item['content:encoded']) || textOf(item.content) || null,
        guid: textOf(item.guid) || null,
        publishedAt: normalizeDate(textOf(item.pubDate) || textOf(item.published) || textOf(item.updated)),
    }
}

function parseAtomEntry(entry: any): ParsedFeedArticle | null {
    let sourceUrl = extractAtomLink(entry)
    if (!sourceUrl)
        return null

    return {
        sourceUrl,
        title: cleanText(textOf(entry.title)) || "Untitled episode",
        summary: cleanText(textOf(entry.summary)) || null,
        content: textOf(entry.content) || null,
        guid: textOf(entry.id) || sourceUrl,
        publishedAt: normalizeDate(textOf(entry.published) || textOf(entry.updated)),
    }
}

function extractAtomLink(entry: any): string {
    let links = toArray(entry.link)
    let alt = links.find((l: any) => l?.['@_rel'] == 'alternate')
    if (alt?.['@_href'])
        return alt['@_href']

    if (links[0]?.['@_href'])
        return links[0]['@_href']

    return ''
}

function textOf(node: any): string {
    if (node == null)
        return ''
    let raw = ''
    if (typeof node == 'string')
        raw = node
    else if (typeof node == 'number' || typeof node == 'boolean')
        raw = String(node)
    else if (typeof node == 'object' && '#text' in node)
        raw = String(node['#text'])

    return raw
        .replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .trim()
}

function toArray(value: any): any[] {
    if (value == null)
        return []
    if (Array.isArray(value))
        return value
    return [value]
}

function firstArrayValue<T>(value: any, map: (item: any) => T | null | undefined): T | null {
    for (let item of toArray(value)) {
        let mapped = map(item)
        if (mapped)
            return mapped
    }

    return null
}

function cleanText(value: string): string | null {
    let stripped = value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    return stripped || null
}

function truncate(value: string | null, max: number): string | null {
    if (!value)
        return null
    if (value.length > max)
        return value.substring(0, max - 3) + '...'
    return value
}

function normalizeDate(value: string): string | null {
    if (!value)
        return null
    let parsed = new Date(value)
    if (Number.isNaN(parsed.getTime()))
        return null
    return parsed.toISOString()
}
