import { asc, eq, sql } from "drizzle-orm"
import { database } from "../db"
import { ttsProviderSettingsTable, ttsVoicesTable } from "../db/schema"
import { elevenLabsDefaults } from "../tts/elevenlabs"
import { inworldDefaults } from "../tts/inworld"
import { lemonFoxDefaults } from "../tts/lemonfox"
import { openAiDefaults } from "../tts/openai"
import { ttsProviders, type TtsProvider, type SettingsState, type VoiceRecord } from "./settings-types"

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
