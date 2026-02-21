import { boolean, check, object, pipe, string, trim, type InferOutput } from "valibot"

export let ttsProviders = ['inworld', 'openai', 'elevenlabs', 'lemonfox'] as const
export type TtsProvider = (typeof ttsProviders)[number]

export type TtsProviderSettings = {
    enabled: boolean
    apiKey: string
    baseUrl: string
}

export type SettingsState = Record<TtsProvider, TtsProviderSettings>

let ProviderSettingsInput = object({
    enabled: boolean(),
    apiKey: pipe(string(), trim()),
    baseUrl: pipe(string(), trim())
})

export type SettingsInput = InferOutput<typeof SettingsInput>
export const SettingsInput = object({
    settings: object({
        inworld: ProviderSettingsInput,
        openai: ProviderSettingsInput,
        elevenlabs: ProviderSettingsInput,
        lemonfox: ProviderSettingsInput
    })
})

export type VoiceGender = 'male' | 'female' | 'unknown'
export type VoiceRecord = {
    id: string
    provider: TtsProvider
    providerVoiceId: string
    name: string
    description: string
    gender: VoiceGender
}

export type VoiceIdInput = InferOutput<typeof VoiceIdInput>
export const VoiceIdInput = object({
    voice: pipe(
        string('Voice is required'),
        trim(),
        check(value => value == 'default' || /^(inworld|openai|elevenlabs|lemonfox):.+$/.test(value), 'Voice must be provider-scoped')
    )
})
