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
    minLength?: number
    targetMaxLength: number
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

    if (text.length <= options.targetMaxLength) {
        chunks = [text.trim()]
    } else {
        chunks = []
        let paragraphs = splitParagraphs(text)
        let currentChunk = ''

        for (let paragraph of paragraphs) {
            currentChunk = (currentChunk + '\n\n' + paragraph).trim()

            while (currentChunk.length > options.targetMaxLength) {
                let splitAt = findSplitBoundaries(currentChunk, 0, options.targetMaxLength + 1).at(-1)
                    ?? findSplitBoundaries(currentChunk, options.targetMaxLength, options.hardMaxLength + 1)[0]

                if (!splitAt)
                    throw new Error(`TTS chunk contains a word longer than the hard limit of ${options.hardMaxLength} characters.`)

                chunks.push(currentChunk.slice(0, splitAt).trim())
                currentChunk = currentChunk.slice(splitAt).trimStart()
            }

            if (options.minLength && currentChunk.length >= options.minLength) {
                chunks.push(currentChunk)
                currentChunk = ''
            }
        }

        if (options.minLength
            && chunks.length
            && currentChunk.length < options.minLength
            && chunks.at(-1)!.length + currentChunk.length + 2 <= options.hardMaxLength
        ) {
            chunks[chunks.length - 1] += '\n\n' + currentChunk
        } else if (currentChunk) {
            chunks.push(currentChunk)
        }
    }

    return chunks
}

function resolveChunkSizeOptions(sizes: ChunkSizeOptions): ResolvedChunkSizeOptions {
    let targetMaxLength = sizes.targetMaxLength ?? sizes.hardMaxLength
    return {
        minLength: sizes.minLength,
        targetMaxLength: targetMaxLength,
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

function findSplitBoundaries(value: string, fromIndex: number, toIndex: number) {
    let sentenceBoundaries = findSentenceBoundaries(value, fromIndex, toIndex)
    return sentenceBoundaries.length
        ? sentenceBoundaries
        : findWordBoundaries(value, fromIndex, toIndex)
}

function findSentenceBoundaries(value: string, fromIndex: number, toIndex: number) {
    return value.slice(fromIndex, toIndex)
        .matchAll(/[.!?]["')\]]?(?=\s)/g)
        .toArray()
        .filter(match => !isDecimalPoint(value, match.index + fromIndex) && !isAbbreviation(value, match.index + fromIndex))
        .map(match => match.index + match[0].length + fromIndex)
}

function isDecimalPoint(value: string, index: number) {
    return /\d/.test(value[index - 1] || '') && /\d/.test(value[index + 1] || '')
}

function isAbbreviation(value: string, index: number) {
    let before = value.slice(Math.max(0, index - 12), index + 1)
    return /\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|e\.g|i\.e|U\.S|U\.K)\.$/i.test(before)
}

function findWordBoundaries(value: string, fromIndex: number, toIndex: number) {
    return value.slice(fromIndex, toIndex)
        .matchAll(/\s+/g)
        .toArray()
        .map(match => match.index + fromIndex)
}
