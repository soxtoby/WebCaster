import { hostname as osHostname } from "os"
import { boolean, check, number, object, optional, picklist, pipe, string, trim, type InferOutput } from "valibot"
import { defaultImageDescriptionProviderSettings as sharedDefaultImageDescriptionProviderSettings } from "../../shared/image-description-defaults"

export let ttsProviders = ['inworld', 'openai', 'elevenlabs', 'lemonfox'] as const
export type TtsProvider = (typeof ttsProviders)[number]

export type TtsProviderSettings = {
    enabled: boolean
    apiKey: string
    baseUrl: string
}

export let imageDescriptionProviders = ['openai', 'gemini'] as const
export type ImageDescriptionProvider = (typeof imageDescriptionProviders)[number]

export type ImageDescriptionProviderSettings = {
    apiKey: string
    baseUrl: string
    model: string
    prompt: string
}

export type ImageDescriptionProviderState = Record<ImageDescriptionProvider, ImageDescriptionProviderSettings>

export type ImageDescriptionSettings = {
    enabled: boolean
    provider: ImageDescriptionProvider
    providers: ImageDescriptionProviderState
}

export type EpisodeGenerationSettings = {
    concurrentGenerations: number
}

export type SettingsState = Record<TtsProvider, TtsProviderSettings>

let ProviderSettingsInput = object({
    enabled: boolean(),
    apiKey: pipe(string(), trim()),
    baseUrl: pipe(string(), trim())
})

export type ServerSettings = {
    protocol: 'http' | 'https'
    hostname: string
    port: number | null
    listenOnAllInterfaces: boolean
    passwordConfigured: boolean
}

export let defaultServerSettings = {
    protocol: 'http',
    hostname: osHostname(),
    port: 80,
    listenOnAllInterfaces: true,
    passwordConfigured: false
} as const satisfies ServerSettings

export let defaultImageDescriptionProviderSettings = {
    openai: {
        ...sharedDefaultImageDescriptionProviderSettings.openai
    },
    gemini: {
        ...sharedDefaultImageDescriptionProviderSettings.gemini
    }
} as const satisfies ImageDescriptionProviderState

export let defaultImageDescriptionSettings = {
    enabled: false,
    provider: 'openai',
    providers: {
        openai: { ...defaultImageDescriptionProviderSettings.openai },
        gemini: { ...defaultImageDescriptionProviderSettings.gemini }
    }
} as const satisfies ImageDescriptionSettings

export let defaultEpisodeGenerationSettings = {
    concurrentGenerations: 1
} as const satisfies EpisodeGenerationSettings

let ImageDescriptionProviderSettingsInput = object({
    apiKey: pipe(string(), trim()),
    baseUrl: pipe(string(), trim()),
    model: pipe(string(), trim()),
    prompt: pipe(string(), trim())
})

let ImageDescriptionSettingsInput = object({
    enabled: boolean(),
    provider: picklist(imageDescriptionProviders),
    providers: object({
        openai: ImageDescriptionProviderSettingsInput,
        gemini: ImageDescriptionProviderSettingsInput
    })
})

let EpisodeGenerationSettingsInput = object({
    concurrentGenerations: pipe(
        number('Concurrent episode generations must be a number'),
        check(
            value => Number.isInteger(value) && value >= 1 && value <= 20,
            'Concurrent episode generations must be between 1 and 20'
        )
    )
})

export type SettingsInput = InferOutput<typeof SettingsInput>
export const SettingsInput = object({
    settings: object({
        inworld: ProviderSettingsInput,
        openai: ProviderSettingsInput,
        elevenlabs: ProviderSettingsInput,
        lemonfox: ProviderSettingsInput
    }),
    imageDescription: ImageDescriptionSettingsInput,
    episodeGeneration: EpisodeGenerationSettingsInput,
    server: object({
        protocol: picklist(['http', 'https']),
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
