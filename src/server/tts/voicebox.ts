import { array, nullable, object, optional, string, type InferOutput } from "valibot"
import { fetchJson, fetchResponse } from "../http/request"
import { type TtsProviderSettings, type VoiceRecord } from "../settings/settings-types"
import { detectGenderFromName } from "./tts-utils"
import { convertWavToMp3Bytes } from "./wav-to-mp3"

let voiceboxAudioRetryDelayMs = 500
let voiceboxAudioRetryWindowMs = 30000

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
    let response = await fetchVoiceboxStreamResponse(providerVoiceId, text, settings)
    return await convertVoiceboxWavResponseToMp3(response)
}

async function fetchVoiceboxStreamResponse(providerVoiceId: string, text: string, settings: TtsProviderSettings) {
    let streamResponse = await fetch(buildVoiceboxRequestUrl(settings.baseUrl, '/generate/stream'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'audio/wav'
        },
        body: JSON.stringify({
            profile_id: providerVoiceId,
            text
        })
    })

    if (streamResponse.ok)
        return streamResponse

    if (streamResponse.status != 404 && streamResponse.status != 405)
        throw new Error(`Voicebox speech generation request failed: ${streamResponse.status} ${streamResponse.statusText}`)

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

    return await waitForVoiceboxGeneratedAudio(generation.id, settings)
}

async function convertVoiceboxWavResponseToMp3(response: Response) {
    let wavBytes = new Uint8Array(await response.arrayBuffer())
    if (wavBytes.byteLength == 0)
        throw new Error('Voicebox generated audio was empty')

    let mp3Bytes = convertWavToMp3Bytes(wavBytes)
    let stream = new ReadableStream<Uint8Array>({
        start(controller) {
            controller.enqueue(mp3Bytes)
            controller.close()
        }
    })

    return {
        stream,
        mimeType: 'audio/mpeg'
    }
}

async function waitForVoiceboxGeneratedAudio(generationId: string, settings: TtsProviderSettings) {
    let startedAt = Date.now()
    let lastRetryableStatus = 0

    while (true) {
        let response = await fetch(buildVoiceboxRequestUrl(settings.baseUrl, `/audio/${generationId}`), {
            headers: {
                Accept: 'audio/wav'
            }
        })

        if (response.ok)
            return response

        if (!isRetryableVoiceboxAudioStatus(response.status))
            throw new Error(`Voicebox generated audio request failed: ${response.status} ${response.statusText}`)

        lastRetryableStatus = response.status
        if ((Date.now() - startedAt) >= voiceboxAudioRetryWindowMs)
            throw new Error(`Voicebox generated audio was not ready in time: ${lastRetryableStatus}`)

        await Bun.sleep(voiceboxAudioRetryDelayMs)
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

function isRetryableVoiceboxAudioStatus(status: number) {
    return status == 400 || status == 404 || status == 409 || status == 425
}

function buildVoiceboxRequestUrl(baseUrl: string, endpoint: string) {
    let normalizedBase = baseUrl.trim().replace(/\/+$/, '')
    let normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    return normalizedBase + normalizedEndpoint
}
