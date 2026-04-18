import { asc, eq, sql } from "drizzle-orm"
import { database } from "../db"
import { appSettingsTable, ttsProviderSettingsTable, ttsVoicesTable } from "../db/schema"
import { elevenLabsDefaults } from "../tts/elevenlabs"
import { inworldDefaults } from "../tts/inworld"
import { lemonFoxDefaults } from "../tts/lemonfox"
import { openAiDefaults } from "../tts/openai"
import { voiceboxDefaults } from "../tts/voicebox"
import { defaultEpisodeGenerationSettings, defaultImageDescriptionProviderSettings, defaultImageDescriptionSettings, defaultServerSettings, imageDescriptionProviders, ttsProviders, type EpisodeGenerationSettings, type ImageDescriptionProvider, type ImageDescriptionProviderState, type ImageDescriptionSettings, type ServerSettings, type SettingsState, type TtsProvider, type VoiceRecord } from "./settings-types"

export function listProviderSettings(): SettingsState {
    let rows = database.select().from(ttsProviderSettingsTable).all()
    let defaults = createDefaultSettings()

    for (let row of rows) {
        if (isProviderType(row.providerType)) {
            defaults[row.providerType] = {
                enabled: row.enabled,
                apiKey: row.apiKey,
                baseUrl: row.baseUrl || defaults[row.providerType].baseUrl
            }
        }
    }

    return defaults
}

export function saveProviderSettings(settings: SettingsState) {
    for (let providerType of ttsProviders) {
        let provider = settings[providerType]
        database
            .insert(ttsProviderSettingsTable)
            .values({
                providerType,
                enabled: provider.enabled,
                apiKey: provider.apiKey,
                baseUrl: provider.baseUrl
            })
            .onConflictDoUpdate({
                target: ttsProviderSettingsTable.providerType,
                set: {
                    enabled: provider.enabled,
                    apiKey: provider.apiKey,
                    baseUrl: provider.baseUrl,
                    updatedAt: sql`CURRENT_TIMESTAMP`
                }
            })
            .run()
    }
}

export function listImageDescriptionSettings(): ImageDescriptionSettings {
    let map = getAppSettingsMap()
    let defaults = createDefaultImageDescriptionSettings()

    let provider = map.get('imageDescription.provider') || defaultImageDescriptionSettings.provider
    let parsedProvider = isImageDescriptionProvider(provider) ? provider : defaultImageDescriptionSettings.provider

    return {
        enabled: map.get('imageDescription.enabled') == 'true',
        provider: parsedProvider,
        providers: {
            openai: readImageDescriptionProviderSettings(map, 'openai', defaults.providers),
            gemini: readImageDescriptionProviderSettings(map, 'gemini', defaults.providers)
        }
    }
}

export function saveImageDescriptionSettings(settings: ImageDescriptionSettings) {
    upsertAppSettings([
        { key: 'imageDescription.enabled', value: String(settings.enabled) },
        { key: 'imageDescription.provider', value: settings.provider },
        { key: 'imageDescription.openai.apiKey', value: settings.providers.openai.apiKey },
        { key: 'imageDescription.openai.baseUrl', value: settings.providers.openai.baseUrl },
        { key: 'imageDescription.openai.model', value: settings.providers.openai.model },
        { key: 'imageDescription.openai.prompt', value: settings.providers.openai.prompt },
        { key: 'imageDescription.gemini.apiKey', value: settings.providers.gemini.apiKey },
        { key: 'imageDescription.gemini.baseUrl', value: settings.providers.gemini.baseUrl },
        { key: 'imageDescription.gemini.model', value: settings.providers.gemini.model },
        { key: 'imageDescription.gemini.prompt', value: settings.providers.gemini.prompt }
    ])
}

export function getEpisodeGenerationSettings(): EpisodeGenerationSettings {
    let map = getAppSettingsMap()
    let concurrentGenerations = parseInt(map.get('episodeGeneration.concurrentGenerations') || '', 10)

    return {
        concurrentGenerations: Number.isInteger(concurrentGenerations) && concurrentGenerations >= 1 && concurrentGenerations <= 20
            ? concurrentGenerations
            : defaultEpisodeGenerationSettings.concurrentGenerations
    }
}

export function saveEpisodeGenerationSettings(settings: EpisodeGenerationSettings) {
    upsertAppSettings([
        { key: 'episodeGeneration.concurrentGenerations', value: String(settings.concurrentGenerations) }
    ])
}

export function listCachedVoices() {
    return database
        .select()
        .from(ttsVoicesTable)
        .orderBy(asc(ttsVoicesTable.provider), asc(ttsVoicesTable.name))
        .all()
}

export function listCachedVoicesByProvider(providerType: TtsProvider) {
    return database
        .select()
        .from(ttsVoicesTable)
        .where(eq(ttsVoicesTable.provider, providerType))
        .orderBy(asc(ttsVoicesTable.name))
        .all()
}

export function getCachedVoiceById(id: string) {
    return database
        .select()
        .from(ttsVoicesTable)
        .where(eq(ttsVoicesTable.id, id))
        .get() || null
}

export function replaceProviderVoices(providerType: TtsProvider, voices: VoiceRecord[]) {
    database
        .delete(ttsVoicesTable)
        .where(eq(ttsVoicesTable.provider, providerType))
        .run()

    if (voices.length == 0)
        return

    database
        .insert(ttsVoicesTable)
        .values(voices.map(voice => ({
            id: voice.id,
            provider: voice.provider,
            providerVoiceId: voice.providerVoiceId,
            name: voice.name,
            description: voice.description,
            gender: voice.gender
        })))
        .run()
}

let cachedBaseUrl: string | null = null

export function getServerBaseUrl(): string {
    return (cachedBaseUrl ??= baseUrl(getServerSettings()))
}

export function getServerSettings(): ServerSettings {
    let map = getAppSettingsMap()

    let protocolRaw = map.get('server.protocol')
    let listenRaw = map.get('server.listenOnAllInterfaces')
    let portRaw = map.get('server.port')

    return {
        protocol: protocolRaw == 'https' ? 'https' : defaultServerSettings.protocol,
        hostname: map.get('server.hostname') || defaultServerSettings.hostname,
        port: portRaw != null ? (parseInt(portRaw, 10) || null) : null,
        listenOnAllInterfaces: listenRaw != null ? listenRaw == 'true' : defaultServerSettings.listenOnAllInterfaces,
        passwordConfigured: map.get('auth.passwordHash') ? true : false
    }
}

export function saveServerSettings(settings: ServerSettings) {
    upsertAppSettings([
        { key: 'server.protocol', value: settings.protocol },
        { key: 'server.hostname', value: settings.hostname },
        { key: 'server.port', value: String(settings.port) },
        { key: 'server.listenOnAllInterfaces', value: String(settings.listenOnAllInterfaces) }
    ])

    cachedBaseUrl = baseUrl(settings)
}

function upsertAppSettings(entries: Array<{ key: string, value: string }>) {
    for (let entry of entries) {
        database
            .insert(appSettingsTable)
            .values({ key: entry.key, value: entry.value })
            .onConflictDoUpdate({
                target: appSettingsTable.key,
                set: {
                    value: entry.value,
                    updatedAt: sql`CURRENT_TIMESTAMP`
                }
            })
            .run()
    }
}

function getAppSettingsMap() {
    let rows = database.select().from(appSettingsTable).all()
    return new Map(rows.map(r => [r.key, r.value]))
}

function baseUrl(settings: ServerSettings) {
    return `${settings.protocol}://${settings.hostname}:${settings.port}`
}

function createDefaultSettings(): SettingsState {
    return {
        inworld: { ...inworldDefaults },
        openai: { ...openAiDefaults },
        elevenlabs: { ...elevenLabsDefaults },
        lemonfox: { ...lemonFoxDefaults },
        voicebox: { ...voiceboxDefaults }
    }
}

function isProviderType(value: string): value is TtsProvider {
    return ttsProviders.includes(value as TtsProvider)
}

function isImageDescriptionProvider(value: string): value is ImageDescriptionProvider {
    return imageDescriptionProviders.includes(value as ImageDescriptionProvider)
}

function createDefaultImageDescriptionSettings(): ImageDescriptionSettings {
    return {
        enabled: defaultImageDescriptionSettings.enabled,
        provider: defaultImageDescriptionSettings.provider,
        providers: {
            openai: { ...defaultImageDescriptionProviderSettings.openai },
            gemini: { ...defaultImageDescriptionProviderSettings.gemini }
        }
    }
}

function readImageDescriptionProviderSettings(
    map: Map<string, string>,
    provider: ImageDescriptionProvider,
    defaults: ImageDescriptionProviderState
) {
    let fallbackPrefix = provider == 'openai' ? 'imageDescription' : ''

    return {
        apiKey: readImageDescriptionValue(map, provider, 'apiKey', defaults[provider].apiKey, fallbackPrefix),
        baseUrl: readImageDescriptionValue(map, provider, 'baseUrl', defaults[provider].baseUrl, fallbackPrefix),
        model: readImageDescriptionValue(map, provider, 'model', defaults[provider].model, fallbackPrefix),
        prompt: readImageDescriptionValue(map, provider, 'prompt', defaults[provider].prompt, fallbackPrefix)
    }
}

function readImageDescriptionValue(
    map: Map<string, string>,
    provider: ImageDescriptionProvider,
    field: 'apiKey' | 'baseUrl' | 'model' | 'prompt',
    defaultValue: string,
    fallbackPrefix: string
) {
    let providerValue = map.get(`imageDescription.${provider}.${field}`)
    if (providerValue != null)
        return providerValue

    if (fallbackPrefix) {
        let legacyValue = map.get(`${fallbackPrefix}.${field}`)
        if (legacyValue != null)
            return legacyValue
    }

    return defaultValue
}
