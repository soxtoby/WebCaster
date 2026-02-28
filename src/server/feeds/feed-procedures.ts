import { TRPCError } from "@trpc/server"
import { procedure } from "../trpc/trpc"
import { fetchFeed, type ParsedFeedArticle } from "./feed-parsing"
import { insertFeedArticles, listFeedEpisodes } from "./feed-podcast"
import { FeedIdInput, FeedInput, FeedUpdateInput } from "./feed-types"
import { createFeed as createFeedRecord, deleteFeedById as deleteFeedRecordById, getFeedById as getFeedRecordById, listFeeds as listFeedRecords, updateFeedById as updateFeedRecordById } from "./feed-repository"

type EnrichedFeedInput = FeedInput & { description?: string | null; imageUrl?: string | null }

export const list = procedure
    .query(() => ({ feeds: listFeedRecords() }));

export const create = procedure
    .input(FeedInput)
    .mutation(async ({ input }) => {
        let result: EnrichResult
        try {
            result = await withFeedMetadata(input)
        } catch (error) {
            let message = error instanceof Error ? error.message : 'Feed metadata enrichment failed'
            throw new TRPCError({ code: 'BAD_REQUEST', message })
        }

        let feed = createFeedRecord(result.enriched)
        if (result.articles.length > 0)
            insertFeedArticles(feed.id, feed.generationMode, feed.contentSource, result.articles)

        return { feed }
    })

export const update = procedure
    .input(FeedUpdateInput)
    .mutation(async ({ input }) => {
        let result: EnrichResult
        try {
            result = await withFeedMetadata(input)
        } catch (error) {
            let message = error instanceof Error ? error.message : 'Feed metadata enrichment failed'
            throw new TRPCError({ code: 'BAD_REQUEST', message })
        }

        let feed = updateFeedRecordById(input.id, result.enriched)
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

export const episodes = procedure
    .input(FeedIdInput)
    .query(async ({ input }) => {
        let feed = getFeedRecordById(input.id)
        if (!feed)
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Feed not found' })

        return {
            podcastUrl: `/feed/${feed.podcastSlug}`,
            episodes: await listFeedEpisodes(feed.id)
        }
    })

type EnrichResult = { enriched: EnrichedFeedInput; articles: ParsedFeedArticle[] }

async function withFeedMetadata(input: FeedInput): Promise<EnrichResult> {
    let parsed = await fetchFeed(input.rssUrl)

    if (!parsed) {
        if (!input.name) {
            let fallbackName = buildFallbackFeedName(input.rssUrl)
            if (!fallbackName)
                throw new Error('Feed name is required and could not be inferred from source feed')

            return {
                enriched: { ...input, name: fallbackName },
                articles: []
            }
        }
        return { enriched: input, articles: [] }
    }

    let name = input.name || parsed.title
    if (!name) {
        let fallbackName = buildFallbackFeedName(input.rssUrl)
        if (!fallbackName)
            throw new Error('Feed name is required and could not be inferred from source feed')
        name = fallbackName
    }

    return {
        enriched: {
            ...input,
            name,
            description: parsed.description,
            imageUrl: parsed.imageUrl
        },
        articles: parsed.articles
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