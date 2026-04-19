import { array, nullable, object, optional, string, type InferOutput } from "valibot"
import { fetchJson } from "../http/request"
import { type TtsProviderSettings, type VoiceRecord } from "../settings/settings-types"
import { createChunkedSpeechStream } from "./chunked-speech"
import { type StreamSpeechOptions } from "./tts"
import { detectGenderFromName } from "./tts-utils"
import { convertWavToMp3Bytes } from "./wav-to-mp3"

let voiceboxAudioRetryDelayMs = 500
let voiceboxAudioRetryWindowMs = 30000
let voiceboxMaxChunkChars = 2000

let VoiceboxProfileSchema = object({
    id: string(),
    name: string(),
    description: optional(nullable(string())),
    language: string(),
    default_engine: optional(nullable(string()))
})
type VoiceboxProfile = InferOutput<typeof VoiceboxProfileSchema>

type ResolvedVoiceboxVoice = {
    profileId: string
    engine: string | null
}

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
    let response = await listVoiceboxProfiles(settings)
    return response.map(profile => mapVoiceboxProfile(profile))
}

export async function streamVoiceboxSpeech(providerVoiceId: string, text: string, settings: TtsProviderSettings, options?: StreamSpeechOptions): Promise<{ stream: ReadableStream<Uint8Array>; mimeType: string }> {
    let voice = await resolveVoiceboxVoice(providerVoiceId, settings)
    let stream = createChunkedSpeechStream(
        text,
        voiceboxMaxChunkChars,
        async chunk => await fetchVoiceboxChunkStream(voice, chunk, settings),
        options
    )

    return {
        stream,
        mimeType: 'audio/mpeg'
    }
}

async function fetchVoiceboxChunkStream(voice: ResolvedVoiceboxVoice, text: string, settings: TtsProviderSettings) {
    let response = await fetchVoiceboxStreamResponse(voice, text, settings)
    let converted = await convertVoiceboxWavResponseToMp3(response)
    return converted.stream
}

async function fetchVoiceboxStreamResponse(voice: ResolvedVoiceboxVoice, text: string, settings: TtsProviderSettings) {
    let requestBody = JSON.stringify(buildVoiceboxGenerationRequest(voice, text))
    let streamResponse = await fetch(buildVoiceboxRequestUrl(settings.baseUrl, '/generate/stream'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'audio/wav'
        },
        body: requestBody
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
            body: requestBody
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

async function listVoiceboxProfiles(settings: TtsProviderSettings) {
    return await fetchJson(
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
}

async function resolveVoiceboxVoice(providerVoiceId: string, settings: TtsProviderSettings): Promise<ResolvedVoiceboxVoice> {
    let parsed = parseVoiceboxProviderVoiceId(providerVoiceId)
    if (parsed.engine)
        return parsed

    return {
        profileId: parsed.profileId,
        engine: normalizeVoiceboxEngine((await getVoiceboxProfile(parsed.profileId, settings)).default_engine)
    }
}

async function getVoiceboxProfile(profileId: string, settings: TtsProviderSettings) {
    return await fetchJson(
        'Voicebox profile',
        VoiceboxProfileSchema,
        settings.baseUrl,
        `/profiles/${encodeURIComponent(profileId)}`,
        {
            headers: {
                Accept: 'application/json'
            }
        }
    )
}

function buildVoiceboxGenerationRequest(voice: ResolvedVoiceboxVoice, text: string) {
    return {
        profile_id: voice.profileId,
        text,
        max_chunk_chars: voiceboxMaxChunkChars,
        ...(voice.engine ? { engine: voice.engine } : {})
    }
}

function parseVoiceboxProviderVoiceId(providerVoiceId: string): ResolvedVoiceboxVoice {
    let separatorIndex = providerVoiceId.indexOf('::')
    if (separatorIndex == -1) {
        return {
            profileId: providerVoiceId,
            engine: null
        }
    }

    return {
        profileId: providerVoiceId.slice(0, separatorIndex),
        engine: normalizeVoiceboxEngine(providerVoiceId.slice(separatorIndex + 2))
    }
}

function normalizeVoiceboxEngine(engine: string | null | undefined) {
    let normalized = engine?.trim() || ''
    return normalized || null
}

function isRetryableVoiceboxAudioStatus(status: number) {
    return status == 400 || status == 404 || status == 409 || status == 425
}

function buildVoiceboxRequestUrl(baseUrl: string, endpoint: string) {
    let normalizedBase = baseUrl.trim().replace(/\/+$/, '')
    let normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    return normalizedBase + normalizedEndpoint
}
