import { useId } from "react"
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
    let dialogId = useId()
    let selectedOption = props.options.find(option => option.id == props.value) || null
    let voiceSummaryText = buildVoiceSummaryText(selectedOption, props.value)

    return <div className={classes(fieldGroupStyle)}>
        <span className={classes(labelStyle)}>{props.label}</span>
        <button
            className={classes(voicePickerInlineStyle)}
            commandFor={dialogId}
            command="show-modal"
            type="button"
            title="Choose voice"
            aria-label={`Choose voice: ${voiceSummaryText}`}
        >
            <span className={classes(inputStyle)}>{voiceSummaryText}</span>
            <span className={classes(iconStyle)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <circle cx="5" cy="12" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="19" cy="12" r="2" />
                </svg>
            </span>
        </button>
        <VoiceSelectorDialog
            id={dialogId}
            value={props.value}
            options={props.options}
            onSave={props.onChange}
        />
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
    fontSize: 13,
    flex: 1,
    minWidth: 0
})

let iconStyle = style('voiceSelectorIcon', {
    border: '1px solid var(--border)',
    borderRadius: 6,
    width: 34,
    height: 34,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
})

let voicePickerInlineStyle = style('voiceSelectorInline', {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    gap: 8,
    alignItems: 'stretch',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    padding: 0,
    color: 'inherit',
    font: 'inherit',
    textAlign: 'left'
})
