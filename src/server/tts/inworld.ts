import { Result } from "better-result"
import { array, object, safeParse, string, type InferOutput } from "valibot"
import { type TtsProviderSettings, type VoiceRecord } from "../settings/settings-types"
import { buildUrl, detectGenderFromName } from "./tts-utils"

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

export async function listInworldVoices(settings: TtsProviderSettings): Promise<Result<VoiceRecord[], string>> {
    try {
        let response = await fetch(buildUrl(settings.baseUrl, '/voices/v1/voices'), {
            headers: {
                Authorization: `Basic ${settings.apiKey.trim()}`,
                Accept: 'application/json'
            }
        })

        if (!response.ok)
            return Result.err('Inworld voice API request failed')

        let payload = await response.json()
        let parsed = safeParse(InworldListVoicesResponse, payload)
        if (!parsed.success) {
            console.error('Inworld voice API response validation failed', parsed.issues)
            return Result.err('Inworld voice API response was invalid')
        }

        return Result.ok(parsed.output.voices
            .map(entry => mapInworldVoice(entry)))
    }
    catch {
        return Result.err('Inworld voice API request failed')
    }
}

export async function streamInworldSpeech(providerVoiceId: string, text: string, settings: TtsProviderSettings): Promise<Result<{ stream: ReadableStream<Uint8Array>; mimeType: string }, string>> {
    try {
        let endpoint = buildUrl(settings.baseUrl, '/tts/v1/voice:stream')
        let response = await fetch(endpoint, {
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
        })

        if (!response.ok || !response.body)
            return Result.err('inworld audio generation failed')

        return Result.ok({
            stream: createInworldAudioStream(response.body),
            mimeType: 'audio/mpeg'
        })
    } catch {
        return Result.err('inworld audio generation failed')
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
                let message = error instanceof Error ? error.message : 'inworld audio generation failed'
                controller.error(new Error(message))
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
