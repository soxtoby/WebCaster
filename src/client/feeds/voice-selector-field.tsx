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
            >
                Choose voice
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

let buttonStyle = style('voiceSelectorButton', {
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: [9, 12],
    backgroundColor: 'transparent',
    color: 'inherit',
    cursor: 'pointer'
})
let voicePickerInlineStyle = style('voiceSelectorInline', {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    gap: 8,
    alignItems: 'center',
    cursor: 'pointer'
})
