import { Result } from "better-result"
import { type TtsProvider, type TtsProviderSettings, type VoiceRecord } from "../settings/settings-types"
import { listElevenLabsVoices } from "./elevenlabs"
import { listInworldVoices } from "./inworld"
import { listLemonFoxVoices } from "./lemonfox"
import { listOpenAiVoices } from "./openai"
import { buildUrl } from "./tts-utils"

type StreamedAudio = {
    stream: ReadableStream<Uint8Array>
    mimeType: string
}

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

export async function streamSpeech(provider: TtsProvider, providerVoiceId: string, text: string, providerSettings: Record<TtsProvider, TtsProviderSettings>): Promise<Result<StreamedAudio, string>> {
    let settings = providerSettings[provider]
    if (!settings.enabled || !settings.apiKey.trim())
        return Result.err(`${provider} is not enabled`)

    if (provider == 'openai' || provider == 'lemonfox')
        return await streamOpenAiCompatibleSpeech(provider, providerVoiceId, text, settings)

    if (provider == 'elevenlabs')
        return await streamElevenLabsSpeech(providerVoiceId, text, settings)

    return Result.err('Inworld streaming TTS is not implemented yet')
}

async function streamOpenAiCompatibleSpeech(provider: 'openai' | 'lemonfox', providerVoiceId: string, text: string, settings: TtsProviderSettings): Promise<Result<StreamedAudio, string>> {
    try {
        let endpoint = buildUrl(settings.baseUrl, '/audio/speech')
        let response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${settings.apiKey}`,
                'Content-Type': 'application/json',
                Accept: 'audio/mpeg'
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini-tts',
                voice: providerVoiceId,
                input: text,
                format: 'mp3'
            })
        })

        if (!response.ok || !response.body)
            return Result.err(`${provider} audio generation failed`)

        return Result.ok({
            stream: response.body,
            mimeType: 'audio/mpeg'
        })
    }
    catch {
        return Result.err(`${provider} audio generation failed`)
    }
}

async function streamElevenLabsSpeech(providerVoiceId: string, text: string, settings: TtsProviderSettings): Promise<Result<StreamedAudio, string>> {
    try {
        let endpoint = buildUrl(settings.baseUrl, `/v1/text-to-speech/${providerVoiceId}/stream?output_format=mp3_44100_128`)
        let response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'xi-api-key': settings.apiKey,
                'Content-Type': 'application/json',
                Accept: 'audio/mpeg'
            },
            body: JSON.stringify({
                text,
                model_id: 'eleven_multilingual_v2'
            })
        })

        if (!response.ok || !response.body)
            return Result.err('elevenlabs audio generation failed')

        return Result.ok({
            stream: response.body,
            mimeType: 'audio/mpeg'
        })
    }
    catch {
        return Result.err('elevenlabs audio generation failed')
    }
}

