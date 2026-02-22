import { createHash } from "node:crypto"
import { mkdirSync, renameSync } from "node:fs"
import { join } from "node:path"
import { appDataDirectory, resolvePreviewPath } from "../db/location"
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

    let previewKey = buildPreviewCacheKey(voice.id, previewText)
    let outputPath = resolvePreviewPath(previewKey)
    let cachedFile = Bun.file(outputPath)
    if (await cachedFile.exists())
        return createAudioResponse(cachedFile)

    let settings = listProviderSettings()
    try {
        let generated = await ensurePreviewFile(previewKey, outputPath, voice.provider, voice.providerVoiceId, settings)
        return createAudioResponse(Bun.file(generated))
    }
    catch (error) {
        let message = error instanceof Error ? error.message : 'Voice preview generation failed'
        return new Response(message, { status: 400 })
    }

}

async function ensurePreviewFile(previewKey: string, outputPath: string, provider: TtsProvider, providerVoiceId: string, settings: ReturnType<typeof listProviderSettings>) {
    let pending = pendingPreviewGenerations.get(previewKey)
    if (pending)
        return await pending

    let generation = generatePreviewFile(outputPath, provider, providerVoiceId, settings)
    pendingPreviewGenerations.set(previewKey, generation)

    try {
        return await generation
    } finally {
        pendingPreviewGenerations.delete(previewKey)
    }
}

async function generatePreviewFile(outputPath: string, provider: TtsProvider, providerVoiceId: string, settings: ReturnType<typeof listProviderSettings>): Promise<string> {
    mkdirSync(join(appDataDirectory, 'voice-previews'), { recursive: true })

    let generated = await streamSpeech(provider, providerVoiceId, previewText, settings)
    let tempPath = `${outputPath}.${Date.now()}.tmp`

    await writeStreamToFile(generated.stream, tempPath)
    renameSync(tempPath, outputPath)
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

function buildPreviewCacheKey(voiceId: string, text: string) {
    return createHash('sha1')
        .update(`${voiceId}::${text}`)
        .digest('hex')
}

function createAudioResponse(file: Bun.BunFile) {
    return new Response(file, {
        headers: {
            'content-type': 'audio/mpeg',
            'cache-control': 'public, max-age=31536000, immutable'
        }
    })
}

function isTtsProvider(value: string): value is TtsProvider {
    return value == 'inworld' || value == 'openai' || value == 'elevenlabs' || value == 'lemonfox'
}
