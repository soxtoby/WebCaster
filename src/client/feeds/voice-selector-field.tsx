import { type ChangeEvent, useEffect, useRef, useState } from "react"
import { classes, style } from "stylemap"
import { useVoicePreview } from "./use-voice-preview"

export type VoiceOption = {
    id: string
    name: string
    description: string
    gender: 'male' | 'female' | 'unknown'
    provider: string
}

export function VoiceSelectorField(props: {
    label: string
    value: string
    options: VoiceOption[]
    onChange: (value: string) => void
}) {
    let [isOpen, setIsOpen] = useState(false)
    let [pendingVoiceId, setPendingVoiceId] = useState(props.value)
    let [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all')
    let [textFilter, setTextFilter] = useState('')
    let voicePreview = useVoicePreview()
    let selectedOption = props.options.find(option => option.id == props.value) || null
    let voiceSummaryText = buildVoiceSummaryText(selectedOption, props.value)
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
        if (isOpen && selectedVoiceRef.current)
            selectedVoiceRef.current.scrollIntoView({ block: 'nearest' })
    }, [isOpen, pendingVoiceId])

    return <div className={classes(fieldGroupStyle)}>
        <span className={classes(labelStyle)}>{props.label}</span>
        <div
            className={classes(voicePickerInlineStyle)}
            onClick={() => {
                setPendingVoiceId(props.value)
                setGenderFilter('all')
                setTextFilter('')
                setIsOpen(true)
            }}
            onKeyDown={event => {
                if (event.key == 'Enter' || event.key == ' ') {
                    event.preventDefault()
                    setPendingVoiceId(props.value)
                    setGenderFilter('all')
                    setTextFilter('')
                    setIsOpen(true)
                }
            }}
            role="button"
            tabIndex={0}
        >
            <div className={classes(inputStyle)}>{voiceSummaryText}</div>
            <button
                className={classes(buttonStyle)}
                type="button"
            >
                Choose voice
            </button>
        </div>
        {isOpen
            ? <div className={classes(voiceModalBackdropStyle)} onClick={() => setIsOpen(false)}>
                <div
                    className={classes(voiceModalStyle)}
                    onClick={event => event.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Voice selector"
                >
                    <div className={classes(voiceModalHeaderStyle)}>
                        <h3 className={classes(voiceModalHeadingStyle)}>Select voice</h3>
                    </div>
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
                    <div className={classes(voiceModalActionsStyle)}>
                        <button className={classes(buttonStyle)} onClick={() => setIsOpen(false)} type="button">Cancel</button>
                        <button
                            className={classes([buttonStyle, primaryButtonStyle])}
                            disabled={!pendingVoiceId || pendingVoiceId == props.value}
                            onClick={() => {
                                props.onChange(pendingVoiceId)
                                setIsOpen(false)
                            }}
                            type="button"
                        >
                            Save
                        </button>
                    </div>
                </div>
            </div>
            : null}
        {voicePreview.previewError ? <p className={classes(errorStyle)}>{voicePreview.previewError}</p> : null}
    </div>
}

function buildVoiceLabel(option: VoiceOption) {
    let pieces = [option.name]
    if (option.description)
        pieces.push(option.description)
    pieces.push(option.gender)
    pieces.push(option.provider)
    return pieces.join(' · ')
}

function buildVoiceMetaLabel(option: VoiceOption) {
    let pieces = []
    if (option.description)
        pieces.push(option.description)
    pieces.push(option.gender)
    pieces.push(option.provider)
    return pieces.join(' · ')
}

function buildVoiceSummaryText(option: VoiceOption | null, selectedVoiceId: string) {
    if (!selectedVoiceId)
        return 'No voice selected'

    if (!option)
        return 'Selected voice'

    if (option.provider == 'saved' && option.description == 'Saved voice')
        return 'Saved voice'

    return buildVoiceLabel(option)
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

let fieldGroupStyle = style('voiceSelectorFieldGroup', {
    display: 'grid',
    gap: 6
})

let labelStyle = style('voiceSelectorLabel', {
    fontSize: 13,
    color: 'var(--muted)'
})

let inputStyle = style('voiceSelectorInput', {
    width: '100%',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: [10, 12],
    backgroundColor: 'transparent',
    color: 'inherit'
})

let voiceFilterInputStyle = style('voiceSelectorFilterInput', {
    flex: 1,
    minWidth: 0
})

let buttonStyle = style('voiceSelectorButton', {
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: [9, 12],
    backgroundColor: 'transparent',
    color: 'inherit',
    cursor: 'pointer'
})

let previewIconButtonStyle = style('voiceSelectorPreviewIconButton', {
    width: 36,
    height: 36,
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
})

let previewIconStyle = style('voiceSelectorPreviewIcon', {
    width: 16,
    height: 16,
    display: 'block'
})

let primaryButtonStyle = style('voiceSelectorPrimaryButton', {
    backgroundColor: 'var(--accent)',
    borderColor: 'var(--accent)',
    color: 'var(--accent-text)'
})

let statusStyle = style('voiceSelectorStatus', {
    margin: [4, 0, 0, 0],
    color: 'var(--muted)'
})

let errorStyle = style('voiceSelectorError', {
    margin: [6, 0, 0, 0],
    color: 'var(--danger)'
})

let voicePreviewListStyle = style('voiceSelectorPreviewList', {
    display: 'grid',
    gap: 6,
    marginTop: 6,
    maxHeight: 320,
    overflowY: 'auto',
    paddingRight: 2
})

let voicePickerInlineStyle = style('voiceSelectorInline', {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    gap: 8,
    alignItems: 'center',
    cursor: 'pointer'
})

let voiceModalBackdropStyle = style('voiceSelectorModalBackdrop', {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    display: 'grid',
    placeItems: 'center',
    padding: 16,
    zIndex: 1000
})

let voiceModalStyle = style('voiceSelectorModal', {
    width: 'min(760px, 100%)',
    maxHeight: '80vh',
    overflow: 'hidden',
    display: 'grid',
    gridTemplateRows: 'auto minmax(0, 1fr)',
    backgroundColor: 'var(--panel)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 12
})

let voiceModalHeaderStyle = style('voiceSelectorModalHeader', {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6
})

let voiceModalHeadingStyle = style('voiceSelectorModalHeading', {
    margin: 0,
    fontSize: 16
})

let voiceFiltersStyle = style('voiceSelectorFilters', {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    flexWrap: 'nowrap'
})

let voiceGenderFilterRowStyle = style('voiceSelectorGenderFilters', {
    display: 'flex',
    gap: 6,
    flexWrap: 'nowrap'
})

let voiceModalActionsStyle = style('voiceSelectorModalActions', {
    display: 'flex',
    justifyContent: 'end',
    gap: 8,
    marginTop: 8
})

let voicePreviewRowStyle = style('voiceSelectorPreviewRow', {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    gap: 8,
    alignItems: 'center',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: [8, 10],
    cursor: 'pointer'
})

let voicePreviewSelectedRowStyle = style('voiceSelectorPreviewSelectedRow', {
    borderColor: 'var(--accent)',
    backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)'
})

let voicePreviewButtonRowStyle = style('voiceSelectorPreviewButtonRow', {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'end'
})

let voicePreviewLabelStyle = style('voiceSelectorPreviewLabel', {
    display: 'grid',
    gap: 2,
    overflowWrap: 'anywhere'
})

let voicePreviewNameStyle = style('voiceSelectorPreviewName', {
    fontSize: 14,
    color: 'var(--text)',
    fontWeight: 600
})

let voicePreviewMetaStyle = style('voiceSelectorPreviewMeta', {
    fontSize: 12,
    color: 'var(--muted)'
})
