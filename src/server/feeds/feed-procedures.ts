import { TRPCError } from "@trpc/server"
import { procedure } from "../trpc/trpc"
import { fetchFeed, type ParsedFeedArticle } from "./feed-parsing"
import { addManualArticle, getEpisodeTranscript, insertFeedArticles, listFeedEpisodes, regenerateEpisodeTranscript as rebuildEpisodeTranscript, removeManualArticle, setEpisodeVoiceOverride, updateEpisodeTranscript as saveEpisodeTranscript } from "./feed-podcast"
import { createFeed as createFeedRecord, deleteFeedById as deleteFeedRecordById, getFeedById as getFeedRecordById, listFeeds as listFeedRecords, updateFeedById as updateFeedRecordById } from "./feed-repository"
import { AddManualArticleInput, EpisodeTranscriptInput, EpisodeTranscriptUpdateInput, EpisodeVoiceInput, FeedIdInput, FeedInput, FeedUpdateInput, RemoveManualArticleInput } from "./feed-types"

type EnrichedFeedInput = FeedInput & { description?: string | null; imageUrl?: string | null }

export const list = procedure
    .query(() => ({ feeds: listFeedRecords() }))

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
            await insertFeedArticles(feed.id, feed.generationMode, feed.contentSource, result.articles)

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

export const addArticle = procedure
    .input(AddManualArticleInput)
    .mutation(async ({ input }) => {
        let result = await addManualArticle(input.id, input.url)

        if (!result.ok) {
            if (result.reason == 'feed_not_found')
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Feed not found' })

            if (result.reason == 'feed_not_custom')
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Manual article URLs are only supported for custom feeds' })

            if (result.reason == 'duplicate_article')
                throw new TRPCError({ code: 'CONFLICT', message: 'That article URL is already in this feed' })

            if (result.reason == 'article_fetch_failed')
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Could not read article content from that URL' })

            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to add article' })
        }

        return {
            episodeKey: result.episodeKey,
            title: result.title,
            sourceUrl: result.sourceUrl
        }
    })

export const removeArticle = procedure
    .input(RemoveManualArticleInput)
    .mutation(async ({ input }) => {
        let result = await removeManualArticle(input.id, input.episodeKey)

        if (!result.ok) {
            if (result.reason == 'feed_not_found')
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Feed not found' })

            if (result.reason == 'feed_not_custom')
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Articles can only be removed from custom feeds' })

            if (result.reason == 'article_not_found')
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Article not found' })

            if (result.reason == 'article_generating')
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Wait for generation to finish before removing this article' })

            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to remove article' })
        }

        return { success: true }
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

export const setEpisodeVoice = procedure
    .input(EpisodeVoiceInput)
    .mutation(async ({ input }) => {
        let voiceId = input.voice || null
        let result = await setEpisodeVoiceOverride(input.id, input.episodeKey, voiceId)

        if (!result.updated) {
            if (result.reason == 'feed_not_found')
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Feed not found' })

            if (result.reason == 'episode_not_found')
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Episode not found' })

            if (result.reason == 'voice_not_found')
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Voice not found' })
        }

        return { success: true }
    })

export const episodeTranscript = procedure
    .input(EpisodeTranscriptInput)
    .query(async ({ input }) => {
        let result = await getEpisodeTranscript(input.id, input.episodeKey)

        if (!result.ok) {
            if (result.reason == 'feed_not_found')
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Feed not found' })

            if (result.reason == 'episode_not_found')
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Episode not found' })
        }

        return {
            transcript: result.transcript,
            title: result.title,
            sourceUrl: result.sourceUrl
        }
    })

export const regenerateEpisodeTranscript = procedure
    .input(EpisodeTranscriptInput)
    .mutation(async ({ input }) => {
        let result = await rebuildEpisodeTranscript(input.id, input.episodeKey)

        if (!result.ok) {
            if (result.reason == 'feed_not_found')
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Feed not found' })

            if (result.reason == 'episode_not_found')
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Episode not found' })
        }

        return {
            transcript: result.transcript,
            title: result.title,
            sourceUrl: result.sourceUrl
        }
    })

export const updateEpisodeTranscript = procedure
    .input(EpisodeTranscriptUpdateInput)
    .mutation(async ({ input }) => {
        let result = await saveEpisodeTranscript(input.id, input.episodeKey, input.transcript)

        if (!result.ok) {
            if (result.reason == 'feed_not_found')
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Feed not found' })

            if (result.reason == 'episode_not_found')
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Episode not found' })
        }

        return {
            transcript: result.transcript,
            title: result.title,
            sourceUrl: result.sourceUrl
        }
    })

type EnrichResult = { enriched: EnrichedFeedInput; articles: ParsedFeedArticle[] }

async function withFeedMetadata(input: FeedInput): Promise<EnrichResult> {
    if (input.contentSource == 'custom') {
        if (!input.name)
            throw new Error('Name is required for custom feeds')

        return {
            enriched: {
                ...input,
                rssUrl: '',
                description: 'Custom feed',
                imageUrl: null
            },
            articles: []
        }
    }

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

