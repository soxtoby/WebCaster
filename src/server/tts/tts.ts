import { type TtsProvider, type TtsProviderSettings, type VoiceRecord } from "../settings/settings-types"
import { listElevenLabsVoices, streamElevenLabsSpeech } from "./elevenlabs"
import { listInworldVoices, streamInworldSpeech } from "./inworld"
import { listLemonFoxVoices } from "./lemonfox"
import { listOpenAiVoices, streamOpenAiSpeech } from "./openai"

export type StreamedAudio = {
    stream: ReadableStream<Uint8Array>
    mimeType: string
}

export type StreamSpeechOptions = {
    onChunkProgress?: (progress: { chunksProcessed: number; chunksTotal: number }) => void
}

export async function listVoices(providerType: TtsProvider, settings: TtsProviderSettings): Promise<VoiceRecord[]> {
    if (!settings.enabled || !settings.apiKey.trim())
        return []

    if (providerType == 'inworld')
        return await listInworldVoices(settings)

    if (providerType == 'openai')
        return await listOpenAiVoices(settings)

    if (providerType == 'elevenlabs')
        return await listElevenLabsVoices(settings)

    return await listLemonFoxVoices(settings)
}

export async function streamSpeech(provider: TtsProvider, providerVoiceId: string, text: string, providerSettings: Record<TtsProvider, TtsProviderSettings>, options?: StreamSpeechOptions): Promise<StreamedAudio> {
    let settings = providerSettings[provider]
    if (!settings.enabled || !settings.apiKey.trim())
        throw new Error(`${provider} is not enabled`)

    if (provider == 'openai' || provider == 'lemonfox')
        return await streamOpenAiSpeech(provider, providerVoiceId, text, settings)

    if (provider == 'elevenlabs')
        return await streamElevenLabsSpeech(providerVoiceId, text, settings)

    return await streamInworldSpeech(providerVoiceId, text, settings, options)
}

