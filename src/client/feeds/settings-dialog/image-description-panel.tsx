import { type ChangeEvent } from "react"
import { classes } from "stylemap"
import { type ImageDescriptionProviderDraft, type ImageDescriptionSettingsDraft } from "./types"
import { imageDescriptionProviderDefaults } from "./settings-metadata"
import { activeToggleThumbStyle, activeToggleTrackStyle, fieldGroupStyle, fieldsGridStyle, hiddenCheckboxStyle, hintStyle, inputStyle, labelStyle, panelContainerStyle, panelHeaderStyle, panelTitleStyle, toggleLabelStyle, toggleTextStyle, toggleThumbStyle, toggleTrackStyle } from "./styles"

export function ImageDescriptionPanel(props: {
    value: ImageDescriptionSettingsDraft
    onChange: (field: keyof ImageDescriptionSettingsDraft, value: string | boolean) => void
    onProviderChange: (
        provider: keyof ImageDescriptionSettingsDraft['providers'],
        field: keyof ImageDescriptionProviderDraft,
        value: string
    ) => void
}) {
    let activeProvider = props.value.provider
    let activeSettings = props.value.providers[activeProvider]
    let activeProviderInfo = imageDescriptionProviderDefaults[activeProvider]

    return <div className={classes(panelContainerStyle)}>
        <div className={classes(panelHeaderStyle)}>
            <h3 className={classes(panelTitleStyle)}>Image Description Configuration</h3>
            <label className={classes(toggleLabelStyle)} title={props.value.enabled ? "Disable image descriptions" : "Enable image descriptions"}>
                <input
                    type="checkbox"
                    className={classes(hiddenCheckboxStyle)}
                    checked={props.value.enabled}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => props.onChange('enabled', event.target.checked)}
                />
                <div className={classes([toggleTrackStyle, props.value.enabled && activeToggleTrackStyle])}>
                    <div className={classes([toggleThumbStyle, props.value.enabled && activeToggleThumbStyle])} />
                </div>
                <span className={classes(toggleTextStyle)}>{props.value.enabled ? 'Enabled' : 'Disabled'}</span>
            </label>
        </div>

        <div className={classes(fieldsGridStyle)}>
            <label className={classes(fieldGroupStyle)}>
                <span className={classes(labelStyle)}>Provider</span>
                <select
                    className={classes(inputStyle)}
                    value={props.value.provider}
                    onChange={(event: ChangeEvent<HTMLSelectElement>) => props.onChange('provider', event.target.value)}
                >
                    <option value="openai">OpenAI</option>
                    <option value="gemini">Google Gemini</option>
                </select>
            </label>

            <label className={classes(fieldGroupStyle)}>
                <span className={classes(labelStyle)}>API Key</span>
                <input
                    className={classes(inputStyle)}
                    type="password"
                    value={activeSettings.apiKey}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => props.onProviderChange(activeProvider, 'apiKey', event.target.value)}
                    placeholder={`Enter ${activeProviderInfo.label} API key`}
                    autoComplete="off"
                    spellCheck="false"
                />
            </label>

            <label className={classes(fieldGroupStyle)}>
                <span className={classes(labelStyle)}>Base URL</span>
                <input
                    className={classes(inputStyle)}
                    type="text"
                    value={activeSettings.baseUrl}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => props.onProviderChange(activeProvider, 'baseUrl', event.target.value)}
                    placeholder={activeProviderInfo.baseUrl}
                />
                <span className={classes(hintStyle)}>{activeProvider == 'gemini' ? 'Use the Gemini API root. The request path is added automatically.' : 'Use an OpenAI-compatible base URL.'}</span>
            </label>

            <label className={classes(fieldGroupStyle)}>
                <span className={classes(labelStyle)}>Model</span>
                <input
                    className={classes(inputStyle)}
                    type="text"
                    value={activeSettings.model}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => props.onProviderChange(activeProvider, 'model', event.target.value)}
                    placeholder={activeProviderInfo.model}
                />
            </label>

            <label className={classes(fieldGroupStyle)}>
                <span className={classes(labelStyle)}>System Prompt</span>
                <input
                    className={classes(inputStyle)}
                    type="text"
                    value={activeSettings.prompt}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => props.onProviderChange(activeProvider, 'prompt', event.target.value)}
                    placeholder={activeProviderInfo.prompt}
                />
            </label>
        </div>
    </div>
}

