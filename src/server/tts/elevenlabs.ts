import { array, object, unknown } from "valibot"
import { fetchJson, fetchStream } from "../http/request"
import { type TtsProviderSettings, type VoiceRecord } from "../settings/settings-types"
import { detectGenderFromName, normalizeReportedGender } from "./tts-utils"

let ElevenLabsListVoicesResponse = object({
    voices: array(unknown())
})

export let elevenLabsDefaults: TtsProviderSettings = {
    enabled: false,
    apiKey: '',
    baseUrl: 'https://api.elevenlabs.io'
}

export async function listElevenLabsVoices(settings: TtsProviderSettings): Promise<VoiceRecord[]> {
    let response = await fetchJson(
        'ElevenLabs voices',
        ElevenLabsListVoicesResponse,
        settings.baseUrl,
        '/v1/voices',
        {
            headers: {
                'xi-api-key': settings.apiKey,
                Accept: 'application/json'
            }
        }
    )
    let voices = response.voices
        .map(entry => mapElevenLabsVoice(entry))
        .filter((voice): voice is VoiceRecord => voice != null)

    return voices
}

function mapElevenLabsVoice(value: unknown): VoiceRecord | null {
    if (!value || typeof value != 'object')
        return null

    let entry = value as Record<string, unknown>
    let labels = entry.labels && typeof entry.labels == 'object' ? entry.labels as Record<string, unknown> : null
    let providerVoiceId = getString(entry.voice_id)
    if (!providerVoiceId)
        return null

    let name = getString(entry.name) || providerVoiceId
    let description = getString(entry.description) || getString(labels?.description) || ''
    let providedGender = getString(entry.gender) || getString(labels?.gender)
    let gender = normalizeReportedGender(providedGender)

    if (gender == 'unknown')
        gender = detectGenderFromName(name)

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

function getString(value: unknown) {
    if (typeof value == 'string') {
        let trimmed = value.trim()
        if (trimmed)
            return trimmed
    }

    return null
}
