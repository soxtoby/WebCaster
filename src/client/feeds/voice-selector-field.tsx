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
                <svg className={classes(iconGlyphStyle)} viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="currentColor" d="M23 9q0 1.725-.612 3.288t-1.663 2.837q-.3.35-.75.375t-.8-.325q-.325-.325-.3-.775t.3-.825q.75-.95 1.163-2.125T20.75 9t-.412-2.425t-1.163-2.1q-.3-.375-.312-.825t.312-.8t.788-.338t.762.363q1.05 1.275 1.663 2.838T23 9m-4.55 0q0 .8-.25 1.538t-.7 1.362q-.275.375-.737.388t-.813-.338q-.325-.325-.337-.787t.212-.888q.15-.275.238-.6T16.15 9t-.088-.675t-.237-.625q-.225-.425-.213-.875t.338-.775q.35-.35.813-.338t.737.388q.45.625.7 1.363T18.45 9M9 13q-1.65 0-2.825-1.175T5 9t1.175-2.825T9 5t2.825 1.175T13 9t-1.175 2.825T9 13m-8 6v-.8q0-.825.425-1.55t1.175-1.1q1.275-.65 2.875-1.1T9 14t3.525.45t2.875 1.1q.75.375 1.175 1.1T17 18.2v.8q0 .825-.587 1.413T15 21H3q-.825 0-1.412-.587T1 19" />
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
    lineHeight: 0,
    flexShrink: 0
})

let iconGlyphStyle = style('voiceSelectorIconGlyph', {
    width: 20,
    height: 20,
    transform: 'translateY(-0.5px)',
    display: 'block'
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
