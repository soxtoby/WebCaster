import { Result } from "better-result"
import type { BunRequest } from "bun"
import { safeParse } from "valibot"
import { FeedInput } from "./FeedInput"
import { createFeed as createFeedRecord, deleteFeedById, listFeeds as listFeedRecords, updateFeedById } from "./repository"

export async function listFeeds() {
    return Response.json({ feeds: listFeedRecords() }, { status: 200 })
}

export async function createFeed(request: BunRequest<'/api/feeds'>) {
    let parsed = await parseAndValidateFeed(request)
    if (Result.isError(parsed))
        return Response.json({ error: parsed.error }, { status: 400 })

    let input = await withResolvedFeedName(parsed.value)
    if (Result.isError(input))
        return Response.json({ error: input.error }, { status: 400 })

    let feed = createFeedRecord(input.value)
    return Response.json({ feed }, { status: 201 })
}

export async function updateFeed(request: BunRequest<'/api/feeds/:id'>) {
    let id = getRouteId(request)
    if (Result.isError(id))
        return Response.json({ error: id.error }, { status: 400 })

    let parsed = await parseAndValidateFeed(request)
    if (Result.isError(parsed))
        return Response.json({ error: parsed.error }, { status: 400 })

    let input = await withResolvedFeedName(parsed.value)
    if (Result.isError(input))
        return Response.json({ error: input.error }, { status: 400 })

    let updated = updateFeedById(id.value, input.value)
    if (updated)
        return Response.json({ feed: updated }, { status: 200 })

    return Response.json({ error: 'Feed not found' }, { status: 404 })
}

export async function deleteFeed(request: BunRequest<'/api/feeds/:id'>) {
    let id = getRouteId(request)
    if (Result.isError(id))
        return Response.json({ error: id.error }, { status: 400 })

    let deleted = deleteFeedById(id.value)
    if (deleted)
        return new Response(null, { status: 204 })

    return Response.json({ error: 'Feed not found' }, { status: 404 })
}

function getRouteId(request: BunRequest<'/api/feeds/:id'>): Result<number, string> {
    let id = Number(request.params.id)
    if (Number.isInteger(id) && id > 0)
        return Result.ok(id)

    return Result.err('Invalid feed id')
}

async function parseAndValidateFeed(request: BunRequest): Promise<Result<FeedInput, string>> {
    let body: unknown = null
    try {
        body = await request.json()
    } catch {
        return Result.err('Invalid JSON body')
    }

    if (typeof body == 'object' && body != null) {
        let parsed = safeParse(FeedInput, body)

        if (!parsed.success) {
            let issue = parsed.issues[0]
            return issue
                ? Result.err(issue.message)
                : Result.err('Invalid request body')
        }

        return Result.ok(parsed.output)
    }

    return Result.err('JSON object body is required')
}

async function withResolvedFeedName(input: FeedInput): Promise<Result<FeedInput, string>> {
    if (input.name)
        return Result.ok(input)

    let title = await fetchFeedTitle(input.rssUrl)
    if (Result.isError(title)) {
        let fallbackName = buildFallbackFeedName(input.rssUrl)
        if (!fallbackName)
            return Result.err('Feed name is required and could not be inferred from source feed')

        return Result.ok({
            ...input,
            name: fallbackName
        })
    }

    return Result.ok({
        ...input,
        name: title.value
    })
}

async function fetchFeedTitle(rssUrl: string): Promise<Result<string, string>> {
    try {
        let response = await fetch(rssUrl, {
            headers: {
                Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5'
            }
        })

        if (!response.ok)
            return Result.err('Feed name is required and could not be inferred from source feed')

        let xml = await response.text()
        let title = extractFeedTitle(xml)
        if (!title)
            return Result.err('Feed name is required and could not be inferred from source feed')

        return Result.ok(title)
    }
    catch {
        return Result.err('Feed name is required and could not be inferred from source feed')
    }
}

function extractFeedTitle(xml: string) {
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

    return ''
}

function cleanFeedTitle(rawTitle: string) {
    let withoutCdata = rawTitle.replace(/^<!\[CDATA\[|\]\]>$/g, '')
    let withoutTags = withoutCdata.replace(/<[^>]+>/g, '')
    let collapsedWhitespace = withoutTags.replace(/\s+/g, ' ').trim()
    if (!collapsedWhitespace)
        return ''

    return decodeXmlEntities(collapsedWhitespace)
}

function decodeXmlEntities(value: string) {
    return value
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
}

function buildFallbackFeedName(rssUrl: string) {
    try {
        let url = new URL(rssUrl)
        let hostname = url.hostname.replace(/^www\./i, '').trim()
        let pathParts = url.pathname.split('/').filter(Boolean)
        let lastPathPart = pathParts.at(-1)

        if (lastPathPart && lastPathPart.toLowerCase() != 'feed') {
            let cleanedPathPart = decodeURIComponent(lastPathPart).replace(/[-_]+/g, ' ').trim()
            if (cleanedPathPart)
                return `${hostname} ${cleanedPathPart}`
        }

        if (hostname)
            return hostname
    }
    catch {
    }

    return ''
}
