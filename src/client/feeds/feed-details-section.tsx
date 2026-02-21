import { type ChangeEvent } from "react"
import { classes, style } from "stylemap"

type FeedDraft = {
    name: string
    rssUrl: string
    voice: string
    language: string
}

export type VoiceOption = {
    id: string
    name: string
    description: string
    gender: 'male' | 'female' | 'unknown'
    provider: string
}

export function FeedDetailsSection(props: {
    draft: FeedDraft
    error: string
    isEditing: boolean
    languageOptions: string[]
    onCancel: () => void
    onDelete: () => void
    onDraftChange: (field: keyof FeedDraft, value: string) => void
    onSubmit: () => void
    status: string
    voiceOptions: VoiceOption[]
}) {
    return <section className={classes(panelStyle)}>
        <h2 className={classes(panelHeadingStyle)}>{props.isEditing ? 'Feed details' : 'Add feed'}</h2>
        <form
            className={classes(formStyle)}
            onSubmit={event => {
                event.preventDefault()
                props.onSubmit()
            }}
        >
            <Field
                label="Name"
                value={props.draft.name}
                onChange={value => props.onDraftChange('name', value)}
                placeholder="Daily Tech News"
            />
            <Field
                label="RSS URL"
                value={props.draft.rssUrl}
                onChange={value => props.onDraftChange('rssUrl', value)}
                placeholder="https://example.com/feed.xml"
            />
            <VoiceSelectField
                label="Voice"
                value={props.draft.voice}
                options={props.voiceOptions}
                onChange={value => props.onDraftChange('voice', value)}
            />
            <TextSelectField
                label="Language"
                value={props.draft.language}
                options={props.languageOptions}
                onChange={value => props.onDraftChange('language', value)}
            />

            <div className={classes(buttonRowStyle)}>
                <button className={classes([buttonStyle, primaryButtonStyle])} type="submit">
                    {props.isEditing ? 'Save changes' : 'Add feed'}
                </button>
                {!props.isEditing
                    ? <button
                        className={classes(buttonStyle)}
                        onClick={props.onCancel}
                        type="button"
                    >
                        Cancel
                    </button>
                    : null}
                {props.isEditing
                    ? <button
                        className={classes([buttonStyle, dangerButtonStyle])}
                        onClick={props.onDelete}
                        type="button"
                    >
                        Delete feed
                    </button>
                    : null}
            </div>
        </form>

        {props.status ? <p className={classes(statusStyle)}>{props.status}</p> : null}
        {props.error ? <p className={classes(errorStyle)}>{props.error}</p> : null}
    </section>
}

function Field(props: {
    label: string
    value: string
    onChange: (value: string) => void
    placeholder?: string
}) {
    return <label className={classes(fieldGroupStyle)}>
        <span className={classes(labelStyle)}>{props.label}</span>
        <input
            className={classes(inputStyle)}
            onChange={(event: ChangeEvent<HTMLInputElement>) => props.onChange(event.target.value)}
            placeholder={props.placeholder}
            type="text"
            value={props.value}
        />
    </label>
}

function VoiceSelectField(props: {
    label: string
    value: string
    options: VoiceOption[]
    onChange: (value: string) => void
}) {
    return <label className={classes(fieldGroupStyle)}>
        <span className={classes(labelStyle)}>{props.label}</span>
        <select
            className={classes(inputStyle)}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => props.onChange(event.target.value)}
            value={props.value}
        >
            {props.options.map(option => <option key={option.id} value={option.id}>{buildVoiceLabel(option)}</option>)}
        </select>
    </label>
}

function TextSelectField(props: {
    label: string
    value: string
    options: string[]
    onChange: (value: string) => void
}) {
    return <label className={classes(fieldGroupStyle)}>
        <span className={classes(labelStyle)}>{props.label}</span>
        <select
            className={classes(inputStyle)}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => props.onChange(event.target.value)}
            value={props.value}
        >
            {props.options.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
    </label>
}

function buildVoiceLabel(option: VoiceOption) {
    let pieces = [option.name]
    if (option.description)
        pieces.push(option.description)
    pieces.push(option.gender)
    pieces.push(option.provider)
    return pieces.join(' · ')
}

let panelStyle = style('detailsPanel', {
    backgroundColor: 'var(--panel)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 16
})

let panelHeadingStyle = style('detailsPanelHeading', {
    margin: [0, 0, 12, 0],
    fontSize: 18
})

let formStyle = style('detailsForm', {
    display: 'grid',
    gap: 12
})

let fieldGroupStyle = style('detailsFieldGroup', {
    display: 'grid',
    gap: 6
})

let labelStyle = style('detailsLabel', {
    fontSize: 13,
    color: 'var(--muted)'
})

let inputStyle = style('detailsInput', {
    width: '100%',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: [10, 12],
    backgroundColor: 'transparent',
    color: 'inherit'
})

let buttonRowStyle = style('detailsButtonRow', {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap'
})

let buttonStyle = style('detailsButton', {
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: [9, 12],
    backgroundColor: 'transparent',
    color: 'inherit',
    cursor: 'pointer'
})

let primaryButtonStyle = style('detailsPrimaryButton', {
    backgroundColor: 'var(--accent)',
    borderColor: 'var(--accent)',
    color: 'var(--accent-text)'
})

let dangerButtonStyle = style('detailsDangerButton', {
    color: 'var(--danger)',
    borderColor: 'var(--danger)'
})

let statusStyle = style('detailsStatus', {
    margin: [4, 0, 0, 0],
    color: 'var(--muted)'
})

let errorStyle = style('detailsError', {
    margin: [6, 0, 0, 0],
    color: 'var(--danger)'
})
