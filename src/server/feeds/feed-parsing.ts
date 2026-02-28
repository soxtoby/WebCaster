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
        let title = extractFeedTitle(xml)
        let imageUrl = extractFeedImage(xml)
        let description = extractFeedDescription(xml)
        let articles = parseFeedArticles(xml)

        return { title, imageUrl, description, articles }
    } catch {
        return null
    }
}

function extractFeedTitle(xml: string): string | null {
    let channelTitleMatch = xml.match(/<channel[\s\S]*?<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/i)
    if (channelTitleMatch?.[1]) {
        let title = cleanFeedTitle(channelTitleMatch[1])
        if (title)
            return title
    }

    let atomTitleMatch = xml.match(/<feed[\s\S]*?<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/i)
    if (atomTitleMatch?.[1]) {
        let title = cleanFeedTitle(atomTitleMatch[1])
        if (title)
            return title
    }

    let anyTitleMatch = xml.match(/<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/i)
    if (anyTitleMatch?.[1]) {
        let title = cleanFeedTitle(anyTitleMatch[1])
        if (title)
            return title
    }

    return null
}

function cleanFeedTitle(rawTitle: string) {
    let withoutCdata = rawTitle.replace(/^<!\[CDATA\[|\]\]>$/g, '')
    let withoutTags = withoutCdata.replace(/<[^>]+>/g, '')
    let collapsedWhitespace = withoutTags.replace(/\s+/g, ' ').trim()
    if (!collapsedWhitespace)
        return ''

    return decodeXmlEntities(collapsedWhitespace)
}

function extractFeedDescription(xml: string): string | null {
    let channelDescMatch = xml.match(/<channel[\s\S]*?<description(?:\s[^>]*)?>([\s\S]*?)<\/description>/i)
    if (channelDescMatch?.[1]) {
        let desc = cleanDescription(channelDescMatch[1])
        if (desc)
            return desc
    }

    let atomSubtitleMatch = xml.match(/<feed[\s\S]*?<subtitle(?:\s[^>]*)?>([\s\S]*?)<\/subtitle>/i)
    if (atomSubtitleMatch?.[1]) {
        let desc = cleanDescription(atomSubtitleMatch[1])
        if (desc)
            return desc
    }

    let itunesSummaryMatch = xml.match(/<itunes:summary(?:\s[^>]*)?>([\s\S]*?)<\/itunes:summary>/i)
    if (itunesSummaryMatch?.[1]) {
        let desc = cleanDescription(itunesSummaryMatch[1])
        if (desc)
            return desc
    }

    return null
}

function cleanDescription(rawDesc: string): string | null {
    let withoutCdata = rawDesc.replace(/^<!\[CDATA\[|\]\]>$/g, '')
    let withoutTags = withoutCdata.replace(/<[^>]+>/g, '')
    let collapsedWhitespace = withoutTags.replace(/\s+/g, ' ').trim()
    if (!collapsedWhitespace)
        return null

    let decoded = decodeXmlEntities(collapsedWhitespace)
    if (decoded.length > 200)
        return decoded.substring(0, 197) + '...'

    return decoded
}

function extractFeedImage(xml: string): string | null {
    let itunesImageMatch = xml.match(/<itunes:image[^>]+href=["']([^"']+)["']/i)
    if (itunesImageMatch?.[1])
        return itunesImageMatch[1]

    let channelImageUrlMatch = xml.match(/<channel[\s\S]*?<image[\s\S]*?<url(?:\s[^>]*)?>([\s\S]*?)<\/url>/i)
    if (channelImageUrlMatch?.[1]) {
        let url = cleanImageUrl(channelImageUrlMatch[1])
        if (url)
            return url
    }

    let atomLogoMatch = xml.match(/<feed[\s\S]*?<logo(?:\s[^>]*)?>([\s\S]*?)<\/logo>/i)
    if (atomLogoMatch?.[1]) {
        let url = cleanImageUrl(atomLogoMatch[1])
        if (url)
            return url
    }

    let atomIconMatch = xml.match(/<feed[\s\S]*?<icon(?:\s[^>]*)?>([\s\S]*?)<\/icon>/i)
    if (atomIconMatch?.[1]) {
        let url = cleanImageUrl(atomIconMatch[1])
        if (url)
            return url
    }

    let mediaThumbnailMatch = xml.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i)
    if (mediaThumbnailMatch?.[1])
        return mediaThumbnailMatch[1]

    return null
}

function cleanImageUrl(rawUrl: string): string | null {
    let withoutCdata = rawUrl.replace(/^<!\[CDATA\[|\]\]>$/g, '')
    let withoutTags = withoutCdata.replace(/<[^>]+>/g, '')
    let trimmed = withoutTags.trim()
    if (!trimmed)
        return null

    try {
        new URL(trimmed)
        return trimmed
    } catch {
        return null
    }
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
            title: decodeXmlEntities(stripTags(title)),
            summary: decodeXmlEntities(stripTags(firstTagValue(itemXml, ['description']) || '')) || null,
            content: decodeXmlEntities(stripTags(firstTagValue(itemXml, ['content:encoded', 'content']) || '')) || null,
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
            title: decodeXmlEntities(stripTags(title)),
            summary: decodeXmlEntities(stripTags(firstTagValue(itemXml, ['summary']) || '')) || null,
            content: decodeXmlEntities(stripTags(firstTagValue(itemXml, ['content']) || '')) || null,
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

function decodeXmlEntities(value: string) {
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
