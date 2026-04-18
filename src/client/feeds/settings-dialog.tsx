import type { inferRouterOutputs } from "@trpc/server"
import { type ChangeEvent, useEffect, useRef, useState } from "react"
import { classes, style } from "stylemap"
import type { AppRouter } from "../../server/trpc/app-router"
import { defaultImageDescriptionProviderSettings } from "../../shared/image-description-defaults"
import { api } from "../api"

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
    voicebox: ProviderSettingsDraft
}

export type ServerSettingsDraft = {
    address: string
    port: string
    listenOnAllInterfaces: boolean
    password: string
    passwordConfigured: boolean
    protocol: 'http' | 'https'
}

export type ImageDescriptionProviderDraft = {
    apiKey: string
    baseUrl: string
    model: string
    prompt: string
}

export type ImageDescriptionSettingsDraft = {
    enabled: boolean
    provider: 'openai' | 'gemini'
    providers: {
        openai: ImageDescriptionProviderDraft
        gemini: ImageDescriptionProviderDraft
    }
}

export type EpisodeGenerationSettingsDraft = {
    concurrentGenerations: string
}

type ActiveTab = 'server' | 'imageDescription' | keyof TtsSettingsDraft

type SavedSettingsSnapshot = {
    draft: TtsSettingsDraft
    serverDraft: ServerSettingsDraft
    imageDescriptionDraft: ImageDescriptionSettingsDraft
    episodeGenerationDraft: EpisodeGenerationSettingsDraft
}

type RouterOutputs = inferRouterOutputs<AppRouter>
type SettingsResponse = RouterOutputs['settings']['get']

let imageDescriptionProviderDefaults = {
    openai: {
        label: 'OpenAI',
        ...defaultImageDescriptionProviderSettings.openai
    },
    gemini: {
        label: 'Google Gemini',
        ...defaultImageDescriptionProviderSettings.gemini
    }
} as const

let ttsProviderMetadata = {
    elevenlabs: {
        label: 'ElevenLabs',
        requiresApiKey: true
    },
    inworld: {
        label: 'Inworld',
        requiresApiKey: true
    },
    lemonfox: {
        label: 'Lemonfox',
        requiresApiKey: true
    },
    openai: {
        label: 'OpenAI',
        requiresApiKey: true
    },
    voicebox: {
        label: 'Voicebox',
        requiresApiKey: false
    }
} as const

export function SettingsDialog(props: {
    id: string
    onSaved: (result: { redirectUrl?: string }) => void
}) {
    let dialogRef = useRef<HTMLDialogElement>(null)
    let savedSnapshotRef = useRef<SavedSettingsSnapshot>(createDefaultSavedSettingsSnapshot())
    let [activeTab, setActiveTab] = useState<ActiveTab>('server')
    let [error, setError] = useState('')
    let [status, setStatus] = useState('')
    let [isSaving, setIsSaving] = useState(false)
    let [isCheckingForUpdate, setIsCheckingForUpdate] = useState(false)
    let [isLoggingOut, setIsLoggingOut] = useState(false)
    let [draft, setDraft] = useState<TtsSettingsDraft>(createDefaultSettingsDraft())
    let [serverDraft, setServerDraft] = useState<ServerSettingsDraft>(createDefaultServerDraft())
    let [imageDescriptionDraft, setImageDescriptionDraft] = useState<ImageDescriptionSettingsDraft>(createDefaultImageDescriptionDraft())
    let [episodeGenerationDraft, setEpisodeGenerationDraft] = useState<EpisodeGenerationSettingsDraft>(createDefaultEpisodeGenerationDraft())

    useEffect(() => {
        void loadSettings()
    }, [])

    let ttsTabs: Array<{ id: keyof TtsSettingsDraft, label: string }> = [
        { id: 'elevenlabs', label: 'ElevenLabs' },
        { id: 'inworld', label: 'Inworld' },
        { id: 'lemonfox', label: 'Lemonfox' },
        { id: 'openai', label: 'OpenAI' },
        { id: 'voicebox', label: 'Voicebox' }
    ]

    return <dialog
        id={props.id}
        ref={dialogRef}
        className={classes(dialogContainerStyle)}
        onClose={resetToSavedSettings}
    >
        <div className={classes(headerStyle)}>
            <h2 className={classes(headingStyle)}>Settings</h2>
            <button
                className={classes(closeButtonStyle)}
                commandFor={props.id}
                command="close"
                type="button"
                aria-label="Close"
            >
                <svg className={classes(closeIconStyle)} viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 6L18 18M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
            </button>
        </div>

        <div className={classes(layoutStyle)}>
            <div className={classes(sidebarStyle)}>
                <div className={classes(tabsContainerStyle)}>
                    <button
                        type="button"
                        className={classes([tabButtonStyle, activeTab == 'server' && activeTabButtonStyle])}
                        onClick={() => setActiveTab('server')}
                    >
                        <div className={classes([statusDotStyle, hiddenStatusDotStyle])} aria-hidden="true" />
                        <span>Server</span>
                    </button>
                    <button
                        type="button"
                        className={classes([tabButtonStyle, activeTab == 'imageDescription' && activeTabButtonStyle])}
                        onClick={() => setActiveTab('imageDescription')}
                    >
                        <div className={classes([statusDotStyle, imageDescriptionDraft.enabled && activeDotStyle])} title={imageDescriptionDraft.enabled ? "Enabled" : "Disabled"} />
                        <span>Images</span>
                    </button>
                    <div className={classes(tabDividerStyle)} />
                    {ttsTabs.map(tab => {
                        let isEnabled = draft[tab.id].enabled
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
                {activeTab == 'server'
                    ? <ServerPanel
                        value={serverDraft}
                        onChange={onServerDraftChange}
                        episodeGenerationValue={episodeGenerationDraft}
                        onEpisodeGenerationChange={onEpisodeGenerationDraftChange}
                        isCheckingForUpdate={isCheckingForUpdate}
                        onCheckForUpdate={() => checkForUpdate()}
                    />
                    : activeTab == 'imageDescription'
                        ? <ImageDescriptionPanel
                            value={imageDescriptionDraft}
                            onChange={onImageDescriptionDraftChange}
                            onProviderChange={onImageDescriptionProviderDraftChange}
                        />
                        : <ProviderPanel
                            title={ttsTabs.find(t => t.id === activeTab)?.label || ''}
                            provider={activeTab}
                            value={draft[activeTab]}
                            onChange={onProviderDraftChange}
                        />}
            </div>
        </div>

        <div className={classes(footerStyle)}>
            <div className={classes(statusAreaStyle)}>
                {error ? <span className={classes(errorStyle)}>{error}</span> : null}
                {status ? <span className={classes(statusStyle)}>{status}</span> : null}
            </div>
            <div className={classes(footerActionsStyle)}>
                <button
                    className={classes(buttonStyle)}
                    type="button"
                    onClick={() => logout()}
                    disabled={isSaving || isLoggingOut || isCheckingForUpdate}
                >
                    {isLoggingOut ? "Logging out..." : "Log out"}
                </button>
                <button
                    className={classes(buttonStyle)}
                    commandFor={props.id}
                    command="close"
                    type="button"
                >
                    Cancel
                </button>
                <button
                    className={classes([buttonStyle, primaryButtonStyle])}
                    type="button"
                    onClick={() => saveSettings()}
                    disabled={isSaving || isCheckingForUpdate}
                >
                    {isSaving ? "Saving..." : "Save settings"}
                </button>
            </div>
        </div>
    </dialog>

    async function saveSettings() {
        setError('')
        setStatus('')

        let validationError = validateSettings(draft, imageDescriptionDraft)
        if (validationError) {
            setError(validationError)
            return
        }

        let concurrentGenerations = parseInt(episodeGenerationDraft.concurrentGenerations, 10)
        if (!Number.isInteger(concurrentGenerations) || concurrentGenerations < 1 || concurrentGenerations > 20) {
            setError('Concurrent episode generations must be between 1 and 20')
            return
        }

        let portNum = parseInt(serverDraft.port, 10)
        if (!portNum || portNum < 1 || portNum > 65535) {
            setError('Port must be between 1 and 65535')
            return
        }

        let parsedAddress = parseServerAddress(serverDraft.address)
        if (parsedAddress.error) {
            setError(parsedAddress.error)
            return
        }

        try {
            setIsSaving(true)
            let enteredPassword = serverDraft.password.trim()
            let response = await api.settings.save.mutate({
                settings: draft,
                imageDescription: {
                    enabled: imageDescriptionDraft.enabled,
                    provider: imageDescriptionDraft.provider,
                    providers: {
                        openai: sanitizeImageDescriptionProviderDraft(imageDescriptionDraft.providers.openai),
                        gemini: sanitizeImageDescriptionProviderDraft(imageDescriptionDraft.providers.gemini)
                    }
                },
                episodeGeneration: {
                    concurrentGenerations
                },
                server: {
                    protocol: parsedAddress.protocol,
                    hostname: parsedAddress.hostname,
                    port: portNum,
                    listenOnAllInterfaces: serverDraft.listenOnAllInterfaces,
                    password: enteredPassword
                }
            })

            let savedSnapshot = createSavedSettingsSnapshotFromResponse(response)
            savedSnapshotRef.current = savedSnapshot

            if (enteredPassword)
                await api.auth.login.mutate({ password: enteredPassword })

            applySavedSettingsSnapshot(savedSnapshot)
            setStatus('Settings saved')
            dialogRef.current?.close()
            props.onSaved({ redirectUrl: response.redirectUrl ?? undefined })
        } catch {
            setError('Could not save settings')
        } finally {
            setIsSaving(false)
        }
    }

    async function loadSettings() {
        try {
            let response = await api.settings.get.query()
            let savedSnapshot = createSavedSettingsSnapshotFromResponse(response)
            savedSnapshotRef.current = savedSnapshot
            applySavedSettingsSnapshot(savedSnapshot)
        } catch {
        }
    }

    async function logout() {
        setError('')
        setStatus('')

        try {
            setIsLoggingOut(true)
            await api.auth.logout.mutate()
            window.location.reload()
        } catch {
            setError('Could not log out')
        } finally {
            setIsLoggingOut(false)
        }
    }

    async function checkForUpdate() {
        setError('')
        setStatus('')

        try {
            setIsCheckingForUpdate(true)
            let result = await api.settings.checkForUpdate.mutate()

            if (result.status == 'update-ready')
                setStatus(`Version ${result.latestVersion} downloaded. Right-click the tray icon to restart.`)
            else if (result.status == 'up-to-date')
                setStatus(`You already have the latest version (${result.currentVersion}).`)
            else if (result.status == 'unsupported')
                setStatus('Update checks are only available in the packaged WebCaster app.')
            else
                setError('Could not check for updates')
        } catch {
            setError('Could not check for updates')
        } finally {
            setIsCheckingForUpdate(false)
        }
    }

    function onProviderDraftChange(provider: keyof TtsSettingsDraft, field: keyof ProviderSettingsDraft, value: string | boolean) {
        setDraft(current => ({
            ...current,
            [provider]: {
                ...current[provider],
                [field]: value
            }
        }))
    }

    function onServerDraftChange(field: keyof ServerSettingsDraft, value: string | boolean) {
        setServerDraft(current => ({ ...current, [field]: value }))
    }

    function onImageDescriptionDraftChange(field: keyof ImageDescriptionSettingsDraft, value: string | boolean) {
        setImageDescriptionDraft(current => ({ ...current, [field]: value }))
    }

    function onImageDescriptionProviderDraftChange(
        provider: keyof ImageDescriptionSettingsDraft['providers'],
        field: keyof ImageDescriptionProviderDraft,
        value: string
    ) {
        setImageDescriptionDraft(current => ({
            ...current,
            providers: {
                ...current.providers,
                [provider]: {
                    ...current.providers[provider],
                    [field]: value
                }
            }
        }))
    }

    function onEpisodeGenerationDraftChange(field: keyof EpisodeGenerationSettingsDraft, value: string) {
        setEpisodeGenerationDraft(current => ({ ...current, [field]: value }))
    }

    function resetToSavedSettings() {
        applySavedSettingsSnapshot(savedSnapshotRef.current)
        setActiveTab('server')
        setError('')
        setStatus('')
    }

    function applySavedSettingsSnapshot(snapshot: SavedSettingsSnapshot) {
        let nextSnapshot = structuredClone(snapshot)
        setDraft(nextSnapshot.draft)
        setServerDraft(nextSnapshot.serverDraft)
        setImageDescriptionDraft(nextSnapshot.imageDescriptionDraft)
        setEpisodeGenerationDraft(nextSnapshot.episodeGenerationDraft)
    }
}

function createDefaultSettingsDraft(): TtsSettingsDraft {
    return {
        inworld: {
            enabled: false,
            apiKey: '',
            baseUrl: 'https://api.inworld.ai'
        },
        openai: {
            enabled: false,
            apiKey: '',
            baseUrl: 'https://api.openai.com/v1'
        },
        elevenlabs: {
            enabled: false,
            apiKey: '',
            baseUrl: 'https://api.elevenlabs.io'
        },
        lemonfox: {
            enabled: false,
            apiKey: '',
            baseUrl: 'https://api.lemonfox.ai/v1'
        },
        voicebox: {
            enabled: false,
            apiKey: '',
            baseUrl: 'http://localhost:17493'
        }
    }
}

function createDefaultServerDraft(): ServerSettingsDraft {
    return {
        address: '',
        port: '80',
        listenOnAllInterfaces: true,
        password: '',
        passwordConfigured: false,
        protocol: 'http'
    }
}

function createDefaultImageDescriptionDraft(): ImageDescriptionSettingsDraft {
    return {
        enabled: false,
        provider: 'openai',
        providers: {
            openai: {
                apiKey: imageDescriptionProviderDefaults.openai.apiKey,
                baseUrl: imageDescriptionProviderDefaults.openai.baseUrl,
                model: imageDescriptionProviderDefaults.openai.model,
                prompt: imageDescriptionProviderDefaults.openai.prompt
            },
            gemini: {
                apiKey: imageDescriptionProviderDefaults.gemini.apiKey,
                baseUrl: imageDescriptionProviderDefaults.gemini.baseUrl,
                model: imageDescriptionProviderDefaults.gemini.model,
                prompt: imageDescriptionProviderDefaults.gemini.prompt
            }
        }
    }
}

function createDefaultEpisodeGenerationDraft(): EpisodeGenerationSettingsDraft {
    return {
        concurrentGenerations: '1'
    }
}

function createDefaultSavedSettingsSnapshot(): SavedSettingsSnapshot {
    return {
        draft: createDefaultSettingsDraft(),
        serverDraft: createDefaultServerDraft(),
        imageDescriptionDraft: createDefaultImageDescriptionDraft(),
        episodeGenerationDraft: createDefaultEpisodeGenerationDraft()
    }
}

function createSavedSettingsSnapshotFromResponse(response: SettingsResponse): SavedSettingsSnapshot {
    return structuredClone({
        draft: response.settings,
        imageDescriptionDraft: {
            enabled: response.imageDescription.enabled,
            provider: response.imageDescription.provider,
            providers: {
                openai: response.imageDescription.providers.openai,
                gemini: response.imageDescription.providers.gemini
            }
        },
        serverDraft: {
            address: formatServerAddress(response.server.protocol, response.server.hostname),
            port: String(response.server.port ?? 80),
            listenOnAllInterfaces: response.server.listenOnAllInterfaces,
            password: '',
            passwordConfigured: response.server.passwordConfigured,
            protocol: response.server.protocol
        },
        episodeGenerationDraft: {
            concurrentGenerations: String(response.episodeGeneration.concurrentGenerations)
        }
    })
}

function parseServerAddress(address: string) {
    address = address.trim()
    if (!address.toLowerCase().startsWith('http'))
        address = 'http://' + address

    let url: URL
    try {
        url = new URL(address)
    } catch {
        return { error: "Server address must be a hostname or IP address, with optional http:// or https:// prefix." } as const
    }

    return {
        protocol: url.protocol == 'https:' ? 'https' : 'http',
        hostname: url.hostname
    } as const
}

function formatServerAddress(protocol: 'http' | 'https', hostname: string) {
    return `${protocol}://${hostname}`
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
        </div>
    </div>
}

function validateSettings(settings: TtsSettingsDraft, imageDescription: ImageDescriptionSettingsDraft) {
    let providers: Array<{ name: string; value: ProviderSettingsDraft; requiresApiKey: boolean }> = [
        { name: 'Inworld', value: settings.inworld, requiresApiKey: ttsProviderMetadata.inworld.requiresApiKey },
        { name: 'OpenAI', value: settings.openai, requiresApiKey: ttsProviderMetadata.openai.requiresApiKey },
        { name: 'ElevenLabs', value: settings.elevenlabs, requiresApiKey: ttsProviderMetadata.elevenlabs.requiresApiKey },
        { name: 'Lemonfox', value: settings.lemonfox, requiresApiKey: ttsProviderMetadata.lemonfox.requiresApiKey },
        { name: 'Voicebox', value: settings.voicebox, requiresApiKey: ttsProviderMetadata.voicebox.requiresApiKey }
    ]

    for (let provider of providers) {
        if (provider.requiresApiKey && provider.value.enabled && !provider.value.apiKey.trim())
            return `${provider.name} API key is required when enabled`

        if (!provider.value.baseUrl.trim())
            return `${provider.name} base URL is required`
    }

    let activeProvider = imageDescription.providers[imageDescription.provider]
    let activeProviderLabel = imageDescriptionProviderDefaults[imageDescription.provider].label

    if (!activeProvider.baseUrl.trim())
        return 'Image description base URL is required'

    if (!activeProvider.model.trim())
        return 'Image description model is required'

    if (!activeProvider.prompt.trim())
        return 'Image description prompt is required'

    if (imageDescription.enabled && !activeProvider.apiKey.trim())
        return `${activeProviderLabel} API key is required when image descriptions are enabled`

    return ''
}

function ImageDescriptionPanel(props: {
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

function sanitizeImageDescriptionProviderDraft(settings: ImageDescriptionProviderDraft) {
    return {
        apiKey: settings.apiKey.trim(),
        baseUrl: settings.baseUrl.trim(),
        model: settings.model.trim(),
        prompt: settings.prompt.trim()
    }
}

function ServerPanel(props: {
    value: ServerSettingsDraft
    onChange: (field: keyof ServerSettingsDraft, value: string | boolean) => void
    episodeGenerationValue: EpisodeGenerationSettingsDraft
    onEpisodeGenerationChange: (field: keyof EpisodeGenerationSettingsDraft, value: string) => void
    isCheckingForUpdate: boolean
    onCheckForUpdate: () => void
}) {
    return <div className={classes(panelContainerStyle)}>
        <div className={classes(panelHeaderStyle)}>
            <h3 className={classes(panelTitleStyle)}>Server Configuration</h3>
        </div>

        <div className={classes(fieldsGridStyle)}>
            <label className={classes(fieldGroupStyle)}>
                <span className={classes(labelStyle)}>Address</span>
                <input
                    className={classes(inputStyle)}
                    type="text"
                    value={props.value.address}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => props.onChange('address', event.target.value)}
                    placeholder="http://my-machine"
                />
                <span className={classes(hintStyle)}>Hostname or IP used in podcast and episode URLs. Optional http:// or https:// prefix. Defaults to http.</span>
            </label>

            <label className={classes(fieldGroupStyle)}>
                <span className={classes(labelStyle)}>Port</span>
                <input
                    className={classes(inputStyle)}
                    type="number"
                    min="1"
                    max="65535"
                    value={props.value.port}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => props.onChange('port', event.target.value)}
                    placeholder="80"
                />
            </label>

            <label className={classes(fieldGroupStyle)}>
                <span className={classes(labelStyle)}>Password</span>
                <input
                    className={classes(inputStyle)}
                    type="password"
                    value={props.value.password}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => props.onChange('password', event.target.value)}
                    placeholder={props.value.passwordConfigured ? '••••••••' : 'Set an access password'}
                    autoComplete="new-password"
                />
                <span className={classes(hintStyle)}>
                    {props.value.passwordConfigured ? 'Leave blank to keep existing password' : 'No password configured'}
                </span>
            </label>

            <label className={classes(toggleLabelStyle)}>
                <input
                    type="checkbox"
                    className={classes(hiddenCheckboxStyle)}
                    checked={props.value.listenOnAllInterfaces}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => props.onChange('listenOnAllInterfaces', event.target.checked)}
                />
                <div className={classes([toggleTrackStyle, props.value.listenOnAllInterfaces && activeToggleTrackStyle])}>
                    <div className={classes([toggleThumbStyle, props.value.listenOnAllInterfaces && activeToggleThumbStyle])} />
                </div>
                <span className={classes(toggleTextContainerStyle)}>Listen on all interfaces</span>
            </label>
            <span className={classes(hintStyle)}>When off, the server only accepts connections to the address above</span>

            <span className={classes(hintStyle)}>Changing address, port, or listen mode will restart the server</span>

            <label className={classes(fieldGroupStyle)}>
                <span className={classes(labelStyle)}>Concurrent episode generation</span>
                <input
                    className={classes(inputStyle)}
                    type="number"
                    min="1"
                    max="20"
                    value={props.episodeGenerationValue.concurrentGenerations}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => props.onEpisodeGenerationChange('concurrentGenerations', event.target.value)}
                    placeholder="1"
                />
                <span className={classes(hintStyle)}>How many episodes can be generated at the same time.</span>
            </label>

            <div className={classes(fieldGroupStyle)}>
                <span className={classes(labelStyle)}>Application update</span>
                <div className={classes(fieldActionRowStyle)}>
                    <button
                        className={classes(buttonStyle)}
                        type="button"
                        onClick={props.onCheckForUpdate}
                        disabled={props.isCheckingForUpdate}
                    >
                        {props.isCheckingForUpdate ? "Checking..." : "Check for updates"}
                    </button>
                    <span className={classes(hintStyle)}>Checks GitHub for a newer packaged release and downloads it if available.</span>
                </div>
            </div>
        </div>
    </div>
}

let dialogContainerStyle = style('settingsDialog', {
    width: '100%',
    maxWidth: 600,
    maxHeight: 'min(720px, calc(100vh - 32px))',
    backgroundColor: 'var(--panel)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    boxShadow: '0 8px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
    overflow: 'hidden',
    padding: 0,
    $: {
        '&[open]': {
            display: 'flex',
            flexDirection: 'column'
        },
        '&::backdrop': {
            backgroundColor: 'color-mix(in srgb, var(--bg) 60%, transparent)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)'
        }
    }
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
    width: 36,
    height: 36,
    padding: 0,
    cursor: 'pointer',
    borderRadius: 4,
    display: 'grid',
    placeItems: 'center',
    transition: 'all 0.15s',
    $: {
        '&:hover': {
            backgroundColor: 'var(--border)',
            color: 'var(--text)'
        }
    }
})

let closeIconStyle = style('closeIcon', {
    width: 16,
    height: 16,
    display: 'block'
})

let layoutStyle = style('settingsLayout', {
    display: 'flex',
    minWidth: 0,
    minHeight: 0,
    flex: 1,
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
    minHeight: 0,
    overflowY: 'auto',
    $: {
        '@media (max-width: 500px)': {
            width: '100%',
            borderRight: 'none',
            borderBottom: '1px solid var(--border)',
            padding: '8px',
            display: 'flex',
            overflowX: 'auto',
            overflowY: 'visible'
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

let tabDividerStyle = style('tabDivider', {
    height: 1,
    backgroundColor: 'var(--border)',
    margin: '4px 8px'
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

let hiddenStatusDotStyle = style('hiddenStatusDot', {
    opacity: 0
})

let activeDotStyle = style('activeDot', {
    backgroundColor: '#10b981',
    boxShadow: '0 0 4px color-mix(in srgb, #10b981 40%, transparent)'
})

let contentStyle = style('settingsContent', {
    flex: 1,
    padding: 24,
    backgroundColor: 'var(--panel)',
    minWidth: 0,
    minHeight: 0,
    overflowY: 'auto'
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

let toggleTextContainerStyle = style('toggleTextContainer', {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--muted)'
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

let fieldActionRowStyle = style('fieldActionRow', {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap'
})

let labelStyle = style('label', {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--muted)'
})

let hintStyle = style('hint', {
    fontSize: 11,
    color: 'var(--muted)',
    opacity: 0.8
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
