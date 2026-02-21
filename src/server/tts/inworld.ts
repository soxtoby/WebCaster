import { Result } from "better-result"
import { array, object, safeParse, string, type InferOutput } from "valibot"
import { type TtsProviderSettings, type VoiceRecord } from "../settings/settings-types"
import { buildUrl, detectGenderFromName } from "./tts-utils"

type InworldVoice = InferOutput<typeof InworldVoice>
let InworldVoice = object({
    voiceId: string(),
    langCode: string(),
    displayName: string(),
    description: string(),
    tags: array(string()),
    name: string()
})

let InworldListVoicesResponse = object({
    voices: array(InworldVoice)
})


export let inworldDefaults: TtsProviderSettings = {
    enabled: false,
    apiKey: '',
    baseUrl: 'https://api.inworld.ai'
}

export async function listInworldVoices(settings: TtsProviderSettings): Promise<Result<VoiceRecord[], string>> {
    try {
        let response = await fetch(buildUrl(settings.baseUrl, '/voices/v1/voices'), {
            headers: {
                Authorization: `Basic ${settings.apiKey.trim()}`,
                Accept: 'application/json'
            }
        })

        if (!response.ok)
            return Result.err('Inworld voice API request failed')

        let payload = await response.json()
        let parsed = safeParse(InworldListVoicesResponse, payload)
        if (!parsed.success) {
            console.error('Inworld voice API response validation failed', parsed.issues)
            return Result.err('Inworld voice API response was invalid')
        }

        return Result.ok(parsed.output.voices
            .map(entry => mapInworldVoice(entry)))
    }
    catch {
        return Result.err('Inworld voice API request failed')
    }
}

function mapInworldVoice(entry: InworldVoice): VoiceRecord {
    let providerVoiceId = entry.voiceId
    let name = entry.displayName || entry.name || providerVoiceId
    let description = entry.description
    let gender = detectGenderFromName(name)

    return {
        id: `inworld:${providerVoiceId}`,
        provider: 'inworld',
        providerVoiceId,
        name,
        description,
        gender
    }
}
