import { useEffect, useRef, useState } from "react"
import { classes } from "stylemap"
import { api } from "../api"
import { ImageDescriptionPanel } from "./settings-dialog/image-description-panel"
import { ProviderPanel } from "./settings-dialog/provider-panel"
import { ServerPanel } from "./settings-dialog/server-panel"
import { imageDescriptionProviderDefaults, ttsProviderMetadata } from "./settings-dialog/settings-metadata"
import { activeDotStyle, activeTabButtonStyle, buttonStyle, closeButtonStyle, closeIconStyle, contentStyle, dialogContainerStyle, errorStyle, footerActionsStyle, footerStyle, headerStyle, headingStyle, hiddenStatusDotStyle, layoutStyle, primaryButtonStyle, sidebarStyle, statusAreaStyle, statusDotStyle, statusStyle, tabButtonStyle, tabDividerStyle, tabsContainerStyle } from "./settings-dialog/styles"
import { type ActiveTab, type EpisodeGenerationSettingsDraft, type ImageDescriptionProviderDraft, type ImageDescriptionSettingsDraft, type ProviderSettingsDraft, type ServerSettingsDraft, type SettingsResponse, type TtsSettingsDraft, type VoiceboxSettingsDraft } from "./settings-dialog/types"

type SavedSettingsSnapshot = {
    draft: TtsSettingsDraft
    serverDraft: ServerSettingsDraft
    imageDescriptionDraft: ImageDescriptionSettingsDraft
    episodeGenerationDraft: EpisodeGenerationSettingsDraft
    voiceboxDraft: VoiceboxSettingsDraft
}

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
    let [isLoggingOut, setIsLoggingOut] = useState(false)
    let [draft, setDraft] = useState<TtsSettingsDraft>(createDefaultSettingsDraft())
    let [serverDraft, setServerDraft] = useState<ServerSettingsDraft>(createDefaultServerDraft())
    let [imageDescriptionDraft, setImageDescriptionDraft] = useState<ImageDescriptionSettingsDraft>(createDefaultImageDescriptionDraft())
    let [episodeGenerationDraft, setEpisodeGenerationDraft] = useState<EpisodeGenerationSettingsDraft>(createDefaultEpisodeGenerationDraft())
    let [voiceboxDraft, setVoiceboxDraft] = useState<VoiceboxSettingsDraft>(createDefaultVoiceboxDraft())

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
                            voiceboxValue={voiceboxDraft}
                            onVoiceboxChange={onVoiceboxDraftChange}
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
                    disabled={isSaving || isLoggingOut}
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
                    disabled={isSaving}
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
                voicebox: {
                    location: voiceboxDraft.location.trim()
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

    function onVoiceboxDraftChange(field: keyof VoiceboxSettingsDraft, value: string) {
        setVoiceboxDraft(current => ({ ...current, [field]: value }))
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
        setVoiceboxDraft(nextSnapshot.voiceboxDraft)
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

function createDefaultVoiceboxDraft(): VoiceboxSettingsDraft {
    return {
        location: ''
    }
}

function createDefaultSavedSettingsSnapshot(): SavedSettingsSnapshot {
    return {
        draft: createDefaultSettingsDraft(),
        serverDraft: createDefaultServerDraft(),
        imageDescriptionDraft: createDefaultImageDescriptionDraft(),
        episodeGenerationDraft: createDefaultEpisodeGenerationDraft(),
        voiceboxDraft: createDefaultVoiceboxDraft()
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
        },
        voiceboxDraft: {
            location: response.voicebox.location
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

function sanitizeImageDescriptionProviderDraft(settings: ImageDescriptionProviderDraft) {
    return {
        apiKey: settings.apiKey.trim(),
        baseUrl: settings.baseUrl.trim(),
        model: settings.model.trim(),
        prompt: settings.prompt.trim()
    }
}

