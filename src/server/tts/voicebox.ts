import { array, nullable, object, optional, string, type InferOutput } from "valibot"
import { fetchJson, fetchResponse } from "../http/request"
import { audioContentTypes, type AudioFileExtension } from "../paths"
import { type TtsProviderSettings, type VoiceRecord } from "../settings/settings-types"
import { detectGenderFromName } from "./tts-utils"

let VoiceboxProfileSchema = object({
    id: string(),
    name: string(),
    description: optional(nullable(string())),
    language: string()
})
type VoiceboxProfile = InferOutput<typeof VoiceboxProfileSchema>

let VoiceboxGenerationResponseSchema = object({
    id: string(),
    audio_path: string()
})
type VoiceboxGenerationResponse = InferOutput<typeof VoiceboxGenerationResponseSchema>

export let voiceboxDefaults: TtsProviderSettings = {
    enabled: false,
    apiKey: '',
    baseUrl: 'http://localhost:17493'
}

export async function listVoiceboxVoices(settings: TtsProviderSettings): Promise<VoiceRecord[]> {
    let response = await fetchJson(
        'Voicebox profiles',
        array(VoiceboxProfileSchema),
        settings.baseUrl,
        '/profiles',
        {
            headers: {
                Accept: 'application/json'
            }
        }
    )

    return response.map(profile => mapVoiceboxProfile(profile))
}

export async function streamVoiceboxSpeech(providerVoiceId: string, text: string, settings: TtsProviderSettings): Promise<{ stream: ReadableStream<Uint8Array>; mimeType: string }> {
    let generation: VoiceboxGenerationResponse = await fetchJson(
        'Voicebox speech generation',
        VoiceboxGenerationResponseSchema,
        settings.baseUrl,
        '/generate',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json'
            },
            body: JSON.stringify({
                profile_id: providerVoiceId,
                text
            })
        }
    )

    let response = await fetchResponse(
        'Voicebox generated audio',
        settings.baseUrl,
        `/audio/${generation.id}`,
        {
            headers: {
                Accept: 'audio/wav'
            }
        }
    )

    if (!response.body)
        throw new Error('Voicebox generated audio was empty')

    return {
        stream: response.body,
        mimeType: normalizeVoiceboxMimeType(response.headers.get('content-type'))
    }
}

function mapVoiceboxProfile(profile: VoiceboxProfile): VoiceRecord {
    let description = profile.description?.trim() || `Language: ${profile.language}`
    let gender = detectGenderFromName(profile.name, description)

    return {
        id: `voicebox:${profile.id}`,
        provider: 'voicebox',
        providerVoiceId: profile.id,
        name: profile.name,
        description,
        gender
    }
}

function normalizeVoiceboxMimeType(contentType: string | null) {
    let mimeType = ((contentType || '').split(';')[0] || '').trim().toLowerCase()
    let extension = audioExtensionFromMimeType(mimeType)
    return extension ? audioContentTypes[extension] : audioContentTypes.wav
}

function audioExtensionFromMimeType(mimeType: string): AudioFileExtension | null {
    if (mimeType == audioContentTypes.mp3 || mimeType == 'audio/mp3')
        return 'mp3'

    if (mimeType == audioContentTypes.wav || mimeType == 'audio/x-wav')
        return 'wav'

    return null
}