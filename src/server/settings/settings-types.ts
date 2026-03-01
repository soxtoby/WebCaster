import { hostname as osHostname } from "os"
import { boolean, check, number, object, optional, pipe, string, trim, type InferOutput } from "valibot"

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

export type ServerSettings = {
    hostname: string
    port: number | null
    listenOnAllInterfaces: boolean
    passwordConfigured: boolean
}

export let defaultServerSettings = {
    hostname: osHostname(),
    port: 80,
    listenOnAllInterfaces: true,
    passwordConfigured: false
} as const satisfies ServerSettings

export type SettingsInput = InferOutput<typeof SettingsInput>
export const SettingsInput = object({
    settings: object({
        inworld: ProviderSettingsInput,
        openai: ProviderSettingsInput,
        elevenlabs: ProviderSettingsInput,
        lemonfox: ProviderSettingsInput
    }),
    server: object({
        hostname: pipe(string(), trim()),
        port: pipe(
            number('Port must be a number'),
            check(v => Number.isInteger(v) && v >= 1 && v <= 65535, 'Port must be between 1 and 65535')
        ),
        listenOnAllInterfaces: boolean(),
        password: optional(pipe(string(), trim()))
    })
})

export type VoiceGender = (typeof voiceGenders)[number]
export const voiceGenders = ['male', 'female', 'unknown'] as const

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
        check(value => value.length > 0, 'Voice is required')
    )
})
