import { type ChangeEvent, useState } from "react"
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
    if (!props.isOpen) return null

    let [activeTab, setActiveTab] = useState<keyof TtsSettingsDraft>('elevenlabs')

    let tabs: Array<{ id: keyof TtsSettingsDraft, label: string }> = [
        { id: 'elevenlabs', label: 'ElevenLabs' },
        { id: 'inworld', label: 'Inworld' },
        { id: 'lemonfox', label: 'Lemonfox' },
        { id: 'openai', label: 'OpenAI' }
    ]

    return <div className={classes(overlayStyle)}>
        <div className={classes(dialogContainerStyle)}>
            <div className={classes(headerStyle)}>
                <h2 className={classes(headingStyle)}>TTS Providers</h2>
                <button
                    className={classes(closeButtonStyle)}
                    onClick={props.onClose}
                    type="button"
                    aria-label="Close"
                >×</button>
            </div>

            <div className={classes(layoutStyle)}>
                <div className={classes(sidebarStyle)}>
                    <div className={classes(tabsContainerStyle)}>
                        {tabs.map(tab => {
                            let isEnabled = props.draft[tab.id].enabled
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    className={classes([tabButtonStyle, activeTab === tab.id && activeTabButtonStyle])}
                                    onClick={() => setActiveTab(tab.id)}
                                >
                                    <div className={classes([statusDotStyle, isEnabled && activeDotStyle])} title={isEnabled ? "Enabled" : "Disabled"} />
                                    <span>{tab.label}</span>
                                </button>
                            )
                        })}
                    </div>
                </div>

                <div className={classes(contentStyle)}>
                    <ProviderPanel
                        title={tabs.find(t => t.id === activeTab)?.label || ''}
                        provider={activeTab}
                        value={props.draft[activeTab]}
                        onChange={props.onChange}
                    />
                </div>
            </div>

            <div className={classes(footerStyle)}>
                <div className={classes(statusAreaStyle)}>
                    {props.error ? <span className={classes(errorStyle)}>{props.error}</span> : null}
                    {props.status ? <span className={classes(statusStyle)}>{props.status}</span> : null}
                </div>
                <div className={classes(footerActionsStyle)}>
                    <button
                        className={classes(buttonStyle)}
                        type="button"
                        onClick={props.onClose}
                    >
                        Cancel
                    </button>
                    <button
                        className={classes([buttonStyle, primaryButtonStyle])}
                        type="button"
                        onClick={() => props.onSave()}
                        disabled={props.isSaving}
                    >
                        {props.isSaving ? "Saving..." : "Save settings"}
                    </button>
                </div>
            </div>
        </div>
    </div>
}

function ProviderPanel(props: {
    title: string
    provider: keyof TtsSettingsDraft
    value: ProviderSettingsDraft
    onChange: (provider: keyof TtsSettingsDraft, field: keyof ProviderSettingsDraft, value: string | boolean) => void
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
        </div>
    </div>
}

let overlayStyle = style('settingsOverlay', {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'color-mix(in srgb, var(--bg) 60%, transparent)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    zIndex: 100
})

let dialogContainerStyle = style('settingsDialog', {
    width: '100%',
    maxWidth: 600,
    backgroundColor: 'var(--panel)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    boxShadow: '0 8px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
})

let headerStyle = style('settingsHeader', {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 20px',
    borderBottom: '1px solid var(--border)',
    backgroundColor: 'var(--bg)'
})

let headingStyle = style('settingsHeading', {
    margin: 0,
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--text)'
})

let closeButtonStyle = style('closeButton', {
    background: 'none',
    border: 'none',
    color: 'var(--muted)',
    fontSize: 20,
    lineHeight: 1,
    padding: '4px',
    cursor: 'pointer',
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s',
    $: {
        '&:hover': {
            backgroundColor: 'var(--border)',
            color: 'var(--text)'
        }
    }
})

let layoutStyle = style('settingsLayout', {
    display: 'flex',
    minHeight: 280,
    $: {
        '@media (max-width: 500px)': {
            flexDirection: 'column'
        }
    }
})

let sidebarStyle = style('settingsSidebar', {
    width: 160,
    borderRight: '1px solid var(--border)',
    backgroundColor: 'var(--panel)',
    padding: '12px 8px',
    flexShrink: 0,
    $: {
        '@media (max-width: 500px)': {
            width: '100%',
            borderRight: 'none',
            borderBottom: '1px solid var(--border)',
            padding: '8px',
            display: 'flex',
            overflowX: 'auto'
        }
    }
})

let tabsContainerStyle = style('settingsTabs', {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    $: {
        '@media (max-width: 500px)': {
            flexDirection: 'row'
        }
    }
})

let tabButtonStyle = style('tabButton', {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--muted)',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.1s',
    $: {
        '&:hover': {
            backgroundColor: 'var(--bg)',
            color: 'var(--text)'
        },
        '@media (max-width: 500px)': {
            whiteSpace: 'nowrap'
        }
    }
})

let activeTabButtonStyle = style('activeTabButton', {
    backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)',
    color: 'var(--accent)',
    $: {
        '&:hover': {
            backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)',
            color: 'var(--accent)'
        }
    }
})

let statusDotStyle = style('statusDot', {
    width: 6,
    height: 6,
    borderRadius: '50%',
    backgroundColor: 'var(--muted)',
    flexShrink: 0,
    transition: 'background-color 0.2s'
})

let activeDotStyle = style('activeDot', {
    backgroundColor: '#10b981',
    boxShadow: '0 0 4px color-mix(in srgb, #10b981 40%, transparent)'
})

let contentStyle = style('settingsContent', {
    flex: 1,
    padding: 24,
    backgroundColor: 'var(--panel)',
    minWidth: 0
})

let panelContainerStyle = style('panelContainer', {
    display: 'flex',
    flexDirection: 'column',
    gap: 20
})

let panelHeaderStyle = style('panelHeader', {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderBottom: '1px solid var(--border)',
    paddingBottom: 12
})

let panelTitleStyle = style('panelTitle', {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--text)'
})

let hiddenCheckboxStyle = style('hiddenCheckbox', {
    position: 'absolute',
    opacity: 0,
    width: 0,
    height: 0
})

let toggleLabelStyle = style('toggleLabel', {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
    userSelect: 'none'
})

let toggleTrackStyle = style('toggleTrack', {
    width: 36,
    height: 20,
    backgroundColor: 'var(--border)',
    borderRadius: 10,
    position: 'relative',
    transition: 'background-color 0.2s',
    border: '1px solid var(--border)',
    boxSizing: 'border-box'
})

let activeToggleTrackStyle = style('activeToggleTrack', {
    backgroundColor: 'var(--accent)',
    borderColor: 'var(--accent)'
})

let toggleThumbStyle = style('toggleThumb', {
    position: 'absolute',
    top: 1,
    left: 1,
    width: 16,
    height: 16,
    backgroundColor: '#fff',
    borderRadius: '50%',
    transition: 'transform 0.2s',
    boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
})

let activeToggleThumbStyle = style('activeToggleThumb', {
    transform: 'translateX(16px)'
})

let toggleTextStyle = style('toggleText', {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--muted)',
    width: '60px' // Keep width fixed so it doesn't jump
})

let fieldsGridStyle = style('fieldsGrid', {
    display: 'flex',
    flexDirection: 'column',
    gap: 16
})

let fieldGroupStyle = style('fieldGroup', {
    display: 'flex',
    flexDirection: 'column',
    gap: 6
})

let labelStyle = style('label', {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--muted)'
})

let inputStyle = style('input', {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid var(--border)',
    borderRadius: 6,
    fontSize: 13,
    fontFamily: 'monospace',
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

let footerStyle = style('settingsFooter', {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 20px',
    borderTop: '1px solid var(--border)',
    backgroundColor: 'var(--bg)',
    gap: 12
})

let statusAreaStyle = style('statusArea', {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    flex: 1,
    minWidth: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
})

let footerActionsStyle = style('footerActions', {
    display: 'flex',
    gap: 8,
    flexShrink: 0
})

let buttonStyle = style('button', {
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

let primaryButtonStyle = style('primaryButton', {
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

let statusStyle = style('statusInfo', {
    color: 'var(--muted)'
})

let errorStyle = style('statusError', {
    color: 'var(--danger)',
    fontWeight: 500
})
