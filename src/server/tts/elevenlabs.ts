import { array, boolean, object, optional, picklist, string, type InferOutput } from "valibot"
import { fetchJson, fetchStream } from "../http/request"
import { voiceGenders, type TtsProviderSettings, type VoiceRecord } from "../settings/settings-types"
import { detectGenderFromName } from "./tts-utils"

let ElevenLabsVoiceSchema = object({
    voice_id: string(),
    name: optional(string()),
    description: optional(string()),
    labels: optional(object({
        gender: optional(picklist(voiceGenders)),
        description: optional(string())
    }))
})
type ElevenLabsVoice = InferOutput<typeof ElevenLabsVoiceSchema>

let ElevenLabsSearchVoicesResponseSchema = object({
    voices: array(ElevenLabsVoiceSchema),
    has_more: optional(boolean()),
    next_page_token: optional(string())
})
type ElevenLabsSearchVoicesResponse = InferOutput<typeof ElevenLabsSearchVoicesResponseSchema>

export let elevenLabsDefaults: TtsProviderSettings = {
    enabled: false,
    apiKey: '',
    baseUrl: 'https://api.elevenlabs.io'
}

export async function listElevenLabsVoices(settings: TtsProviderSettings): Promise<VoiceRecord[]> {
    let voices: VoiceRecord[] = []
    let nextPageToken: string | null = null

    while (true) {
        let response: ElevenLabsSearchVoicesResponse = await fetchJson(
            'ElevenLabs voices',
            ElevenLabsSearchVoicesResponseSchema,
            settings.baseUrl,
            buildElevenLabsSearchEndpoint(nextPageToken),
            {
                headers: {
                    'xi-api-key': settings.apiKey,
                    Accept: 'application/json'
                }
            }
        )

        voices.push(...response.voices.map((entry: ElevenLabsVoice) => mapElevenLabsVoice(entry)))

        if (!response.has_more)
            return voices

        let token: string | undefined = response.next_page_token
        if (!token)
            return voices

        nextPageToken = token
    }
}

function mapElevenLabsVoice(entry: ElevenLabsVoice): VoiceRecord {
    let providerVoiceId = entry.voice_id
    let name = entry.name || ''
    let description = entry.description || entry.labels?.description || ''

    let gender = entry.labels?.gender ?? detectGenderFromName(name)

    return {
        id: `elevenlabs:${providerVoiceId}`,
        provider: 'elevenlabs',
        providerVoiceId,
        name,
        description,
        gender
    }
}

export async function streamElevenLabsSpeech(providerVoiceId: string, text: string, settings: TtsProviderSettings): Promise<{ stream: ReadableStream<Uint8Array>; mimeType: string }> {
    let stream = await fetchStream(
        'ElevenLabs speech stream',
        settings.baseUrl,
        `/v1/text-to-speech/${providerVoiceId}/stream?output_format=mp3_44100_128`,
        {
            method: 'POST',
            headers: {
                'xi-api-key': settings.apiKey,
                'Content-Type': 'application/json',
                Accept: 'audio/mpeg'
            },
            body: JSON.stringify({
                text,
                model_id: 'eleven_multilingual_v2'
            })
        }
    )

    return {
        stream,
        mimeType: 'audio/mpeg'
    }
}

function buildElevenLabsSearchEndpoint(nextPageToken: string | null) {
    let query = new URLSearchParams()
    query.set('page_size', '100')
    query.set('include_total_count', 'false')

    if (nextPageToken)
        query.set('next_page_token', nextPageToken)

    return `/v2/voices?${query.toString()}`
}