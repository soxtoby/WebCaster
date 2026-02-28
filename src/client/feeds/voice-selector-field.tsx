import { useState } from "react"
import { classes, style } from "stylemap"
import { VoiceSelectorDialog } from "./voice-selector-dialog"

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
    let selectedOption = props.options.find(option => option.id == props.value) || null
    let voiceSummaryText = buildVoiceSummaryText(selectedOption, props.value)

    return <div className={classes(fieldGroupStyle)}>
        <span className={classes(labelStyle)}>{props.label}</span>
        <div
            className={classes(voicePickerInlineStyle)}
            onClick={() => {
                setIsOpen(true)
            }}
            onKeyDown={event => {
                if (event.key == 'Enter' || event.key == ' ') {
                    event.preventDefault()
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
                title="Choose voice"
                aria-label="Choose voice"
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <circle cx="5" cy="12" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="19" cy="12" r="2" />
                </svg>
            </button>
        </div>
        {isOpen
            ? <VoiceSelectorDialog
                value={props.value}
                options={props.options}
                onCancel={() => setIsOpen(false)}
                onSave={value => {
                    props.onChange(value)
                    setIsOpen(false)
                }}
            />
            : null}
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

function buildVoiceSummaryText(option: VoiceOption | null, selectedVoiceId: string) {
    if (!selectedVoiceId)
        return 'No voice selected'

    if (!option)
        return 'Selected voice'

    if (option.provider == 'saved' && option.description == 'Saved voice')
        return 'Saved voice'

    return buildVoiceLabel(option)
}

let fieldGroupStyle = style('voiceSelectorFieldGroup', {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    minWidth: 0
})

let labelStyle = style('voiceSelectorLabel', {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--muted)'
})

let inputStyle = style('voiceSelectorInput', {
    width: '100%',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '8px 12px',
    backgroundColor: 'var(--bg)',
    color: 'var(--text)',
    minHeight: 34,
    display: 'flex',
    alignItems: 'center',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontSize: 13
})

let buttonStyle = style('voiceSelectorButton', {
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '8px',
    minHeight: 34,
    minWidth: 34,
    backgroundColor: 'var(--panel)',
    color: 'var(--text)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'border-color 0.15s',
    $: {
        '&:hover': {
            borderColor: 'var(--muted)'
        }
    }
})

let voicePickerInlineStyle = style('voiceSelectorInline', {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    gap: 8,
    alignItems: 'stretch',
    cursor: 'pointer'
})
