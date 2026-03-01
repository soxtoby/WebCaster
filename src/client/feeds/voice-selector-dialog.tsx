import { type ChangeEvent, useEffect, useRef, useState } from "react"
import { classes, style } from "stylemap"
import { useVoicePreview } from "./use-voice-preview"
import { type VoiceOption } from "./voice-selector-field"

export function VoiceSelectorDialog(props: {
    id: string
    value: string
    options: VoiceOption[]
    onSave: (value: string) => void
}) {
    let [pendingVoiceId, setPendingVoiceId] = useState(props.value)
    let [openScrollVersion, setOpenScrollVersion] = useState(0)
    let [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all')
    let [textFilter, setTextFilter] = useState('')
    let voicePreview = useVoicePreview()
    let selectedVoiceRef = useRef<HTMLDivElement | null>(null)
    let normalizedTextFilter = textFilter.trim().toLowerCase()
    let filteredOptions = props.options.filter(option => {
        let matchesGender = genderFilter == 'all' || option.gender == genderFilter
        if (!matchesGender)
            return false

        if (!normalizedTextFilter)
            return true

        let searchable = `${option.name} ${option.description} ${option.provider} ${option.gender}`.toLowerCase()
        return searchable.includes(normalizedTextFilter)
    })

    useEffect(() => {
        let frameId = requestAnimationFrame(() => {
            if (selectedVoiceRef.current)
                selectedVoiceRef.current.scrollIntoView({ block: 'center' })
        })

        return () => cancelAnimationFrame(frameId)
    }, [pendingVoiceId, openScrollVersion])

    return <dialog
        id={props.id}
        className={classes(voiceModalStyle)}
        onToggle={event => {
            if (event.newState == 'open') {
                setPendingVoiceId(props.value)
                setGenderFilter('all')
                setTextFilter('')
                setOpenScrollVersion(current => current + 1)
            }
        }}
        aria-label="Voice selector"
    >
        <div className={classes(voiceModalHeaderStyle)}>
            <h3 className={classes(voiceModalHeadingStyle)}>Select voice</h3>
            <button
                className={classes(closeButtonStyle)}
                commandFor={props.id}
                command="close"
                type="button"
                aria-label="Close"
            >
                <svg className={classes(closeIconStyle)} viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 6L18 18M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
            </button>
        </div>
        <div className={classes(voiceModalInnerStyle)}>
            <div className={classes(voiceFiltersStyle)}>
                <input
                    className={classes([inputStyle, voiceFilterInputStyle])}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => setTextFilter(event.target.value)}
                    placeholder="Filter voices"
                    type="text"
                    value={textFilter}
                />
                <div className={classes(voiceGenderFilterRowStyle)}>
                    <button
                        className={classes([buttonStyle, genderFilter == 'all' && primaryButtonStyle])}
                        onClick={() => setGenderFilter('all')}
                        type="button"
                    >
                        All
                    </button>
                    <button
                        className={classes([buttonStyle, genderFilter == 'male' && primaryButtonStyle])}
                        onClick={() => setGenderFilter('male')}
                        type="button"
                    >
                        Male
                    </button>
                    <button
                        className={classes([buttonStyle, genderFilter == 'female' && primaryButtonStyle])}
                        onClick={() => setGenderFilter('female')}
                        type="button"
                    >
                        Female
                    </button>
                </div>
            </div>
            {props.options.length == 0 ? <p className={classes(statusStyle)}>No voices available</p> : null}
            {props.options.length > 0
                ? <div className={classes(voicePreviewListStyle)}>
                    {filteredOptions.map(option => {
                        let isSelected = pendingVoiceId == option.id
                        let isPlaying = voicePreview.playingVoiceId == option.id
                        let isPreviewing = voicePreview.previewingVoiceId == option.id
                        let isUnavailable = option.provider == 'saved'

                        return <div
                            className={classes([voicePreviewRowStyle, isSelected && voicePreviewSelectedRowStyle])}
                            key={`${option.id}:preview`}
                            ref={isSelected ? selectedVoiceRef : null}
                            onClick={() => setPendingVoiceId(option.id)}
                        >
                            <div className={classes(voicePreviewLabelStyle)}>
                                <span className={classes(voicePreviewNameStyle)}>{option.name}</span>
                                <span className={classes(voicePreviewMetaStyle)}>{buildVoiceMetaLabel(option)}</span>
                            </div>
                            <div className={classes(voicePreviewButtonRowStyle)}>
                                <button
                                    className={classes([buttonStyle, previewIconButtonStyle])}
                                    disabled={isUnavailable || isPreviewing}
                                    aria-label={buildPreviewAriaLabel(isUnavailable, isPreviewing, isPlaying)}
                                    title={buildPreviewAriaLabel(isUnavailable, isPreviewing, isPlaying)}
                                    onClick={event => {
                                        event.stopPropagation()
                                        if (isPlaying)
                                            voicePreview.stopVoicePreview()
                                        else
                                            void voicePreview.previewVoice(option.id)
                                    }}
                                    type="button"
                                >
                                    {buildPreviewIcon(isUnavailable, isPreviewing, isPlaying)}
                                </button>
                            </div>
                        </div>
                    })}
                    {filteredOptions.length == 0 ? <p className={classes(statusStyle)}>No voices match filters.</p> : null}
                </div>
                : null}
            {voicePreview.previewError ? <p className={classes(errorStyle)}>{voicePreview.previewError}</p> : null}
        </div>
        <form
            method="dialog"
            className={classes(voiceModalActionsStyle)}
            onSubmit={() => props.onSave(pendingVoiceId)}
        >
            <div />
            <div className={classes(footerActionsStyle)}>
                <button className={classes(buttonStyle)} commandFor={props.id} command="close" type="button">Cancel</button>
                <button
                    className={classes([buttonStyle, primaryButtonStyle])}
                    disabled={!pendingVoiceId || pendingVoiceId == props.value}
                    type="submit"
                >
                    Save
                </button>
            </div>
        </form>
    </dialog>
}

function buildVoiceMetaLabel(option: VoiceOption) {
    let pieces = []
    if (option.description)
        pieces.push(option.description)
    pieces.push(option.gender)
    pieces.push(option.provider)
    return pieces.join(' · ')
}

function buildPreviewIcon(isUnavailable: boolean, isPreviewing: boolean, isPlaying: boolean) {
    if (isUnavailable)
        return <svg className={classes(previewIconStyle)} viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M7 7L17 17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>

    if (isPreviewing)
        return <svg className={classes(previewIconStyle)} viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.35" />
            <path d="M12 4a8 8 0 0 1 8 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>

    if (isPlaying)
        return <svg className={classes(previewIconStyle)} viewBox="0 0 24 24" aria-hidden="true">
            <rect x="7" y="6" width="3.5" height="12" rx="1" fill="currentColor" />
            <rect x="13.5" y="6" width="3.5" height="12" rx="1" fill="currentColor" />
        </svg>

    return <svg className={classes(previewIconStyle)} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 6l10 6-10 6z" fill="currentColor" />
    </svg>
}

function buildPreviewAriaLabel(isUnavailable: boolean, isPreviewing: boolean, isPlaying: boolean) {
    if (isUnavailable)
        return 'Preview unavailable'

    if (isPreviewing)
        return 'Loading preview'

    if (isPlaying)
        return 'Pause preview'

    return 'Play preview'
}

let inputStyle = style('voiceSelectorDialogInput', {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid var(--border)',
    borderRadius: 6,
    fontSize: 13,
    backgroundColor: 'var(--bg)',
    color: 'var(--text)',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    minHeight: 34,
    $: {
        '&:hover': {
            borderColor: 'var(--muted)'
        },
        '&:focus': {
            borderColor: 'var(--accent)',
            boxShadow: '0 0 0 2px color-mix(in srgb, var(--accent) 20%, transparent)'
        }
    }
})

let voiceFilterInputStyle = style('voiceSelectorDialogFilterInput', {
    flex: 1,
    minWidth: 0
})

let buttonStyle = style('voiceSelectorDialogButton', {
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

let previewIconButtonStyle = style('voiceSelectorDialogPreviewIconButton', {
    width: 36,
    height: 36,
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
})

let previewIconStyle = style('voiceSelectorDialogPreviewIcon', {
    width: 16,
    height: 16,
    display: 'block'
})

let primaryButtonStyle = style('voiceSelectorDialogPrimaryButton', {
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

let statusStyle = style('voiceSelectorDialogStatus', {
    margin: [4, 0, 0, 0],
    color: 'var(--muted)'
})

let errorStyle = style('voiceSelectorDialogError', {
    margin: [6, 0, 0, 0],
    color: 'var(--danger)'
})

let voicePreviewListStyle = style('voiceSelectorDialogPreviewList', {
    display: 'grid',
    gap: 6,
    alignContent: 'start',
    flex: '1 1 auto',
    minHeight: 0,
    overflowY: 'auto',
    marginLeft: -20,
    marginRight: -20,
    padding: '8px 20px',
    scrollbarGutter: 'stable'
})

let voiceModalStyle = style('voiceSelectorDialog', {
    width: '100%',
    maxWidth: 600,
    maxHeight: '80vh',
    overflow: 'hidden',
    backgroundColor: 'var(--panel)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    boxShadow: '0 8px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
    padding: 0,
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

let voiceModalInnerStyle = style('voiceSelectorDialogInner', {
    display: 'flex',
    flexDirection: 'column',
    padding: '20px 20px 0 20px',
    gap: 0,
    flex: 1,
    minHeight: 0,
    overflow: 'hidden'
})

let voiceModalHeaderStyle = style('voiceSelectorDialogHeader', {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 20px',
    borderBottom: '1px solid var(--border)',
    backgroundColor: 'var(--bg)'
})

let voiceModalHeadingStyle = style('voiceSelectorDialogHeading', {
    margin: 0,
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--text)'
})

let closeButtonStyle = style('voiceSelectorDialogCloseButton', {
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

let closeIconStyle = style('voiceSelectorDialogCloseIcon', {
    width: 16,
    height: 16,
    display: 'block'
})

let voiceFiltersStyle = style('voiceSelectorDialogFilters', {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 12,
    borderBottom: '1px solid var(--border)',
    flexWrap: 'nowrap'
})

let voiceGenderFilterRowStyle = style('voiceSelectorDialogGenderFilters', {
    display: 'flex',
    gap: 6,
    flexWrap: 'nowrap'
})

let voiceModalActionsStyle = style('voiceSelectorDialogActions', {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 20px',
    borderTop: '1px solid var(--border)',
    backgroundColor: 'var(--bg)',
    gap: 12
})

let footerActionsStyle = style('voiceSelectorDialogFooterActions', {
    display: 'flex',
    gap: 8,
    flexShrink: 0
})

let voicePreviewRowStyle = style('voiceSelectorDialogPreviewRow', {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    gap: 8,
    alignItems: 'center',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: [8, 10],
    cursor: 'pointer'
})

let voicePreviewSelectedRowStyle = style('voiceSelectorDialogPreviewSelectedRow', {
    borderColor: 'var(--accent)',
    backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)'
})

let voicePreviewButtonRowStyle = style('voiceSelectorDialogPreviewButtonRow', {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'end'
})

let voicePreviewLabelStyle = style('voiceSelectorDialogPreviewLabel', {
    display: 'grid',
    gap: 2,
    overflowWrap: 'anywhere'
})

let voicePreviewNameStyle = style('voiceSelectorDialogPreviewName', {
    fontSize: 14,
    color: 'var(--text)',
    fontWeight: 600
})

let voicePreviewMetaStyle = style('voiceSelectorDialogPreviewMeta', {
    fontSize: 12,
    color: 'var(--muted)'
})
