import { Result } from "better-result"
import { type TtsProviderSettings, type VoiceRecord } from "../settings/settings-types"
import { buildUrl, detectGenderFromName, normalizeReportedGender } from "./tts-utils"

export let elevenLabsDefaults: TtsProviderSettings = {
    enabled: false,
    apiKey: '',
    baseUrl: 'https://api.elevenlabs.io'
}

export async function listElevenLabsVoices(settings: TtsProviderSettings): Promise<Result<VoiceRecord[], string>> {
    let endpoint = buildUrl(settings.baseUrl, '/v1/voices')
    try {
        let response = await fetch(endpoint, {
            headers: {
                'xi-api-key': settings.apiKey,
                Accept: 'application/json'
            }
        })

        if (!response.ok)
            return Result.err('ElevenLabs voice API request failed')

        let payload = await response.json() as Record<string, unknown>
        let entries = Array.isArray(payload.voices) ? payload.voices : []
        let voices = entries
            .map(entry => mapElevenLabsVoice(entry))
            .filter((voice): voice is VoiceRecord => voice != null)

        return Result.ok(voices)
    }
    catch {
        return Result.err('ElevenLabs voice API request failed')
    }
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

function getString(value: unknown) {
    if (typeof value == 'string') {
        let trimmed = value.trim()
        if (trimmed)
            return trimmed
    }

    return null
}
