import { replaceImagesWithDescriptionsWithOptions } from "./image-description"

export type SourceArticleFeedInput = {
    sourceUrl: string
    title: string
    summary: string | null
    content: string | null
    guid: string | null
    publishedAt: string | null
}

export async function fetchSourceArticle(sourceUrl: string, options: { forceRegenerateImageDescriptions: boolean }) {
    try {
        let normalizedUrl = new URL(sourceUrl).toString()
        let response = await fetch(normalizedUrl)
        if (!response.ok)
            return null

        let html = await response.text()
        let contentHtml = extractReadableArticleHtml(html)
        let text = await extractReadableArticleText(html, normalizedUrl, options)

        return {
            sourceUrl: normalizedUrl,
            html,
            contentHtml,
            text
        }
    }
    catch {
        return null
    }
}

export async function fetchSourceArticleFeedInput(sourceUrl: string): Promise<SourceArticleFeedInput | null> {
    let article = await fetchSourceArticle(sourceUrl, {
        forceRegenerateImageDescriptions: false
    })
    if (!article)
        return null

    let metadata = extractSourceArticleMetadata(article.html)
    let title = metadata.title || buildFallbackArticleTitle(article.sourceUrl) || 'Untitled article'
    let summary = metadata.summary || truncate(cleanText(article.contentHtml || ''), 200)

    return {
        sourceUrl: article.sourceUrl,
        title,
        summary,
        content: article.contentHtml,
        guid: article.sourceUrl,
        publishedAt: metadata.publishedAt
    }
}

export function extractSourceArticleMetadata(html: string) {
    let title = cleanText(
        extractMetaTagContent(html, 'og:title')
        || extractMetaTagContent(html, 'twitter:title')
        || extractTagContent(html, 'title')
        || extractTagContent(html, 'h1')
    )

    let metaDescription = cleanText(
        extractMetaNameContent(html, 'description')
        || extractMetaTagContent(html, 'og:description')
        || extractMetaTagContent(html, 'twitter:description')
    )

    return {
        title,
        summary: truncate(metaDescription, 200),
        publishedAt: normalizeDate(extractMetaTagContent(html, 'article:published_time') || extractTimeDateTime(html))
    }
}

function extractReadableArticleHtml(html: string) {
    let withoutScripts = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')

    let articleMatch = withoutScripts.match(/<article[\s\S]*?<\/article>/i)
    let mainMatch = withoutScripts.match(/<main[\s\S]*?<\/main>/i)
    let bodyMatch = withoutScripts.match(/<body[\s\S]*?<\/body>/i)
    let candidate = articleMatch?.[0] || mainMatch?.[0] || bodyMatch?.[0] || withoutScripts
    let preview = cleanText(candidate || '')

    if (!preview)
        return null

    return candidate.trim() || null
}

async function extractReadableArticleText(html: string, sourceUrl: string, options: { forceRegenerateImageDescriptions: boolean }) {
    let candidate = extractReadableArticleHtml(html) || html
    let withImageDescriptions = await replaceImagesWithDescriptionsWithOptions(candidate, sourceUrl, {
        forceRegenerate: options.forceRegenerateImageDescriptions
    })

    let text = withImageDescriptions
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<\/?(p|h1|h2|h3|h4|h5|h6|li|blockquote|section|article|main|div|br)[^>]*>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

    if (text.length < 120)
        return ''

    return text
}

function extractMetaTagContent(html: string, property: string) {
    let regex = new RegExp(`<meta[^>]+property=["']${escapeRegExp(property)}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i')
    let reverseRegex = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escapeRegExp(property)}["'][^>]*>`, 'i')
    return decodeHtmlEntities(regex.exec(html)?.[1] || reverseRegex.exec(html)?.[1] || '')
}

function extractMetaNameContent(html: string, name: string) {
    let regex = new RegExp(`<meta[^>]+name=["']${escapeRegExp(name)}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i')
    let reverseRegex = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escapeRegExp(name)}["'][^>]*>`, 'i')
    return decodeHtmlEntities(regex.exec(html)?.[1] || reverseRegex.exec(html)?.[1] || '')
}

function extractTagContent(html: string, tagName: string) {
    let match = html.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\/${tagName}>`, 'i'))
    return decodeHtmlEntities(match?.[1] || '')
}

function extractTimeDateTime(html: string) {
    let match = html.match(/<time[^>]+datetime=["']([^"']+)["'][^>]*>/i)
    return decodeHtmlEntities(match?.[1] || '')
}

function cleanText(value: string) {
    let stripped = value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    return stripped || null
}

function truncate(value: string | null, max: number) {
    if (!value)
        return null
    if (value.length > max)
        return value.substring(0, max - 3) + '...'
    return value
}

function normalizeDate(value: string) {
    if (!value)
        return null
    let parsed = new Date(value)
    if (Number.isNaN(parsed.getTime()))
        return null
    return parsed.toISOString()
}

function decodeHtmlEntities(value: string) {
    return value
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .trim()
}

function buildFallbackArticleTitle(sourceUrl: string) {
    try {
        let parsed = new URL(sourceUrl)
        let parts = parsed.pathname.split('/').filter(Boolean)
        let last = parts.at(-1)
        if (last)
            return cleanText(decodeURIComponent(last).replace(/[-_]+/g, ' '))

        return parsed.hostname.replace(/^www\./i, '')
    }
    catch {
        return ''
    }
}

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}