import { useEffect, useRef, useState } from "react"

export function useVoicePreview() {
    let [previewingVoiceId, setPreviewingVoiceId] = useState('')
    let [playingVoiceId, setPlayingVoiceId] = useState('')
    let [previewError, setPreviewError] = useState('')
    let previewAudioRef = useRef<HTMLAudioElement | null>(null)
    let previewAbortRef = useRef<AbortController | null>(null)
    let previewObjectUrlRef = useRef('')
    let previewRequestRef = useRef(0)
    let loadingTimerRef = useRef<number | null>(null)

    useEffect(() => stopVoicePreview, [])

    async function previewVoice(voiceId: string) {
        let resolvedVoiceId = voiceId.trim()
        if (!resolvedVoiceId)
            return

        setPreviewError('')
        stopVoicePreview(false)

        let requestId = previewRequestRef.current + 1
        previewRequestRef.current = requestId
        loadingTimerRef.current = window.setTimeout(() => {
            if (previewRequestRef.current != requestId)
                return

            setPreviewingVoiceId(resolvedVoiceId)
        }, 100)

        try {
            let controller = new AbortController()
            previewAbortRef.current = controller

            let response = await fetchPreviewAudio(buildVoicePreviewUrl(resolvedVoiceId), controller)
            if (!response.ok)
                throw new Error('Could not fetch voice preview')

            let previewBlob = await response.blob()
            if (previewRequestRef.current != requestId)
                return

            let objectUrl = URL.createObjectURL(previewBlob)
            previewObjectUrlRef.current = objectUrl

            let audio = new Audio(objectUrl)
            previewAudioRef.current = audio
            audio.onended = () => {
                if (previewRequestRef.current != requestId)
                    return

                releasePreviewObjectUrl()
                setPlayingVoiceId('')
                setPreviewingVoiceId('')
            }

            audio.onerror = () => {
                if (previewRequestRef.current != requestId)
                    return

                releasePreviewObjectUrl()
                setPreviewError('Could not play voice preview')
                setPlayingVoiceId('')
                setPreviewingVoiceId('')
            }

            await audio.play()
            if (previewRequestRef.current != requestId) {
                audio.pause()
                releasePreviewObjectUrl()
                return
            }

            clearLoadingTimer()
            setPlayingVoiceId(resolvedVoiceId)
            setPreviewingVoiceId('')
        }
        catch {
            if (previewRequestRef.current != requestId)
                return

            clearLoadingTimer()
            setPreviewError('Could not play voice preview')
            setPlayingVoiceId('')
            setPreviewingVoiceId('')
        }
    }

    function stopVoicePreview(clearError = true) {
        previewRequestRef.current += 1
        clearLoadingTimer()
        previewAbortRef.current?.abort()
        previewAbortRef.current = null

        let currentAudio = previewAudioRef.current
        if (currentAudio) {
            currentAudio.pause()
            currentAudio.currentTime = 0
            currentAudio.src = ''
            previewAudioRef.current = null
        }

        releasePreviewObjectUrl()

        if (clearError)
            setPreviewError('')

        setPlayingVoiceId('')
        setPreviewingVoiceId('')
    }

    function clearLoadingTimer() {
        if (loadingTimerRef.current != null) {
            clearTimeout(loadingTimerRef.current)
            loadingTimerRef.current = null
        }
    }

    function releasePreviewObjectUrl() {
        let objectUrl = previewObjectUrlRef.current
        if (!objectUrl)
            return

        URL.revokeObjectURL(objectUrl)
        previewObjectUrlRef.current = ''
    }

    return {
        previewingVoiceId,
        playingVoiceId,
        previewError,
        previewVoice,
        stopVoicePreview
    }
}

function buildVoicePreviewUrl(voiceId: string) {
    return `/preview/${encodeURIComponent(voiceId)}`
}

function fetchPreviewAudio(url: string, controller: AbortController) {
    return fetch(url, {
        cache: 'no-store',
        signal: controller.signal
    })
}
