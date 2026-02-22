import { array, object, string, type InferOutput } from "valibot"
import { fetchJson, fetchResponse } from "../http/request"
import { type TtsProviderSettings, type VoiceRecord } from "../settings/settings-types"
import { detectGenderFromName } from "./tts-utils"

type InworldSpeechResponse = {
    result?: {
        audioContent?: string
    }
    error?: {
        message?: string
    }
}

type InworldVoice = InferOutput<typeof InworldVoice>
let InworldVoice = object({
    voiceId: string(),
    langCode: string(),
    displayName: string(),
    description: string(),
    tags: array(string()),
    name: string()
})

let InworldListVoicesResponse = object({
    voices: array(InworldVoice)
})


export let inworldDefaults: TtsProviderSettings = {
    enabled: false,
    apiKey: '',
    baseUrl: 'https://api.inworld.ai'
}

export async function listInworldVoices(settings: TtsProviderSettings): Promise<VoiceRecord[]> {
    let response = await fetchJson(
        'Inworld voices',
        InworldListVoicesResponse,
        settings.baseUrl,
        '/voices/v1/voices',
        {
            headers: {
                Authorization: `Basic ${settings.apiKey.trim()}`,
                Accept: 'application/json'
            }
        }
    )

    return response.voices
        .map(entry => mapInworldVoice(entry))
}

export async function streamInworldSpeech(providerVoiceId: string, text: string, settings: TtsProviderSettings): Promise<{ stream: ReadableStream<Uint8Array>; mimeType: string }> {
    let response = await fetchResponse(
        'Inworld speech stream',
        settings.baseUrl,
        '/tts/v1/voice:stream',
        {
            method: 'POST',
            headers: {
                Authorization: `Basic ${settings.apiKey.trim()}`,
                'Content-Type': 'application/json',
                Accept: 'application/json'
            },
            body: JSON.stringify({
                text,
                voiceId: providerVoiceId,
                modelId: 'inworld-tts-1.5-max',
                audioConfig: {
                    audioEncoding: 'MP3'
                },
                autoMode: true
            })
        }
    )

    if (!response.body)
        throw new Error('inworld audio generation failed')

    return {
        stream: createInworldAudioStream(response.body),
        mimeType: 'audio/mpeg'
    }
}

function mapInworldVoice(entry: InworldVoice): VoiceRecord {
    let providerVoiceId = entry.voiceId
    let name = entry.displayName || entry.name || providerVoiceId
    let description = entry.description
    let gender = detectGenderFromName(name)

    return {
        id: `inworld:${providerVoiceId}`,
        provider: 'inworld',
        providerVoiceId,
        name,
        description,
        gender
    }
}

function decodeBase64Audio(value: string) {
    let normalized = value
        .replace(/\s+/g, '')
        .replace(/-/g, '+')
        .replace(/_/g, '/')

    let binary = atob(normalized)
    let bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1)
        bytes[i] = binary.charCodeAt(i)

    return bytes
}

function createInworldAudioStream(source: ReadableStream<Uint8Array>) {
    let decoder = new TextDecoder()
    let reader = source.getReader()
    let buffer = ''

    return new ReadableStream<Uint8Array>({
        async pull(controller) {
            try {
                while (true) {
                    let read = await reader.read()
                    if (read.done) {
                        let tail = decoder.decode()
                        if (tail)
                            buffer += tail

                        flushLineBuffer(controller, buffer)
                        controller.close()
                        return
                    }

                    if (!read.value)
                        continue

                    buffer += decoder.decode(read.value, { stream: true })
                    let lines = buffer.split(/\r?\n/)
                    buffer = lines.pop() || ''

                    for (let line of lines)
                        processInworldStreamLine(controller, line)
                }
            }
            catch (error) {
                controller.error(error)
            }
        },
        cancel() {
            void reader.cancel()
        }
    })
}

function flushLineBuffer(controller: ReadableStreamDefaultController<Uint8Array>, value: string) {
    let lines = value.split(/\r?\n/)
    for (let line of lines)
        processInworldStreamLine(controller, line)
}

function processInworldStreamLine(controller: ReadableStreamDefaultController<Uint8Array>, line: string) {
    let trimmed = line.trim()
    if (!trimmed)
        return

    let normalized = trimmed.startsWith('data:')
        ? trimmed.slice(5).trim()
        : trimmed

    if (!normalized)
        return

    let chunk = safeParseJson(normalized)
    if (!chunk)
        return

    if (chunk.error?.message)
        throw new Error(chunk.error.message)

    let audioContent = chunk.result?.audioContent || ''
    if (!audioContent)
        return

    controller.enqueue(decodeBase64Audio(audioContent))
}

function safeParseJson(value: string): InworldSpeechResponse | null {
    try {
        return JSON.parse(value) as InworldSpeechResponse
    }
    catch {
        return null
    }
}
