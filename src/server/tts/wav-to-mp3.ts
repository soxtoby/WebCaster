import * as lamejs from '@breezystack/lamejs'

type WavData = {
    audioFormat: number
    channels: number
    sampleRate: number
    bitsPerSample: number
    data: Uint8Array
}

export function convertWavToMp3Bytes(wavBytes: Uint8Array, bitrateKbps = 128) {
    let wav = parseWav(wavBytes)
    if (wav.channels < 1 || wav.channels > 2)
        throw new Error(`Unsupported WAV channel count: ${wav.channels}`)

    let channelSamples = extractChannelSamples(wav)
    let leftChannel = channelSamples[0]
    let rightChannel = channelSamples[1]
    if (!leftChannel)
        throw new Error('Voicebox returned an invalid WAV channel layout')

    let encoder = new lamejs.Mp3Encoder(wav.channels, wav.sampleRate, bitrateKbps)
    let frameSize = 1152
    let chunks: Uint8Array[] = []
    let totalLength = 0

    for (let offset = 0; offset < leftChannel.length; offset += frameSize) {
        let left = leftChannel.subarray(offset, offset + frameSize)
        let encoded = wav.channels == 2
            ? encoder.encodeBuffer(left, rightChannel ? rightChannel.subarray(offset, offset + frameSize) : left)
            : encoder.encodeBuffer(left)

        if (encoded.length > 0) {
            chunks.push(encoded)
            totalLength += encoded.length
        }
    }

    let flushed = encoder.flush()
    if (flushed.length > 0) {
        chunks.push(flushed)
        totalLength += flushed.length
    }

    let result = new Uint8Array(totalLength)
    let writeOffset = 0
    for (let chunk of chunks) {
        result.set(chunk, writeOffset)
        writeOffset += chunk.length
    }

    return result
}

function parseWav(bytes: Uint8Array): WavData {
    if (bytes.byteLength < 44)
        throw new Error('Voicebox returned an invalid WAV file')

    let view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    if (readAscii(bytes, 0, 4) != 'RIFF' || readAscii(bytes, 8, 4) != 'WAVE')
        throw new Error('Voicebox returned an unsupported WAV container')

    let offset = 12
    let audioFormat = 0
    let channels = 0
    let sampleRate = 0
    let bitsPerSample = 0
    let data: Uint8Array | null = null

    while (offset + 8 <= bytes.byteLength) {
        let chunkId = readAscii(bytes, offset, 4)
        let chunkSize = view.getUint32(offset + 4, true)
        let chunkDataOffset = offset + 8
        let paddedChunkSize = chunkSize + (chunkSize % 2)

        if (chunkDataOffset + chunkSize > bytes.byteLength)
            break

        if (chunkId == 'fmt ') {
            audioFormat = view.getUint16(chunkDataOffset, true)
            channels = view.getUint16(chunkDataOffset + 2, true)
            sampleRate = view.getUint32(chunkDataOffset + 4, true)
            bitsPerSample = view.getUint16(chunkDataOffset + 14, true)
        }

        if (chunkId == 'data')
            data = bytes.slice(chunkDataOffset, chunkDataOffset + chunkSize)

        offset = chunkDataOffset + paddedChunkSize
    }

    if (!data || !audioFormat || !channels || !sampleRate || !bitsPerSample)
        throw new Error('Voicebox returned an incomplete WAV file')

    if (audioFormat != 1 && audioFormat != 3)
        throw new Error(`Unsupported WAV encoding format: ${audioFormat}`)

    return {
        audioFormat,
        channels,
        sampleRate,
        bitsPerSample,
        data
    }
}

function extractChannelSamples(wav: WavData) {
    let interleaved = wav.audioFormat == 3
        ? floatWavToInt16(wav.data, wav.channels, wav.bitsPerSample)
        : pcmWavToInt16(wav.data, wav.channels, wav.bitsPerSample)

    let perChannelLength = Math.floor(interleaved.length / wav.channels)
    let channels = Array.from({ length: wav.channels }, () => new Int16Array(perChannelLength))

    for (let sampleIndex = 0; sampleIndex < perChannelLength; sampleIndex += 1) {
        for (let channelIndex = 0; channelIndex < wav.channels; channelIndex += 1) {
            let channel = channels[channelIndex]
            if (channel)
                channel[sampleIndex] = interleaved[(sampleIndex * wav.channels) + channelIndex] || 0
        }
    }

    return channels
}

function pcmWavToInt16(data: Uint8Array, channels: number, bitsPerSample: number) {
    let view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    let bytesPerSample = bitsPerSample / 8
    let frameCount = Math.floor(data.byteLength / (bytesPerSample * channels))
    let samples = new Int16Array(frameCount * channels)

    for (let index = 0; index < frameCount * channels; index += 1) {
        let offset = index * bytesPerSample

        if (bitsPerSample == 16) {
            samples[index] = view.getInt16(offset, true)
            continue
        }

        if (bitsPerSample == 24) {
            let sample = (data[offset] || 0) | ((data[offset + 1] || 0) << 8) | ((data[offset + 2] || 0) << 16)
            if (sample & 0x800000)
                sample |= ~0xffffff
            samples[index] = clampInt16(sample >> 8)
            continue
        }

        if (bitsPerSample == 32) {
            samples[index] = clampInt16(view.getInt32(offset, true) >> 16)
            continue
        }

        throw new Error(`Unsupported PCM WAV bit depth: ${bitsPerSample}`)
    }

    return samples
}

function floatWavToInt16(data: Uint8Array, channels: number, bitsPerSample: number) {
    let view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    let bytesPerSample = bitsPerSample / 8
    let frameCount = Math.floor(data.byteLength / (bytesPerSample * channels))
    let samples = new Int16Array(frameCount * channels)

    for (let index = 0; index < frameCount * channels; index += 1) {
        let offset = index * bytesPerSample
        let sample = bitsPerSample == 32
            ? view.getFloat32(offset, true)
            : bitsPerSample == 64
                ? view.getFloat64(offset, true)
                : NaN

        if (!Number.isFinite(sample))
            throw new Error(`Unsupported float WAV bit depth: ${bitsPerSample}`)

        samples[index] = clampInt16(Math.round(Math.max(-1, Math.min(1, sample)) * 32767))
    }

    return samples
}

function clampInt16(value: number) {
    return Math.max(-32768, Math.min(32767, value))
}

function readAscii(bytes: Uint8Array, start: number, length: number) {
    return String.fromCharCode(...bytes.slice(start, start + length))
}