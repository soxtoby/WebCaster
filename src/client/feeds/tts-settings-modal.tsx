import { type ChangeEvent } from "react"
import { classes, style } from "stylemap"

export type ProviderSettingsDraft = {
    enabled: boolean
    apiKey: string
    baseUrl: string
}

export type TtsSettingsDraft = {
    inworld: ProviderSettingsDraft
    openai: ProviderSettingsDraft
    elevenlabs: ProviderSettingsDraft
    lemonfox: ProviderSettingsDraft
}

export function TtsSettingsModal(props: {
    draft: TtsSettingsDraft
    error: string
    isOpen: boolean
    isSaving: boolean
    onChange: (provider: keyof TtsSettingsDraft, field: keyof ProviderSettingsDraft, value: string | boolean) => void
    onClose: () => void
    onSave: () => void
    status: string
}) {
    if (!props.isOpen)
        return null

    return <div className={classes(overlayStyle)}>
        <div className={classes(dialogStyle)}>
            <div className={classes(headerStyle)}>
                <h2 className={classes(headingStyle)}>TTS Settings</h2>
                <button className={classes(buttonStyle)} type="button" onClick={props.onClose}>Close</button>
            </div>

            <form
                className={classes(formStyle)}
                onSubmit={event => {
                    event.preventDefault()
                    props.onSave()
                }}
            >
                <ProviderSection
                    title="Inworld"
                    provider="inworld"
                    value={props.draft.inworld}
                    onChange={props.onChange}
                />
                <ProviderSection
                    title="OpenAI"
                    provider="openai"
                    value={props.draft.openai}
                    onChange={props.onChange}
                />
                <ProviderSection
                    title="ElevenLabs"
                    provider="elevenlabs"
                    value={props.draft.elevenlabs}
                    onChange={props.onChange}
                />
                <ProviderSection
                    title="Lemonfox"
                    provider="lemonfox"
                    value={props.draft.lemonfox}
                    onChange={props.onChange}
                />

                <div className={classes(actionRowStyle)}>
                    <button className={classes([buttonStyle, primaryButtonStyle])} type="submit" disabled={props.isSaving}>
                        {props.isSaving ? "Saving..." : "Save settings"}
                    </button>
                </div>
            </form>

            {props.status ? <p className={classes(statusStyle)}>{props.status}</p> : null}
            {props.error ? <p className={classes(errorStyle)}>{props.error}</p> : null}
        </div>
    </div>
}

function ProviderSection(props: {
    title: string
    provider: keyof TtsSettingsDraft
    value: ProviderSettingsDraft
    onChange: (provider: keyof TtsSettingsDraft, field: keyof ProviderSettingsDraft, value: string | boolean) => void
}) {
    return <fieldset className={classes(sectionStyle)}>
        <legend className={classes(sectionHeadingStyle)}>{props.title}</legend>

        <label className={classes(checkboxRowStyle)}>
            <input
                type="checkbox"
                checked={props.value.enabled}
                onChange={(event: ChangeEvent<HTMLInputElement>) => props.onChange(props.provider, 'enabled', event.target.checked)}
            />
            <span>Enabled</span>
        </label>

        <label className={classes(fieldStyle)}>
            <span className={classes(labelStyle)}>API key</span>
            <input
                className={classes(inputStyle)}
                type="password"
                value={props.value.apiKey}
                onChange={(event: ChangeEvent<HTMLInputElement>) => props.onChange(props.provider, 'apiKey', event.target.value)}
                placeholder="Enter API key"
            />
        </label>

        <label className={classes(fieldStyle)}>
            <span className={classes(labelStyle)}>Base URL</span>
            <input
                className={classes(inputStyle)}
                type="text"
                value={props.value.baseUrl}
                onChange={(event: ChangeEvent<HTMLInputElement>) => props.onChange(props.provider, 'baseUrl', event.target.value)}
                placeholder="https://api.example.com"
            />
        </label>
    </fieldset>
}

let overlayStyle = style('settingsOverlay', {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'color-mix(in srgb, var(--text) 35%, transparent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    zIndex: 40
})

let dialogStyle = style('settingsDialog', {
    width: 'min(760px, 100%)',
    maxHeight: '90vh',
    overflow: 'auto',
    backgroundColor: 'var(--panel)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 16,
    display: 'grid',
    gap: 12
})

let headerStyle = style('settingsHeader', {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
})

let headingStyle = style('settingsHeading', {
    margin: 0,
    fontSize: 20
})

let formStyle = style('settingsForm', {
    display: 'grid',
    gap: 12
})

let sectionStyle = style('settingsSection', {
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: 12,
    display: 'grid',
    gap: 10
})

let sectionHeadingStyle = style('settingsSectionHeading', {
    fontSize: 14,
    color: 'var(--muted)',
    padding: [0, 4]
})

let checkboxRowStyle = style('settingsCheckboxRow', {
    display: 'flex',
    gap: 8,
    alignItems: 'center'
})

let fieldStyle = style('settingsField', {
    display: 'grid',
    gap: 6
})

let labelStyle = style('settingsLabel', {
    color: 'var(--muted)',
    fontSize: 13
})

let inputStyle = style('settingsInput', {
    width: '100%',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: [10, 12],
    backgroundColor: 'transparent',
    color: 'inherit'
})

let actionRowStyle = style('settingsActionRow', {
    display: 'flex',
    justifyContent: 'flex-end'
})

let buttonStyle = style('settingsButton', {
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: [9, 12],
    backgroundColor: 'transparent',
    color: 'inherit',
    cursor: 'pointer'
})

let primaryButtonStyle = style('settingsPrimaryButton', {
    backgroundColor: 'var(--accent)',
    borderColor: 'var(--accent)',
    color: 'var(--accent-text)'
})

let statusStyle = style('settingsStatus', {
    margin: 0,
    color: 'var(--muted)'
})

let errorStyle = style('settingsError', {
    margin: 0,
    color: 'var(--danger)'
})
