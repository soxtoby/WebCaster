import { useLiveQuery } from "@tanstack/react-db"
import { useEffect, useMemo, useState } from "react"
import { classes, cssRules, style } from "stylemap"
import { api } from "../api"
import icon from "../icon.svg"
import { feedCollection } from "./feed-collections"
import { FeedDetailsSection } from "./feed-details-section"
import { SettingsDialog } from "./settings-dialog"
import { type VoiceOption } from "./voice-selector-field"

type FeedDraft = {
    name: string
    rssUrl: string
    voice: string
    generationMode: string
    contentSource: string
}

type FeedEpisode = {
    episodeKey: string
    title: string
    sourceUrl: string
    publishedAt: string | null
    status: string
    errorMessage: string | null
    audioReady: boolean
    audioUrl: string
    voice: string | null
}

export function FeedManagerPage() {
    let [selectedFeedId, setSelectedFeedId] = useState<number | null>(null)
    let [isCreating, setIsCreating] = useState(false)
    let [draft, setDraft] = useState<FeedDraft>({ name: '', rssUrl: '', voice: '', generationMode: 'on_demand', contentSource: 'feed_article' })
    let [error, setError] = useState('')
    let [status, setStatus] = useState('')
    let [podcastUrl, setPodcastUrl] = useState('')
    let [episodes, setEpisodes] = useState<FeedEpisode[]>([])
    let [activeEpisodeKey, setActiveEpisodeKey] = useState<string | null>(null)
    let [activeEpisodeAudioUrl, setActiveEpisodeAudioUrl] = useState('')
    let [updatingEpisodeVoiceKey, setUpdatingEpisodeVoiceKey] = useState<string | null>(null)

    let [voiceOptions, setVoiceOptions] = useState<VoiceOption[]>([])

    let { data: feeds = [], isLoading, isError } = useLiveQuery(q => q.from({ feedCollection }))

    let selectedFeed = useMemo(() => {
        return feeds.find(feed => feed.id == selectedFeedId) ?? (selectedFeedId && selectedFeedId < 0 ? feeds.at(-1) : null)
    }, [feeds, selectedFeedId])

    let resolvedVoiceOptions = useMemo(() => {
        let options = [...voiceOptions]

        if (draft.voice && !options.some(option => option.id == draft.voice)) {
            options.unshift({
                id: draft.voice,
                name: 'Saved voice',
                description: 'Saved voice',
                gender: 'unknown',
                provider: 'saved'
            })
        }

        return options
    }, [voiceOptions, draft.voice])

    useEffect(() => {
        if (feeds.length > 0) {
            let hasSelectedFeed = selectedFeedId != null && feeds.some(feed => feed.id == selectedFeedId)
            if (!hasSelectedFeed && !isCreating) {
                let firstFeed = feeds.at(0)
                if (firstFeed)
                    setSelectedFeedId(firstFeed.id)
            }
        } else {
            setSelectedFeedId(null)
        }
    }, [feeds, selectedFeedId, isCreating])

    useEffect(() => {
        if (selectedFeed) {
            setDraft({
                name: selectedFeed.name,
                rssUrl: selectedFeed.rssUrl,
                voice: selectedFeed.voice,
                generationMode: selectedFeed.generationMode,
                contentSource: selectedFeed.contentSource
            })
        } else {
            setDraft({ name: '', rssUrl: '', voice: getFallbackVoiceId(voiceOptions), generationMode: 'on_demand', contentSource: 'feed_article' })
        }
    }, [selectedFeed, voiceOptions])

    useEffect(() => {
        setActiveEpisodeKey(null)
        setActiveEpisodeAudioUrl('')

        if (selectedFeedId != null)
            void loadEpisodes(selectedFeedId)
        else {
            setPodcastUrl('')
            setEpisodes([])
        }
    }, [selectedFeedId])

    useEffect(() => {
        void loadVoices()
    }, [])

    return <div className={classes(pageStyle)}>
        <header className={classes(headerStyle)}>
            <div className={classes(brandStyle)}>
                <img className={classes(brandIconStyle)} src={icon} alt="WebCaster logo" />
                <h1 className={classes(headingStyle)}><span className={classes(headingWebStyle)}>Web</span><span className={classes(headingCasterStyle)}>Caster</span></h1>
            </div>
            <button
                className={classes(settingsButtonStyle)}
                commandFor="settings-dialog"
                command="show-modal"
                type="button"
                aria-label="Settings"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                    <circle cx="12" cy="12" r="3" />
                </svg>
            </button>
        </header>

        <div className={classes(layoutStyle)}>
            <section className={classes([panelStyle, listPanelStyle])}>
                <h2 className={classes(panelHeadingStyle)}>Feed list</h2>
                {isLoading ? <p className={classes(emptyStyle)}>Loading feeds...</p> : null}
                {isError ? <p className={classes(errorStyle)}>Could not load feeds</p> : null}
                {!isLoading && feeds.length == 0 ? <p className={classes(emptyStyle)}>No feeds yet.</p> : null}
                <div className={classes(listStyle)}>
                    {feeds.map(feed => <button
                        key={feed.id}
                        className={classes([feedCardStyle, selectedFeedId == feed.id && feedCardSelectedStyle])}
                        onClick={() => {
                            setSelectedFeedId(feed.id)
                            setIsCreating(false)
                            setStatus('')
                            setError('')
                        }}
                        type="button"
                    >
                        <div className={classes(feedCardContentStyle)}>
                            {feed.imageUrl
                                ? <img src={feed.imageUrl} alt="" className={classes(feedImageStyle)} />
                                : <div className={classes(feedPlaceholderStyle)}>
                                    {(feed.name || 'Untitled')[0]?.toUpperCase() || 'U'}
                                </div>
                            }
                            <div className={classes(feedTextStyle)}>
                                <p className={classes(feedNameStyle)}>{feed.name || 'Untitled Feed'}</p>
                                <p className={classes(feedMetaStyle)}>{feed.description || feed.rssUrl}</p>
                            </div>
                        </div>
                    </button>)}
                </div>
                {!isLoading
                    ? <div className={classes(listActionRowStyle)}>
                        <button
                            className={classes([buttonStyle, primaryButtonStyle])}
                            onClick={() => {
                                setSelectedFeedId(null)
                                setIsCreating(true)
                                setStatus('')
                                setError('')
                                setDraft({ name: '', rssUrl: '', voice: getFallbackVoiceId(resolvedVoiceOptions), generationMode: 'on_demand', contentSource: 'feed_article' })
                            }}
                            type="button"
                        >
                            Add feed
                        </button>
                    </div>
                    : null}
            </section>

            {selectedFeed || isCreating
                ? <FeedDetailsSection
                    activeEpisodeAudioUrl={activeEpisodeAudioUrl}
                    activeEpisodeKey={activeEpisodeKey}
                    draft={draft}
                    error={error}
                    feedId={selectedFeed?.id ?? null}
                    isEditing={selectedFeed != null}
                    podcastUrl={podcastUrl}
                    episodes={episodes}
                    onCancel={() => {
                        setSelectedFeedId(null)
                        setIsCreating(false)
                        setDraft({ name: '', rssUrl: '', voice: getFallbackVoiceId(resolvedVoiceOptions), generationMode: 'on_demand', contentSource: 'feed_article' })
                        setStatus('')
                        setError('')
                    }}
                    onDelete={() => removeFeed()}
                    onDraftChange={(field, value) => {
                        setDraft(current => ({ ...current, [field]: value }))
                    }}
                    onPlayEpisode={episode => {
                        setActiveEpisodeKey(episode.episodeKey)
                        setActiveEpisodeAudioUrl(episode.audioUrl)
                    }}
                    onEpisodeVoiceChange={(episodeKey, voice) => void updateEpisodeVoice(episodeKey, voice)}
                    onSubmit={() => saveFeed()}
                    status={status}
                    updatingEpisodeVoiceKey={updatingEpisodeVoiceKey}
                    voiceOptions={resolvedVoiceOptions}
                />
                : null}
        </div>

        <SettingsDialog
            id="settings-dialog"
            onSaved={handleSettingsSaved}
        />
    </div>

    async function saveFeed() {
        setError('')
        setStatus('')

        if (!draft.rssUrl.trim()) {
            setError('RSS URL is required')
            return
        }

        if (!draft.voice.trim()) {
            setError('Voice is required')
            return
        }

        if (selectedFeed) {
            feedCollection.update(selectedFeed.id.toString(), f => {
                f.name = draft.name.trim()
                f.rssUrl = draft.rssUrl.trim()
                f.voice = draft.voice
                f.generationMode = draft.generationMode
                f.contentSource = draft.contentSource
                f.updatedAt = new Date().toISOString()
            })
            setStatus('Feed updated')
            await loadEpisodes(selectedFeed.id)
        } else {
            let newFeed = {
                id: -1,
                ...draft,
                description: null,
                imageUrl: null,
                podcastSlug: '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
            await feedCollection.insert(newFeed).isPersisted.promise
            let newFeedId = feedCollection.toArray.findLast(f => f.rssUrl == newFeed.rssUrl)?.id ?? null
            setSelectedFeedId(newFeedId)
            setIsCreating(false)
            setStatus('Feed added')
        }
    }

    function removeFeed() {
        if (!selectedFeed)
            return

        let confirmed = window.confirm(`Delete feed "${selectedFeed.name || 'Untitled Feed'}"?`)
        if (!confirmed)
            return

        setError('')
        setStatus('')
        feedCollection.delete(selectedFeed.id.toString())
        setSelectedFeedId(null)
        setIsCreating(false)
        setEpisodes([])
        setPodcastUrl('')
        setStatus('Feed deleted')
    }

    async function updateEpisodeVoice(episodeKey: string, voice: string) {
        if (!selectedFeed)
            return

        setError('')
        setStatus('')
        setUpdatingEpisodeVoiceKey(episodeKey)

        try {
            await api.feeds.setEpisodeVoice.mutate({ id: selectedFeed.id, episodeKey, voice })
            setStatus(voice ? 'Episode voice updated' : 'Episode voice reset to feed default')

            if (activeEpisodeKey == episodeKey)
                setActiveEpisodeAudioUrl(`${window.location.origin}/feed/${selectedFeed.podcastSlug}/${episodeKey}?v=${Date.now()}`)

            await loadEpisodes(selectedFeed.id)
        }
        catch (cause) {
            let message = cause instanceof Error ? cause.message : 'Failed to update episode voice'
            setError(message)
        }
        finally {
            setUpdatingEpisodeVoiceKey(null)
        }
    }

    async function loadEpisodes(feedId: number) {
        try {
            let response = await api.feeds.episodes.query({ id: feedId })
            setPodcastUrl(`${window.location.origin}${response.podcastUrl}`)
            let enrichedEpisodes = response.episodes.map(episode => ({
                ...episode,
                audioUrl: `${window.location.origin}${episode.episodePath}`
            }))
            setEpisodes(enrichedEpisodes)
        }
        catch {
            setEpisodes([])
            setPodcastUrl('')
        }
    }

    async function loadVoices() {
        try {
            let response = await api.voices.list.query()
            let voices = response.voices.map(voice => ({
                id: voice.id,
                name: voice.name,
                description: voice.description,
                gender: voice.gender,
                provider: voice.provider
            }))
            setVoiceOptions(voices)
        } catch {
            setVoiceOptions([])
        }
    }

    async function handleSettingsSaved(result: { redirectUrl?: string }) {
        await loadVoices()

        if (result.redirectUrl) {
            setTimeout(() => {
                window.location.href = result.redirectUrl!
            }, 1000)
        }
    }
}

function getFallbackVoiceId(voiceOptions: VoiceOption[]) {
    let firstVoice = voiceOptions.at(0)
    if (firstVoice)
        return firstVoice.id

    return ''
}

cssRules({
    ':root': {
        colorScheme: 'light dark',
        '--bg': '#f3f5f8',
        '--panel': '#ffffff',
        '--text': '#101828',
        '--muted': '#667085',
        '--border': '#d0d5dd',
        '--accent': '#2563eb',
        '--accent-text': '#ffffff',
        '--danger': '#dc2626'
    },
    '@media (prefers-color-scheme: dark)': {
        ':root': {
            '--bg': '#0f172a',
            '--panel': '#111827',
            '--text': '#f3f4f6',
            '--muted': '#94a3b8',
            '--border': '#334155',
            '--accent': '#60a5fa',
            '--accent-text': '#0b1220',
            '--danger': '#f87171'
        }
    },
    'html, body, #root': {
        height: '100%'
    },
    'body': {
        margin: 0,
        fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
        backgroundColor: 'var(--bg)',
        color: 'var(--text)'
    },
    '*': {
        boxSizing: 'border-box'
    },
    'input, select, button': {
        fontFamily: 'inherit'
    }
})

let pageStyle = style('page', {
    height: '100%',
    display: 'grid',
    gridTemplateRows: 'auto 1fr',
    gap: 12,
    padding: 14,
    overflow: 'hidden'
})

let headerStyle = style('header', {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10
})

let settingsButtonStyle = style('settingsButton', {
    background: 'none',
    border: 'none',
    padding: 6,
    borderRadius: 6,
    color: 'var(--muted)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'color 0.15s, background-color 0.15s',
    $: {
        '&:hover': {
            color: 'var(--fg)',
            backgroundColor: 'var(--panel)'
        }
    }
})

let brandStyle = style('brand', {
    display: 'flex',
    alignItems: 'center',
    gap: 8
})

let brandIconStyle = style('brandIcon', {
    width: 28,
    height: 28,
    color: 'var(--accent, #7c5cfc)',
    flexShrink: 0
})

let headingStyle = style('heading', {
    margin: 0,
    fontSize: 22,
    lineHeight: 1.2,
    fontWeight: 700,
    letterSpacing: '-0.02em'
})

let headingWebStyle = style('headingWeb', {
    color: '#1e293b'
})

let headingCasterStyle = style('headingCaster', {
    color: '#64748b'
})

let layoutStyle = style('layout', {
    display: 'grid',
    gap: 16,
    gridTemplateColumns: '300px minmax(0, 1fr)',
    minHeight: 0,
    $: {
        '@media (max-width: 920px)': {
            gridTemplateColumns: '1fr',
            overflow: 'auto'
        }
    }
})

let panelStyle = style('panel', {
    backgroundColor: 'var(--panel)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: 16,
    minHeight: 0,
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
})

let listPanelStyle = style('listPanel', {
    display: 'grid',
    gridTemplateRows: 'auto auto auto 1fr auto',
    gap: 12
})

let panelHeadingStyle = style('panelHeading', {
    margin: [0, 0, 4, 0],
    fontSize: 16,
    fontWeight: 600
})

let listStyle = style('feedList', {
    display: 'grid',
    gap: 8,
    minHeight: 0,
    overflowY: 'auto',
    paddingRight: 4
})

let listActionRowStyle = style('listActionRow', {
    marginTop: 8
})

let feedCardStyle = style('feedCard', {
    width: '100%',
    textAlign: 'left',
    border: '1px solid var(--border)',
    borderRadius: 8,
    backgroundColor: 'var(--bg)',
    color: 'inherit',
    padding: 10,
    cursor: 'pointer',
    transition: 'border-color 0.15s, background-color 0.15s',
    $: {
        '&:hover': {
            borderColor: 'var(--muted)',
            backgroundColor: 'var(--panel)'
        }
    }
})

let feedCardSelectedStyle = style('feedCardSelected', {
    borderColor: 'var(--accent)',
    backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)',
    $: {
        '&:hover': {
            borderColor: 'var(--accent)',
            backgroundColor: 'color-mix(in srgb, var(--accent) 15%, transparent)'
        }
    }
})

let feedCardContentStyle = style('feedCardContent', {
    display: 'flex',
    gap: 10,
    alignItems: 'center'
})

let feedImageStyle = style('feedImage', {
    width: 40,
    height: 40,
    objectFit: 'cover',
    borderRadius: 6,
    flexShrink: 0
})

let feedPlaceholderStyle = style('feedPlaceholder', {
    width: 40,
    height: 40,
    borderRadius: 6,
    flexShrink: 0,
    backgroundColor: 'var(--accent)',
    color: 'var(--accent-text)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    fontWeight: 600
})

let feedTextStyle = style('feedText', {
    minWidth: 0,
    flex: 1
})

let feedNameStyle = style('feedName', {
    margin: 0,
    fontSize: 14,
    fontWeight: 650
})

let feedMetaStyle = style('feedMeta', {
    margin: [2, 0, 0, 0],
    color: 'var(--muted)',
    fontSize: 12,
    overflowWrap: 'anywhere'
})

let emptyStyle = style('empty', {
    margin: 0,
    color: 'var(--muted)'
})

let buttonStyle = style('button', {
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '8px 12px',
    backgroundColor: 'var(--panel)',
    color: 'inherit',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
    transition: 'border-color 0.15s, background-color 0.15s',
    $: {
        '&:hover': {
            borderColor: 'var(--muted)',
            backgroundColor: 'var(--bg)'
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
            borderColor: 'var(--accent)',
            backgroundColor: 'color-mix(in srgb, var(--accent) 90%, black)'
        }
    }
})

let errorStyle = style('error', {
    margin: [6, 0, 0, 0],
    color: 'var(--danger)'
})

