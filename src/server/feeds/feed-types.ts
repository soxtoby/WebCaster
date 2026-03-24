import { boolean, check, type InferOutput, integer, minLength, minValue, number, object, pipe, string, trim, url } from "valibot"

export type FeedInput = InferOutput<typeof FeedInput>
export const FeedInput = pipe(
    object({
        name: pipe(string(), trim()),
        rssUrl: pipe(string(), trim()),
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
        showArchivedEpisodes: boolean(),
        contentSource: pipe(
            string('Content source is required'),
            trim(),
            check((value) => value == 'feed_article' || value == 'source_page' || value == 'custom', 'Content source must be feed_article, source_page or custom')
        )
    }),
    check((input) => input.contentSource != 'custom' || input.name.length > 0, 'Name is required for custom feeds'),
    check((input) => input.contentSource == 'custom' || input.rssUrl.length > 0, 'RSS URL is required'),
    check((input) => input.contentSource == 'custom' || isValidHttpUrl(input.rssUrl), 'RSS URL must be a valid URL')
)

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

export type AddManualArticleInput = InferOutput<typeof AddManualArticleInput>
export const AddManualArticleInput = object({
    ...FeedIdInput.entries,
    url: pipe(string('Article URL is required'), trim(), minLength(1, 'Article URL is required'), url('Article URL must be a valid URL'))
})

export type RemoveManualArticleInput = InferOutput<typeof RemoveManualArticleInput>
export const RemoveManualArticleInput = object({
    ...FeedIdInput.entries,
    episodeKey: pipe(string('Episode key is required'), trim(), minLength(1, 'Episode key is required'))
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

export type EpisodeActionInput = InferOutput<typeof EpisodeActionInput>
export const EpisodeActionInput = object({
    ...FeedIdInput.entries,
    episodeKey: pipe(string('Episode key is required'), trim(), minLength(1, 'Episode key is required'))
})

export type EpisodeArchiveInput = InferOutput<typeof EpisodeArchiveInput>
export const EpisodeArchiveInput = object({
    ...EpisodeActionInput.entries,
    archived: boolean()
})

export type EpisodeTranscriptUpdateInput = InferOutput<typeof EpisodeTranscriptUpdateInput>
export const EpisodeTranscriptUpdateInput = object({
    ...EpisodeTranscriptInput.entries,
    transcript: string('Transcript is required')
})

function isValidHttpUrl(value: string) {
    try {
        let parsed = new URL(value)
        return parsed.protocol == 'http:' || parsed.protocol == 'https:'
    }
    catch {
        return false
    }
}

