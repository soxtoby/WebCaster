import { Result } from "better-result"
import { type TtsProvider, type TtsProviderSettings, type VoiceRecord } from "../settings/settings-types"
import { listElevenLabsVoices } from "./elevenlabs"
import { listInworldVoices } from "./inworld"
import { listLemonFoxVoices } from "./lemonfox"
import { listOpenAiVoices } from "./openai"

export async function listVoices(providerType: TtsProvider, settings: TtsProviderSettings): Promise<Result<VoiceRecord[], string>> {
    if (!settings.enabled || !settings.apiKey.trim())
        return Result.ok([])

    if (providerType == 'inworld')
        return await listInworldVoices(settings)

    if (providerType == 'openai')
        return await listOpenAiVoices(settings)

    if (providerType == 'elevenlabs')
        return await listElevenLabsVoices(settings)

    return await listLemonFoxVoices(settings)
}
