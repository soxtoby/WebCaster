import { useEffect, useRef, useState } from "react"

export function useVoicePreview() {
    let [previewingVoiceId, setPreviewingVoiceId] = useState('')
    let [playingVoiceId, setPlayingVoiceId] = useState('')
    let [previewError, setPreviewError] = useState('')
    let previewAudioRef = useRef<HTMLAudioElement | null>(null)
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

        let audio = new Audio(buildVoicePreviewUrl(resolvedVoiceId))
        previewAudioRef.current = audio
        audio.onended = () => {
            if (previewRequestRef.current != requestId)
                return

            setPlayingVoiceId('')
            setPreviewingVoiceId('')
        }

        audio.onerror = () => {
            if (previewRequestRef.current != requestId)
                return

            setPreviewError('Could not play voice preview')
            setPlayingVoiceId('')
            setPreviewingVoiceId('')
        }

        try {
            await audio.play()
            if (previewRequestRef.current != requestId) {
                audio.pause()
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

        let currentAudio = previewAudioRef.current
        if (currentAudio) {
            currentAudio.pause()
            currentAudio.currentTime = 0
            currentAudio.src = ''
            previewAudioRef.current = null
        }

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
