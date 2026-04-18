import { createHash } from "node:crypto"
import { mkdir, rename } from "node:fs/promises"
import { audioContentTypes, supportedAudioFileExtensions, type AudioFileExtension, voicePreviewPath, voicePreviewsDirectory } from "../paths"
import { getCachedVoiceById, listProviderSettings } from "../settings/settings-repository"
import { ttsProviders, type TtsProvider } from "../settings/settings-types"
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

    let cachedAudio = await findVoicePreviewFile(voice.id)
    if (cachedAudio)
        return createAudioResponse(cachedAudio.file, cachedAudio.contentType)

    let settings = listProviderSettings()
    try {
        let generated = await ensurePreviewFile(voice.id, voice.provider, voice.providerVoiceId, settings)
        return createAudioResponse(Bun.file(generated.path), generated.contentType)
    } catch (error) {
        let message = error instanceof Error ? error.message : 'Voice preview generation failed'
        return new Response(message, { status: 400 })
    }

}

async function ensurePreviewFile(voiceId: string, provider: TtsProvider, providerVoiceId: string, settings: ReturnType<typeof listProviderSettings>) {
    let pending = pendingPreviewGenerations.get(voiceId)
    if (pending)
        return await resolvePreviewResult(await pending)

    let generation = generatePreviewFile(voiceId, provider, providerVoiceId, settings)
    pendingPreviewGenerations.set(voiceId, generation)

    try {
        return await resolvePreviewResult(await generation)
    } finally {
        pendingPreviewGenerations.delete(voiceId)
    }
}

async function generatePreviewFile(voiceId: string, provider: TtsProvider, providerVoiceId: string, settings: ReturnType<typeof listProviderSettings>): Promise<string> {
    await mkdir(voicePreviewsDirectory, { recursive: true })

    let generated = await streamSpeech(provider, providerVoiceId, previewText, settings)
    let extension = getAudioExtensionFromMimeType(generated.mimeType)
    if (!extension)
        throw new Error(`Voice preview generation returned unsupported audio format: ${generated.mimeType}`)

    let outputPath = voicePreviewPath(voiceId, extension)
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

function buildPreviewCacheKey(voiceId: string, text: string) {
    return createHash('sha1')
        .update(`${voiceId}::${text}`)
        .digest('hex')
}

function isTtsProvider(value: string): value is TtsProvider {
    return ttsProviders.includes(value as TtsProvider)
}

async function findVoicePreviewFile(voiceId: string, preferredExtension?: AudioFileExtension) {
    for (let extension of prioritizeAudioExtensions(preferredExtension)) {
        let path = voicePreviewPath(voiceId, extension)
        let file = Bun.file(path)
        if (await file.exists()) {
            return {
                path,
                file,
                extension,
                contentType: audioContentTypes[extension]
            }
        }
    }

    return null
}

async function resolvePreviewResult(path: string) {
    let extension = getAudioExtensionFromPath(path)
    if (!extension)
        throw new Error('Voice preview was written with an unsupported file extension')

    return {
        path,
        contentType: audioContentTypes[extension]
    }
}

function createAudioResponse(file: Bun.BunFile, contentType: string) {
    return new Response(file, {
        headers: {
            'content-type': contentType,
            'cache-control': 'public, max-age=31536000, immutable'
        }
    })
}

function prioritizeAudioExtensions(preferredExtension?: AudioFileExtension) {
    if (!preferredExtension)
        return supportedAudioFileExtensions

    return [preferredExtension, ...supportedAudioFileExtensions.filter(extension => extension != preferredExtension)]
}

function getAudioExtensionFromMimeType(mimeType: string): AudioFileExtension | null {
    let normalized = (mimeType.split(';')[0] || '').trim().toLowerCase()
    if (normalized == audioContentTypes.mp3 || normalized == 'audio/mp3')
        return 'mp3'

    if (normalized == audioContentTypes.wav || normalized == 'audio/x-wav')
        return 'wav'

    return null
}

function getAudioExtensionFromPath(path: string): AudioFileExtension | null {
    if (path.toLowerCase().endsWith('.mp3'))
        return 'mp3'

    if (path.toLowerCase().endsWith('.wav'))
        return 'wav'

    return null
}
