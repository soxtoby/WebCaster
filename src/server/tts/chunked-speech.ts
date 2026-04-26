type ChunkProgress = {
    chunksProcessed: number
    chunksTotal: number
}

type ChunkedSpeechOptions = {
    onChunkProgress?: (progress: ChunkProgress) => void
}

export function createChunkedSpeechStream(text: string, maxLength: number, loadChunkStream: (chunk: string) => Promise<ReadableStream<Uint8Array>>, options?: ChunkedSpeechOptions) {
    let chunks = splitTextIntoChunks(text, maxLength)
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

export function splitTextIntoChunks(text: string, maxLength: number = 2000): string[] {
    if (text.length <= maxLength)
        return [text]

    let chunks: string[] = []
    let remaining = text
    let minimumChunkLength = Math.min(50, maxLength)

    while (remaining.length > maxLength) {
        let window = remaining.slice(0, maxLength)
        let splitAt: number

        let paraIdx = findLastIndexAtOrAfter(window, '\n\n', minimumChunkLength)
        if (paraIdx > 0) {
            splitAt = paraIdx + 2
        } else {
            let newlineIdx = findLastInlineNewline(window)
            if (newlineIdx > 0) {
                splitAt = newlineIdx + 1
            } else {
                let lastSentenceBreak = Array.from(window.matchAll(/[.!?](?:[ \t]+|\r?\n(?!\r?\n))+/g)).at(-1)
                if (lastSentenceBreak) {
                    splitAt = lastSentenceBreak.index + lastSentenceBreak[0].length
                } else {
                    let wordIdx = window.lastIndexOf(' ')
                    splitAt = wordIdx > 0 ? wordIdx + 1 : maxLength
                }
            }
        }

        chunks.push(remaining.slice(0, splitAt).trim())
        remaining = remaining.slice(splitAt).trimStart()
    }

    if (remaining.trim())
        chunks.push(remaining.trim())

    return chunks
}

function findLastIndexAtOrAfter(value: string, search: string, minimumLength: number): number {
    let index = value.lastIndexOf(search)

    if (index >= 0 && index + search.length >= minimumLength)
        return index

    return -1
}

function findLastInlineNewline(value: string): number {
    for (let index = value.length - 1; index >= 0; index -= 1) {
        if (value[index] != '\n')
            continue

        if (value[index - 1] == '\n' || value[index + 1] == '\n')
            continue

        return index
    }

    return -1
}
