type ChunkProgress = {
    chunksProcessed: number
    chunksTotal: number
}

type ChunkedSpeechOptions = {
    onChunkProgress?: (progress: ChunkProgress) => void
}

export type ChunkSizeOptions = {
    minLength?: number
    targetMaxLength?: number
    hardMaxLength: number
}

type ResolvedChunkSizeOptions = {
    minLength: number
    splitGoal: number
    hasTargetMaxLength: boolean
    hardMaxLength: number
}

export function createChunkedSpeechStream(text: string, sizes: ChunkSizeOptions, loadChunkStream: (chunk: string) => Promise<ReadableStream<Uint8Array>>, options?: ChunkedSpeechOptions) {
    let chunks = splitTextIntoChunks(text, sizes)
    let totalChunks = chunks.length

    options?.onChunkProgress?.({ chunksProcessed: 0, chunksTotal: totalChunks })

    return new ReadableStream<Uint8Array>({
        async start(controller) {
            try {
                for (let index = 0; index < chunks.length; index += 1) {
                    let chunk = chunks[index]
                    if (!chunk)
                        continue

                    let chunkStream = await loadChunkStream(chunk)
                    let reader = chunkStream.getReader()
                    try {
                        while (true) {
                            let read = await reader.read()
                            if (read.done)
                                break

                            if (read.value)
                                controller.enqueue(read.value)
                        }
                    } finally {
                        reader.releaseLock()
                    }

                    options?.onChunkProgress?.({ chunksProcessed: index + 1, chunksTotal: totalChunks })
                }

                controller.close()
            } catch (error) {
                controller.error(error)
            }
        }
    })
}

export function splitTextIntoChunks(text: string, sizes: ChunkSizeOptions): string[] {
    let options = resolveChunkSizeOptions(sizes)
    let chunks: string[]

    if (text.length <= options.splitGoal) {
        chunks = [text]
    } else {
        chunks = []
        let paragraphs = splitParagraphs(text)
        let pending = ''

        for (let paragraph of paragraphs) {
            if (pending) {
                let candidate = pending + '\n\n' + paragraph
                if (pending.length >= options.minLength && candidate.length > options.splitGoal) {
                    chunks.push(...splitChunk(pending, options))
                    pending = paragraph
                } else {
                    pending = candidate
                }
            } else {
                pending = paragraph
            }

            while (pending.length > options.hardMaxLength) {
                let splitAt = findSplit(pending, options)
                chunks.push(pending.slice(0, splitAt).trim())
                pending = pending.slice(splitAt).trimStart()
            }
        }

        if (pending.trim())
            chunks.push(...splitChunk(pending, options))

        chunks = mergeShortFinalChunk(chunks, options)
    }

    return chunks
}

function resolveChunkSizeOptions(sizes: ChunkSizeOptions): ResolvedChunkSizeOptions {
    let splitGoal = sizes.targetMaxLength ?? sizes.hardMaxLength
    return {
        minLength: sizes.minLength ?? Math.min(250, Math.floor(splitGoal * 0.5)),
        splitGoal,
        hasTargetMaxLength: sizes.targetMaxLength != null,
        hardMaxLength: sizes.hardMaxLength
    }
}

function splitParagraphs(text: string) {
    return text
        .replace(/\r\n/g, '\n')
        .split(/\n\s*\n+/)
        .map(paragraph => paragraph.replace(/\s*\n\s*/g, ' ').trim())
        .filter(Boolean)
}

function splitChunk(text: string, options: ResolvedChunkSizeOptions): string[] {
    let chunks: string[] = []
    let remaining = text.trim()

    while (remaining.length > options.splitGoal) {
        if (!options.hasTargetMaxLength && remaining.length <= options.hardMaxLength)
            break

        let splitAt = findSplit(remaining, options)
        chunks.push(remaining.slice(0, splitAt).trim())
        remaining = remaining.slice(splitAt).trimStart()
    }

    if (remaining)
        chunks.push(remaining)

    return chunks
}

function findSplit(value: string, options: ResolvedChunkSizeOptions) {
    let sentenceBoundary = findSentenceBoundary(value, options)
    if (sentenceBoundary > 0)
        return sentenceBoundary

    return findWordSplit(value, options.hardMaxLength)
}

function findSentenceBoundary(value: string, options: ResolvedChunkSizeOptions) {
    let best = -1
    let matches = value.matchAll(/[.!?]["')\]]?(?=\s)/g)

    for (let match of matches) {
        let index = match.index
        if (index == null)
            continue

        if (isDecimalPoint(value, index) || isAbbreviation(value, index))
            continue

        let boundary = index + match[0].length
        let isValidBoundary = boundary >= options.minLength && boundary <= options.hardMaxLength
        let isBetterBoundary = best < 0 || Math.abs(boundary - options.splitGoal) < Math.abs(best - options.splitGoal)
        if (isValidBoundary && isBetterBoundary)
            best = boundary
    }

    return best
}

function isDecimalPoint(value: string, index: number) {
    return /\d/.test(value[index - 1] || '') && /\d/.test(value[index + 1] || '')
}

function isAbbreviation(value: string, index: number) {
    let before = value.slice(Math.max(0, index - 12), index + 1)
    return /\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|e\.g|i\.e|U\.S|U\.K)\.$/i.test(before)
}

function findWordSplit(value: string, hardMaxLength: number) {
    let window = value.slice(0, hardMaxLength + 1)
    let match = Array.from(window.matchAll(/\s+/g)).at(-1)
    if (!match || match.index == 0)
        throw new Error(`TTS chunk contains a word longer than the hard limit of ${hardMaxLength} characters`)

    return match.index
}

function mergeShortFinalChunk(chunks: string[], options: ResolvedChunkSizeOptions) {
    if (chunks.length < 2)
        return chunks

    let finalChunk = chunks[chunks.length - 1]
    if (!finalChunk || finalChunk.length >= options.minLength)
        return chunks

    let previous = chunks[chunks.length - 2]
    let merged = previous + '\n\n' + finalChunk
    let prefix = chunks.slice(0, -2)
    if (merged.length <= options.hardMaxLength)
        return [...prefix, merged]

    return [...prefix, ...splitChunk(merged, options)]
}
