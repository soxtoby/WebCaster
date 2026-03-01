import { asc, eq, sql } from "drizzle-orm"
import { database } from "../db"
import { appSettingsTable, ttsProviderSettingsTable, ttsVoicesTable } from "../db/schema"
import { elevenLabsDefaults } from "../tts/elevenlabs"
import { inworldDefaults } from "../tts/inworld"
import { lemonFoxDefaults } from "../tts/lemonfox"
import { openAiDefaults } from "../tts/openai"
import { defaultServerSettings, ttsProviders, type ServerSettings, type SettingsState, type TtsProvider, type VoiceRecord } from "./settings-types"

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
    let rows = database.select().from(appSettingsTable).all()
    let map = new Map(rows.map(r => [r.key, r.value]))

    let listenRaw = map.get('server.listenOnAllInterfaces')
    let portRaw = map.get('server.port')

    return {
        hostname: map.get('server.hostname') || defaultServerSettings.hostname,
        port: portRaw != null ? (parseInt(portRaw, 10) || null) : null,
        listenOnAllInterfaces: listenRaw != null ? listenRaw == 'true' : defaultServerSettings.listenOnAllInterfaces
    }
}

export function saveServerSettings(settings: ServerSettings) {
    let entries: Array<{ key: string, value: string }> = [
        { key: 'server.hostname', value: settings.hostname },
        { key: 'server.port', value: String(settings.port) },
        { key: 'server.listenOnAllInterfaces', value: String(settings.listenOnAllInterfaces) }
    ]

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

    cachedBaseUrl = baseUrl(settings)
}

function baseUrl(settings: ServerSettings) {
    return `http://${settings.hostname}:${settings.port}`
}

function createDefaultSettings(): SettingsState {
    return {
        inworld: { ...inworldDefaults },
        openai: { ...openAiDefaults },
        elevenlabs: { ...elevenLabsDefaults },
        lemonfox: { ...lemonFoxDefaults }
    }
}

function isProviderType(value: string): value is TtsProvider {
    return ttsProviders.includes(value as TtsProvider)
}
