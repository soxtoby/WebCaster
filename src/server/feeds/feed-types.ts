import { check, type InferOutput, integer, minLength, minValue, number, object, pipe, string, trim, url } from "valibot"

let allowedVoices = ['default']
let allowedLanguages = ['en']

export type FeedInput = InferOutput<typeof FeedInput>
export const FeedInput = object({
    name: pipe(string(), trim()),
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