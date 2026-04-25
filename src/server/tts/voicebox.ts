import { array, nullable, object, optional, string, type InferOutput } from "valibot"
import { fetchJson } from "../http/request"
import { type TtsProviderSettings, type VoiceRecord } from "../settings/settings-types"
import { createChunkedSpeechStream } from "./chunked-speech"
import { type StreamSpeechOptions } from "./tts"
import { detectGenderFromName } from "./tts-utils"
import { convertWavToMp3Bytes } from "./wav-to-mp3"

let voiceboxMaxChunkChars = 500

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
    language: string
}

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
    let wavBytes = await fetchVoiceboxChunkBytes(voice, text, settings)
    let mp3Bytes: Uint8Array
    try {
        mp3Bytes = convertWavToMp3Bytes(wavBytes)
    } catch (error) {
        let message = error instanceof Error ? error.message : 'Voicebox stream returned invalid audio'
        throw new Error(`Voicebox streaming response failed: ${message}`)
    }

    return new ReadableStream<Uint8Array>({
        start(controller) {
            controller.enqueue(mp3Bytes)
            controller.close()
        }
    })
}

async function fetchVoiceboxChunkBytes(voice: ResolvedVoiceboxVoice, text: string, settings: TtsProviderSettings) {
    try {
        let streamResponse = await fetch(buildVoiceboxRequestUrl(settings.baseUrl, '/generate/stream'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'audio/wav'
            },
            body: JSON.stringify(buildVoiceboxGenerationRequest(voice, text)),
            ...{ timeout: false }
        })

        if (!streamResponse.ok)
            await handleStreamError(streamResponse)

        let wavBytes: Uint8Array
        try {
            wavBytes = new Uint8Array(await streamResponse.arrayBuffer())
        } catch (error) {
            let message = error instanceof Error ? error.message : 'stream read failed'
            throw new Error(`Voicebox streaming response failed while reading audio: ${message}`)
        }

        if (wavBytes.byteLength == 0)
            throw new Error('Voicebox generated audio was empty')

        return wavBytes
    } catch (error) {
        if (error instanceof Error)
            throw error

        throw new Error('Voicebox streaming response failed')
    }
}

async function handleStreamError(streamResponse: Response) {
    let details = ''
    try {
        let body = await streamResponse.text()
        let trimmed = body.trim()
        if (trimmed) {
            try {
                let parsed = JSON.parse(trimmed) as { detail?: unknown; error?: unknown; message?: unknown }
                let candidates = [parsed.detail, parsed.error, parsed.message]
                let detail = candidates.find(value => typeof value == 'string' && value.trim())
                details = typeof detail == 'string' ? detail.trim() : trimmed
            } catch {
                details = trimmed
            }
        }
    } catch {
    }

    if (streamResponse.status == 404 || streamResponse.status == 405)
        throw new Error('Voicebox streaming endpoint is not available for this engine')

    throw new Error(details
        ? `Voicebox speech generation request failed: ${streamResponse.status} ${streamResponse.statusText} - ${details}`
        : `Voicebox speech generation request failed: ${streamResponse.status} ${streamResponse.statusText}`)
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
    let profile = await getVoiceboxProfile(parsed.profileId, settings)

    return {
        profileId: parsed.profileId,
        engine: parsed.engine || normalizeVoiceboxEngine(profile.default_engine),
        language: normalizeVoiceboxLanguage(profile.language)
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
        language: voice.language,
        max_chunk_chars: voiceboxMaxChunkChars,
        ...(voice.engine ? { engine: voice.engine } : {})
    }
}

function parseVoiceboxProviderVoiceId(providerVoiceId: string): ResolvedVoiceboxVoice {
    let separatorIndex = providerVoiceId.indexOf('::')
    if (separatorIndex == -1) {
        return {
            profileId: providerVoiceId,
            engine: null,
            language: 'en'
        }
    }

    return {
        profileId: providerVoiceId.slice(0, separatorIndex),
        engine: normalizeVoiceboxEngine(providerVoiceId.slice(separatorIndex + 2)),
        language: 'en'
    }
}

function normalizeVoiceboxEngine(engine: string | null | undefined) {
    let normalized = engine?.trim() || ''
    return normalized || null
}

function normalizeVoiceboxLanguage(language: string | null | undefined) {
    let normalized = language?.trim()
    return normalized || 'en'
}

function buildVoiceboxRequestUrl(baseUrl: string, endpoint: string) {
    let normalizedBase = baseUrl.trim().replace(/\/+$/, '')
    let normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    return normalizedBase + normalizedEndpoint
}
