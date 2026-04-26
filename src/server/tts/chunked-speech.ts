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
    let chunks: string[] = []
    let remaining = text.trimStart()

    while (remaining.length > 0) {
        let splitAt: number | null = null

        if (remaining.length > maxLength) {
            let window = remaining.slice(0, maxLength)

            let paraIdx = window.lastIndexOf('\n\n')
            if (paraIdx > 0) {
                splitAt = paraIdx + 2
            } else {
                let newlineIdx = window.lastIndexOf('\n')
                if (newlineIdx > 0) {
                    splitAt = newlineIdx + 1
                } else {
                    let lastSentenceBreak = Array.from(window.matchAll(/[.!?]\s+/g)).at(-1)
                    if (lastSentenceBreak) {
                        splitAt = lastSentenceBreak.index + lastSentenceBreak[0].length
                    } else {
                        let wordIdx = window.lastIndexOf(' ')
                        splitAt = wordIdx > 0 ? wordIdx + 1 : maxLength
                    }
                }
            }
        } else {
            let searchFrom = 0
            let paraIdx: number
            while ((paraIdx = remaining.indexOf('\n\n', searchFrom)) !== -1) {
                if (paraIdx >= 50) {
                    splitAt = paraIdx + 2
                    break
                }
                searchFrom = paraIdx + 2
            }
        }

        if (splitAt != null) {
            chunks.push(remaining.slice(0, splitAt).trim())
            remaining = remaining.slice(splitAt).trimStart()
        } else {
            if (remaining.trim())
                chunks.push(remaining.trim())
            break
        }
    }

    return chunks
}