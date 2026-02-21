import { TRPCError } from "@trpc/server"
import { Result } from "better-result"
import { procedure } from "../trpc/trpc"
import { FeedIdInput, FeedInput, FeedUpdateInput } from "./feed-types"
import { createFeed as createFeedRecord, deleteFeedById as deleteFeedRecordById, listFeeds as listFeedRecords, updateFeedById as updateFeedRecordById } from "./feed-repository"

export const list = procedure
    .query(() => ({ feeds: listFeedRecords() }));

export const create = procedure
    .input(FeedInput)
    .mutation(async ({ input }) => {
        let enriched = await withFeedMetadata(input)

        if (enriched.isErr())
            throw new TRPCError({ code: 'BAD_REQUEST', message: enriched.error })

        return { feed: createFeedRecord(enriched.value) }
    })

export const update = procedure
    .input(FeedUpdateInput)
    .mutation(async ({ input }) => {
        let enriched = await withFeedMetadata(input)
        if (enriched.isErr())
            throw new TRPCError({ code: 'BAD_REQUEST', message: enriched.error })

        let feed = updateFeedRecordById(input.id, enriched.value)
        if (feed)
            return { feed }

        throw new TRPCError({ code: 'NOT_FOUND', message: 'Feed not found' })
    })

export const deleteFeed = procedure
    .input(FeedIdInput)
    .mutation(async ({ input }) => {
        let deleted = deleteFeedRecordById(input.id)
        if (deleted)
            return { success: true }

        throw new TRPCError({ code: 'NOT_FOUND', message: 'Feed not found' })
    })

async function withFeedMetadata(input: FeedInput): Promise<Result<FeedInput, string>> {
    let metadata = await fetchFeedMetadata(input.rssUrl)

    if (metadata.isErr()) {
        if (!input.name) {
            let fallbackName = buildFallbackFeedName(input.rssUrl)
            if (!fallbackName)
                return Result.err('Feed name is required and could not be inferred from source feed')

            return Result.ok({
                ...input,
                name: fallbackName
            })
        }
        return Result.ok(input)
    }

    let name = input.name || metadata.value.title
    if (!name) {
        let fallbackName = buildFallbackFeedName(input.rssUrl)
        if (!fallbackName)
            return Result.err('Feed name is required and could not be inferred from source feed')
        name = fallbackName
    }

    return Result.ok({
        ...input,
        name,
        description: metadata.value.description,
        imageUrl: metadata.value.imageUrl
    })
}

type FeedMetadata = {
    title: string | null
    description: string | null
    imageUrl: string | null
}

async function fetchFeedMetadata(rssUrl: string): Promise<Result<FeedMetadata, string>> {
    try {
        let response = await fetch(rssUrl, {
            headers: {
                Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5'
            }
        })

        if (!response.ok)
            return Result.err('Could not fetch feed metadata')

        let xml = await response.text()
        let title = extractFeedTitle(xml)
        let imageUrl = extractFeedImage(xml)
        let description = extractFeedDescription(xml)

        return Result.ok({ title, imageUrl, description })
    }
    catch {
        return Result.err('Could not fetch feed metadata')
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

function decodeXmlEntities(value: string) {
    return value
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
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