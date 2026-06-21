import { type ChangeEvent, useEffect, useState } from "react"
import { classes } from "stylemap"
import { api } from "../../api"
import { type ProviderSettingsDraft, type TtsSettingsDraft, type VoiceboxRuntimeStatus, type VoiceboxSettingsDraft } from "./types"
import { activeDotStyle, activeToggleThumbStyle, activeToggleTrackStyle, buttonStyle, fieldGroupStyle, fieldsGridStyle, hiddenCheckboxStyle, hintStyle, inputStyle, labelStyle, panelContainerStyle, panelHeaderStyle, panelTitleStyle, primaryButtonStyle, statusDotStyle, toggleLabelStyle, toggleTextStyle, toggleThumbStyle, toggleTrackStyle, voiceboxActionsStyle, voiceboxStatusPanelStyle, voiceboxStatusTextStyle } from "./styles"

export function ProviderPanel(props: {
    title: string
    provider: keyof TtsSettingsDraft
    value: ProviderSettingsDraft
    onChange: (provider: keyof TtsSettingsDraft, field: keyof ProviderSettingsDraft, value: string | boolean) => void
    voiceboxValue: VoiceboxSettingsDraft
    onVoiceboxChange: (field: keyof VoiceboxSettingsDraft, value: string) => void
}) {
    return <div className={classes(panelContainerStyle)}>
        <div className={classes(panelHeaderStyle)}>
            <h3 className={classes(panelTitleStyle)}>{props.title} Configuration</h3>
            <label className={classes(toggleLabelStyle)} title={props.value.enabled ? "Disable this provider" : "Enable this provider"}>
                <input
                    type="checkbox"
                    className={classes(hiddenCheckboxStyle)}
                    checked={props.value.enabled}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => props.onChange(props.provider, 'enabled', event.target.checked)}
                />
                <div className={classes([toggleTrackStyle, props.value.enabled && activeToggleTrackStyle])}>
                    <div className={classes([toggleThumbStyle, props.value.enabled && activeToggleThumbStyle])} />
                </div>
                <span className={classes(toggleTextStyle)}>{props.value.enabled ? 'Enabled' : 'Disabled'}</span>
            </label>
        </div>

        <div className={classes(fieldsGridStyle)}>
            <label className={classes(fieldGroupStyle)}>
                <span className={classes(labelStyle)}>API Key</span>
                <input
                    className={classes(inputStyle)}
                    type="password"
                    value={props.value.apiKey}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => props.onChange(props.provider, 'apiKey', event.target.value)}
                    placeholder={`Enter ${props.title} API key`}
                    autoComplete="off"
                    spellCheck="false"
                />
                {props.provider == 'voicebox'
                    ? <span className={classes(hintStyle)}>API key is optional for local Voicebox servers.</span>
                    : null}
            </label>

            <label className={classes(fieldGroupStyle)}>
                <span className={classes(labelStyle)}>Base URL</span>
                <input
                    className={classes(inputStyle)}
                    type="text"
                    value={props.value.baseUrl}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => props.onChange(props.provider, 'baseUrl', event.target.value)}
                    placeholder="https://api.example.com"
                />
            </label>

            {props.provider == 'voicebox'
                ? <VoiceboxRuntimePanel
                    value={props.voiceboxValue}
                    baseUrl={props.value.baseUrl}
                    onChange={props.onVoiceboxChange}
                />
                : null}
        </div>
    </div>
}

function VoiceboxRuntimePanel(props: {
    value: VoiceboxSettingsDraft
    baseUrl: string
    onChange: (field: keyof VoiceboxSettingsDraft, value: string) => void
}) {
    let [status, setStatus] = useState<VoiceboxRuntimeStatus>({
        location: '',
        running: false,
        error: ''
    })
    let [isChecking, setIsChecking] = useState(false)
    let [isStarting, setIsStarting] = useState(false)

    useEffect(() => {
        void checkVoicebox()
    }, [])

    return <>
        <label className={classes(fieldGroupStyle)}>
            <span className={classes(labelStyle)}>Voicebox Location</span>
            <input
                className={classes(inputStyle)}
                type="text"
                value={props.value.location}
                onChange={(event: ChangeEvent<HTMLInputElement>) => props.onChange('location', event.target.value)}
                placeholder={status.location || "Default install location"}
            />
            <span className={classes(hintStyle)}>Leave blank to use the default Voicebox install path.</span>
        </label>

        <div className={classes(voiceboxStatusPanelStyle)}>
            <div className={classes(voiceboxStatusTextStyle)}>
                <span className={classes([statusDotStyle, status.running && activeDotStyle])} />
                <span>{isChecking ? "Checking Voicebox..." : status.running ? "Voicebox is running" : "Voicebox is not running"}</span>
            </div>
            {status.error && !status.running
                ? <span className={classes(hintStyle)}>{status.error}</span>
                : null}
            <div className={classes(voiceboxActionsStyle)}>
                <button
                    className={classes(buttonStyle)}
                    type="button"
                    onClick={checkVoicebox}
                    disabled={isStarting}
                >
                    Check
                </button>
                <button
                    className={classes([buttonStyle, primaryButtonStyle])}
                    type="button"
                    onClick={startVoicebox}
                    disabled={status.running || isChecking || isStarting}
                >
                    {isStarting ? "Starting..." : "Start"}
                </button>
            </div>
        </div>
    </>

    async function checkVoicebox() {
        if (isChecking)
            return

        try {
            setIsChecking(true)
            let response = await api.settings.voiceboxStatus.query({
                baseUrl: props.baseUrl,
                location: props.value.location
            })
            setStatus(response)
            if (!props.value.location)
                props.onChange('location', response.location)
        } catch {
            setStatus(current => ({
                ...current,
                running: false,
                error: 'Could not check Voicebox'
            }))
        } finally {
            setIsChecking(false)
        }
    }

    async function startVoicebox() {
        try {
            setIsStarting(true)
            let response = await api.settings.voiceboxStart.mutate({
                baseUrl: props.baseUrl,
                location: props.value.location
            })
            setStatus(response)
            if (!props.value.location)
                props.onChange('location', response.location)
        } catch {
            setStatus(current => ({
                ...current,
                running: false,
                error: 'Could not start Voicebox'
            }))
        } finally {
            setIsStarting(false)
        }
    }
}

