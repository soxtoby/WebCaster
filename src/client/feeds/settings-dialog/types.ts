import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "../../../server/trpc/app-router"

export type ProviderSettingsDraft = {
    enabled: boolean
    apiKey: string
    baseUrl: string
}

export type TtsSettingsDraft = {
    inworld: ProviderSettingsDraft
    openai: ProviderSettingsDraft
    elevenlabs: ProviderSettingsDraft
    lemonfox: ProviderSettingsDraft
    voicebox: ProviderSettingsDraft
}

export type ServerSettingsDraft = {
    address: string
    port: string
    listenOnAllInterfaces: boolean
    password: string
    passwordConfigured: boolean
    protocol: 'http' | 'https'
}

export type ImageDescriptionProviderDraft = {
    apiKey: string
    baseUrl: string
    model: string
    prompt: string
}

export type ImageDescriptionSettingsDraft = {
    enabled: boolean
    provider: 'openai' | 'gemini'
    providers: {
        openai: ImageDescriptionProviderDraft
        gemini: ImageDescriptionProviderDraft
    }
}

export type EpisodeGenerationSettingsDraft = {
    concurrentGenerations: string
}

export type VoiceboxSettingsDraft = {
    location: string
}

export type ActiveTab = 'server' | 'imageDescription' | keyof TtsSettingsDraft

export type RouterOutputs = inferRouterOutputs<AppRouter>
export type SettingsResponse = RouterOutputs['settings']['get']
export type VoiceboxRuntimeStatus = SettingsResponse['voicebox'] & { running: boolean; error: string }
