import { mkdir, rename } from "node:fs/promises"
import { voicePreviewPath, voicePreviewsDirectory } from "../paths"
import { getCachedVoiceById, listProviderSettings } from "../settings/settings-repository"
import { type TtsProvider } from "../settings/settings-types"
import { streamSpeech } from "./tts"

let previewText = 'Hello, this is a preview of my voice. I hope you like how I sound!'
let pendingPreviewGenerations = new Map<string, Promise<string>>()

export async function streamVoicePreviewAudio(voiceId: string): Promise<Response> {
    let resolvedVoiceId = voiceId.trim()
    if (!resolvedVoiceId)
        return new Response('Voice is required', { status: 400 })

    let voice = getCachedVoiceById(resolvedVoiceId)
    if (!voice)
        return new Response('Voice not found', { status: 404 })

    if (!isTtsProvider(voice.provider))
        return new Response('Voice provider is invalid', { status: 400 })

    let cachedPreview = Bun.file(voicePreviewPath(voice.id))
    if (await cachedPreview.exists())
        return createAudioResponse(cachedPreview)

    let settings = listProviderSettings()
    try {
        let generatedPath = await ensurePreviewFile(voice.id, voice.provider, voice.providerVoiceId, settings)
        return createAudioResponse(Bun.file(generatedPath))
    } catch (error) {
        let message = error instanceof Error ? error.message : 'Voice preview generation failed'
        return new Response(message, { status: 400 })
    }

}

async function ensurePreviewFile(voiceId: string, provider: TtsProvider, providerVoiceId: string, settings: ReturnType<typeof listProviderSettings>) {
    let pending = pendingPreviewGenerations.get(voiceId)
    if (pending)
        return await pending

    let generation = generatePreviewFile(voiceId, provider, providerVoiceId, settings)
    pendingPreviewGenerations.set(voiceId, generation)

    try {
        return await generation
    } finally {
        pendingPreviewGenerations.delete(voiceId)
    }
}

async function generatePreviewFile(voiceId: string, provider: TtsProvider, providerVoiceId: string, settings: ReturnType<typeof listProviderSettings>): Promise<string> {
    await mkdir(voicePreviewsDirectory, { recursive: true })

    let generated = await streamSpeech(provider, providerVoiceId, previewText, settings)
    let outputPath = voicePreviewPath(voiceId)
    let tempPath = `${outputPath}.${Date.now()}.tmp`

    await writeStreamToFile(generated.stream, tempPath)
    await rename(tempPath, outputPath)
    return outputPath
}

async function writeStreamToFile(stream: ReadableStream<Uint8Array>, outputPath: string) {
    let writer = Bun.file(outputPath).writer()
    let reader = stream.getReader()

    try {
        while (true) {
            let read = await reader.read()
            if (read.done)
                break

            if (read.value)
                await writer.write(read.value)
        }

        await writer.end()
    } finally {
        reader.releaseLock()
    }
}

function createAudioResponse(file: Bun.BunFile) {
    return new Response(file, {
        headers: {
            'content-type': 'audio/mpeg',
            'cache-control': 'no-store'
        }
    })
}

function isTtsProvider(value: string): value is TtsProvider {
    return value == 'inworld' || value == 'openai' || value == 'elevenlabs' || value == 'lemonfox' || value == 'voicebox'
}
