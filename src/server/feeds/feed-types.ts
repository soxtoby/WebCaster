import { check, type InferOutput, integer, minLength, minValue, number, object, pipe, string, trim, url } from "valibot"

export type FeedInput = InferOutput<typeof FeedInput>
export const FeedInput = object({
    name: pipe(string(), trim()),
    rssUrl: pipe(string('RSS URL is required'), trim(), minLength(1, 'RSS URL is required'), url('RSS URL must be a valid URL')),
    voice: pipe(
        string('Voice is required'),
        trim(),
        minLength(1, 'Voice is required')
    ),
    generationMode: pipe(
        string('Generation mode is required'),
        trim(),
        check((value) => value == 'on_demand' || value == 'every_episode', 'Generation mode must be on_demand or every_episode')
    ),
    contentSource: pipe(
        string('Content source is required'),
        trim(),
        check((value) => value == 'feed_article' || value == 'source_page', 'Content source must be feed_article or source_page')
    )
})

export type FeedIdInput = InferOutput<typeof FeedIdInput>
export const FeedIdInput = object({
    id: pipe(
        number('Invalid feed id'),
        integer('Invalid feed id'),
        minValue(1, 'Invalid feed id'))
})

export type FeedUpdateInput = InferOutput<typeof FeedUpdateInput>
export const FeedUpdateInput = object({
    ...FeedIdInput.entries,
    ...FeedInput.entries
})

export type EpisodeVoiceInput = InferOutput<typeof EpisodeVoiceInput>
export const EpisodeVoiceInput = object({
    ...FeedIdInput.entries,
    episodeKey: pipe(string('Episode key is required'), trim(), minLength(1, 'Episode key is required')),
    voice: pipe(string(), trim())
})

export type EpisodeTranscriptInput = InferOutput<typeof EpisodeTranscriptInput>
export const EpisodeTranscriptInput = object({
    ...FeedIdInput.entries,
    episodeKey: pipe(string('Episode key is required'), trim(), minLength(1, 'Episode key is required'))
})

