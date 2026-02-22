import { listProviderSettings, replaceProviderVoices, listCachedVoicesByProvider } from "../settings/settings-repository"
import { type VoiceRecord, ttsProviders } from "../settings/settings-types"
import { procedure } from "../trpc/trpc"
import { listVoices } from "./tts"

export const list = procedure
    .query(async () => {
        let settings = listProviderSettings()
        let merged: VoiceRecord[] = []

        for (let providerType of ttsProviders) {
            let providerSettings = settings[providerType]
            try {
                let voices = await listVoices(providerType, providerSettings)
                replaceProviderVoices(providerType, voices)
                merged.push(...voices)
            }
            catch {
                let cachedRows = listCachedVoicesByProvider(providerType)
                let cachedVoices: VoiceRecord[] = cachedRows.map(row => {
                    let gender: VoiceRecord['gender'] = row.gender == 'male' || row.gender == 'female' ? row.gender : 'unknown'
                    return {
                        id: row.id,
                        provider: providerType,
                        providerVoiceId: row.providerVoiceId,
                        name: row.name,
                        description: row.description || '',
                        gender
                    }
                })
                merged.push(...cachedVoices)
            }
        }

        merged.sort((a, b) => {
            let providerOrder = a.provider.localeCompare(b.provider)
            if (providerOrder != 0)
                return providerOrder
            return a.name.localeCompare(b.name)
        })

        return { voices: dedupeVoices(merged) }
    })

function dedupeVoices(voices: VoiceRecord[]) {
    let map = new Map<string, VoiceRecord>()
    for (let voice of voices)
        map.set(voice.id, voice)

    return [...map.values()]
}