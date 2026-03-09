import { useRef, useState } from "react"
import { classes, style } from "stylemap"
import { api } from "../api"

type EpisodeTranscriptTarget = {
    episodeKey: string
    title: string
}

export function EpisodeTranscriptDialog(props: {
    feedId: number
    feedTitle: string
    episode: EpisodeTranscriptTarget
}) {
    let [transcriptText, setTranscriptText] = useState('')
    let [transcriptStatus, setTranscriptStatus] = useState('')
    let [transcriptError, setTranscriptError] = useState('')
    let [isRegeneratingTranscript, setIsRegeneratingTranscript] = useState(false)
    let requestVersionRef = useRef(0)
    let dialogId = buildEpisodeTranscriptDialogId(props.episode.episodeKey)

    return <dialog
        id={dialogId}
        className={classes(transcriptDialogStyle)}
        onToggle={event => {
            if (event.newState == 'open')
                void loadTranscript()
        }}
    >
        <div className={classes(transcriptDialogHeaderStyle)}>
            <div className={classes(transcriptDialogTitleWrapStyle)}>
                <h3 className={classes(transcriptDialogTitleStyle)}>{props.feedTitle}</h3>
                <p className={classes(transcriptDialogEpisodeTitleStyle)}>{props.episode.title}</p>
            </div>
            <button
                className={classes(transcriptDialogCloseStyle)}
                commandFor={dialogId}
                command="close"
                type="button"
                aria-label="Close"
            >
                <svg className={classes(transcriptDialogCloseIconStyle)} viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 6L18 18M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
            </button>
        </div>

        <div className={classes(transcriptDialogBodyStyle)}>
            {transcriptStatus ? <p className={classes(transcriptDialogStatusStyle)}>{transcriptStatus}</p> : null}
            {transcriptError ? <p className={classes(transcriptDialogErrorStyle)}>{transcriptError}</p> : null}
            {transcriptText ? <pre className={classes(transcriptContentStyle)}>{transcriptText}</pre> : null}
            {!transcriptText && !transcriptError && !transcriptStatus
                ? <p className={classes(transcriptDialogStatusStyle)}>No transcript available.</p>
                : null}
        </div>

        <div className={classes(transcriptDialogFooterStyle)}>
            <button
                className={classes(transcriptFooterButtonStyle)}
                commandFor={dialogId}
                command="close"
                type="button"
            >
                Close
            </button>
            <button
                className={classes([transcriptFooterButtonStyle, transcriptPrimaryButtonStyle])}
                onClick={() => void regenerateTranscript()}
                disabled={isRegeneratingTranscript || transcriptStatus == 'Loading transcript...'}
                type="button"
            >
                {isRegeneratingTranscript ? 'Regenerating...' : 'Regenerate'}
            </button>
        </div>
    </dialog>

    async function loadTranscript() {
        let requestVersion = ++requestVersionRef.current

        setTranscriptText('')
        setTranscriptStatus('Loading transcript...')
        setTranscriptError('')

        try {
            let result = await api.feeds.episodeTranscript.query({
                id: props.feedId,
                episodeKey: props.episode.episodeKey
            })
            let transcript = result.transcript
            if (requestVersion !== requestVersionRef.current)
                return

            setTranscriptText(transcript)
            setTranscriptStatus('')
        }
        catch (cause) {
            if (requestVersion !== requestVersionRef.current)
                return

            let message = cause instanceof Error ? cause.message : 'Failed to load transcript'
            setTranscriptError(message)
            setTranscriptStatus('')
        }
    }

    async function regenerateTranscript() {
        let requestVersion = ++requestVersionRef.current

        setTranscriptError('')
        setTranscriptStatus('Regenerating transcript...')
        setIsRegeneratingTranscript(true)

        try {
            let result = await api.feeds.regenerateEpisodeTranscript.mutate({
                id: props.feedId,
                episodeKey: props.episode.episodeKey
            })
            let transcript = result.transcript
            if (requestVersion !== requestVersionRef.current)
                return

            setTranscriptText(transcript)
            setTranscriptStatus('Transcript regenerated')
        }
        catch (cause) {
            if (requestVersion !== requestVersionRef.current)
                return

            let message = cause instanceof Error ? cause.message : 'Failed to regenerate transcript'
            setTranscriptError(message)
            setTranscriptStatus('')
        }
        finally {
            if (requestVersion == requestVersionRef.current)
                setIsRegeneratingTranscript(false)
        }
    }
}

export function buildEpisodeTranscriptDialogId(episodeKey: string) {
    return `episode-transcript-${episodeKey}`
}

let transcriptDialogStyle = style('transcriptDialog', {
    width: '100%',
    maxWidth: 960,
    maxHeight: '80vh',
    overflow: 'hidden',
    backgroundColor: 'var(--panel)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    color: 'var(--text)',
    padding: 0,
    boxShadow: '0 8px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
    $: {
        '&[open]': {
            display: 'flex',
            flexDirection: 'column'
        },
        '&::backdrop': {
            backgroundColor: 'color-mix(in srgb, var(--bg) 60%, transparent)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)'
        }
    }
})

let transcriptDialogHeaderStyle = style('transcriptDialogHeader', {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 20px',
    borderBottom: '1px solid var(--border)',
    backgroundColor: 'var(--bg)'
})

let transcriptDialogTitleWrapStyle = style('transcriptDialogTitleWrap', {
    flex: 1,
    minWidth: 0,
    display: 'grid',
    gap: 4,
    textAlign: 'left',
    justifyItems: 'start'
})

let transcriptDialogTitleStyle = style('transcriptDialogTitle', {
    margin: 0,
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--text)'
})

let transcriptDialogEpisodeTitleStyle = style('transcriptDialogEpisodeTitle', {
    margin: 0,
    color: 'var(--muted)',
    fontSize: 12,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
})

let transcriptDialogCloseStyle = style('transcriptDialogClose', {
    background: 'none',
    border: 'none',
    color: 'var(--muted)',
    width: 36,
    height: 36,
    padding: 0,
    cursor: 'pointer',
    borderRadius: 4,
    display: 'grid',
    placeItems: 'center',
    transition: 'all 0.15s',
    $: {
        '&:hover': {
            backgroundColor: 'var(--border)',
            color: 'var(--text)'
        }
    }
})

let transcriptDialogCloseIconStyle = style('transcriptDialogCloseIcon', {
    width: 16,
    height: 16,
    display: 'block'
})

let transcriptDialogBodyStyle = style('transcriptDialogBody', {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '20px',
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    backgroundColor: 'var(--panel)'
})

let transcriptDialogStatusStyle = style('transcriptDialogStatus', {
    margin: 0,
    color: 'var(--muted)',
    fontSize: 13
})

let transcriptDialogErrorStyle = style('transcriptDialogError', {
    margin: 0,
    color: 'var(--danger)',
    fontSize: 13,
    fontWeight: 500
})

let transcriptContentStyle = style('transcriptContent', {
    margin: 0,
    textAlign: 'left',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontSize: 13,
    lineHeight: 1.5,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    backgroundColor: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: 12
})

let transcriptDialogFooterStyle = style('transcriptDialogFooter', {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: '12px 20px',
    borderTop: '1px solid var(--border)',
    backgroundColor: 'var(--bg)',
    gap: 12
})

let transcriptFooterButtonStyle = style('transcriptFooterButton', {
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '6px 14px',
    backgroundColor: 'var(--panel)',
    color: 'var(--text)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
    $: {
        '&:hover': {
            borderColor: 'var(--muted)',
            backgroundColor: 'var(--bg)'
        },
        '&:disabled': {
            opacity: 0.6,
            cursor: 'not-allowed'
        }
    }
})

let transcriptPrimaryButtonStyle = style('transcriptPrimaryButton', {
    backgroundColor: 'var(--accent)',
    borderColor: 'var(--accent)',
    color: 'var(--accent-text)',
    border: 'none',
    $: {
        '&:hover': {
            backgroundColor: 'color-mix(in srgb, var(--accent) 85%, black)',
            borderColor: 'transparent'
        }
    }
})