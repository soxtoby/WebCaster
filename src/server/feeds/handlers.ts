import { Result } from "better-result"
import type { BunRequest } from "bun"
import { check, minLength, object, pipe, safeParse, string, trim, url } from "valibot"
import { createFeed as createFeedRecord, deleteFeedById, listFeeds as listFeedRecords, updateFeedById } from "./repository"

type FeedInput = {
    name: string
    rssUrl: string
    voice: string
    language: string
}

let allowedVoices = ['default']
let allowedLanguages = ['en']
let feedSchema = object({
    name: pipe(string('Name is required'), trim(), minLength(1, 'Name is required')),
    rssUrl: pipe(string('RSS URL is required'), trim(), minLength(1, 'RSS URL is required'), url('RSS URL must be a valid URL')),
    voice: pipe(
        string('Voice is required'),
        trim(),
        minLength(1, 'Voice is required'),
        check((value) => allowedVoices.includes(value), `Voice must be one of: ${allowedVoices.join(', ')}`)
    ),
    language: pipe(
        string('Language is required'),
        trim(),
        minLength(1, 'Language is required'),
        check((value) => allowedLanguages.includes(value), `Language must be one of: ${allowedLanguages.join(', ')}`)
    )
})

export async function listFeeds() {
    return Response.json({ feeds: listFeedRecords() }, { status: 200 })
}

export async function createFeed(request: BunRequest<'/api/feeds'>) {
    let parsed = await parseAndValidateFeed(request)
    if (Result.isError(parsed))
        return Response.json({ error: parsed.error }, { status: 400 })

    let feed = createFeedRecord(parsed.value)
    return Response.json({ feed }, { status: 201 })
}

export async function updateFeed(request: BunRequest<'/api/feeds/:id'>) {
    let id = getRouteId(request)
    if (Result.isError(id))
        return Response.json({ error: id.error }, { status: 400 })

    let parsed = await parseAndValidateFeed(request)
    if (Result.isError(parsed))
        return Response.json({ error: parsed.error }, { status: 400 })

    let updated = updateFeedById(id.value, parsed.value)
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
        let parsed = safeParse(feedSchema, body)
        
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
