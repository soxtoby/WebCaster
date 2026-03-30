import { useLiveQuery } from "@tanstack/react-db"
import { useEffect, useMemo, useState } from "react"
import { classes, cssRules, style } from "stylemap"
import { api } from "../api"
import icon from "../icon.svg"
import { feedCollection, type FeedSummary } from "./feed-collections"
import { FeedDetailsSection, type FeedDraft } from "./feed-details-section"
import { SettingsDialog } from "./settings-dialog"
import { type VoiceOption } from "./voice-selector-field"

export function FeedManagerPage() {
    let [selectedFeedId, setSelectedFeedId] = useState<number | null>(null)
    let [isCreating, setIsCreating] = useState(false)
    let [voiceOptions, setVoiceOptions] = useState<VoiceOption[]>([])
    let [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    let [seenFeedEpisodes, setSeenFeedEpisodes] = useState<Record<number, string>>(() => loadSeenFeedEpisodes())

    let { data: feeds = [], isLoading, isError } = useLiveQuery<FeedSummary[]>(q => q.from({ feedCollection }))

    let selectedFeed = useMemo(() => {
        return feeds.find(feed => feed.id == selectedFeedId) ?? (selectedFeedId && selectedFeedId < 0 ? feeds.at(-1) : null)
    }, [feeds, selectedFeedId])

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
        setSeenFeedEpisodes(current => pruneSeenFeedEpisodes(current, feeds))
    }, [feeds])

    useEffect(() => {
        void loadVoices()
    }, [])

    useEffect(() => {
        if (!selectedFeed)
            return

        setSeenFeedEpisodes(current => markFeedEpisodesSeen(current, selectedFeed.id, selectedFeed.latestEpisodePublishedAt))
    }, [selectedFeed?.id, selectedFeed?.latestEpisodePublishedAt])

    useEffect(() => {
        let mediaQuery = window.matchMedia('(min-width: 921px)')

        function handleMediaQueryChange(event: MediaQueryListEvent) {
            if (event.matches)
                setIsMobileMenuOpen(false)
        }

        if (mediaQuery.matches)
            setIsMobileMenuOpen(false)

        mediaQuery.addEventListener('change', handleMediaQueryChange)

        return () => {
            mediaQuery.removeEventListener('change', handleMediaQueryChange)
        }
    }, [])

    useEffect(() => {
        if (!isMobileMenuOpen)
            return

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key == 'Escape')
                setIsMobileMenuOpen(false)
        }

        window.addEventListener('keydown', handleKeyDown)

        return () => {
            window.removeEventListener('keydown', handleKeyDown)
        }
    }, [isMobileMenuOpen])

    return <div className={classes(pageStyle)}>
        <header className={classes(headerStyle)}>
            <div className={classes(headerLeadStyle)}>
                <button
                    aria-controls="feed-list-panel"
                    aria-expanded={isMobileMenuOpen}
                    aria-label={isMobileMenuOpen ? "Close feed list" : "Open feed list"}
                    className={classes([iconButtonStyle, mobileMenuButtonStyle, isMobileMenuOpen && iconButtonActiveStyle])}
                    onClick={() => setIsMobileMenuOpen(open => !open)}
                    type="button"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        {isMobileMenuOpen
                            ? <>
                                <path d="M18 6 6 18" />
                                <path d="m6 6 12 12" />
                            </>
                            : <>
                                <path d="M4 7h16" />
                                <path d="M4 12h16" />
                                <path d="M4 17h16" />
                            </>
                        }
                    </svg>
                </button>
                <div className={classes(brandStyle)}>
                    <img className={classes(brandIconStyle)} src={icon} alt="WebCaster logo" />
                    <h1 className={classes(headingStyle)}><span className={classes(headingWebStyle)}>Web</span><span className={classes(headingCasterStyle)}>Caster</span></h1>
                </div>
            </div>
            <div className={classes(headerActionsStyle)}>
                <button
                    className={classes(iconButtonStyle)}
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
            </div>
        </header>

        <div className={classes(layoutStyle)}>
            <button
                aria-label="Close feed list"
                aria-hidden={!isMobileMenuOpen}
                className={classes([flyoutBackdropStyle, isMobileMenuOpen && flyoutBackdropVisibleStyle])}
                onClick={() => setIsMobileMenuOpen(false)}
                tabIndex={isMobileMenuOpen ? 0 : -1}
                type="button"
            />

            <section
                id="feed-list-panel"
                className={classes([panelStyle, listPanelStyle, listPanelFlyoutStyle, isMobileMenuOpen && listPanelFlyoutOpenStyle])}
            >
                <div className={classes(panelHeadingRowStyle)}>
                    <h2 className={classes(panelHeadingStyle)}>Feed list</h2>
                    <button
                        aria-label="Close feed list"
                        className={classes([iconButtonStyle, flyoutCloseButtonStyle])}
                        onClick={() => setIsMobileMenuOpen(false)}
                        type="button"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M18 6 6 18" />
                            <path d="m6 6 12 12" />
                        </svg>
                    </button>
                </div>
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
                            setIsMobileMenuOpen(false)
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
                                <div className={classes(feedNameRowStyle)}>
                                    <p className={classes(feedNameStyle)}>{feed.name || 'Untitled Feed'}</p>
                                    {feedHasUnseenEpisodes(feed, seenFeedEpisodes)
                                        ? <span className={classes(newEpisodeBadgeStyle)}>New</span>
                                        : null}
                                </div>
                                <p className={classes(feedMetaStyle)}>{feed.description || feed.rssUrl || 'Custom feed'}</p>
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
                                setIsMobileMenuOpen(false)
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
                    key={selectedFeed?.id ?? (isCreating ? 'create' : 'none')}
                    feed={selectedFeed ?? null}
                    onCancel={() => {
                        setSelectedFeedId(null)
                        setIsCreating(false)
                    }}
                    onDelete={removeFeed}
                    onSave={saveFeed}
                    voiceOptions={voiceOptions}
                />
                : null}
        </div>

        <SettingsDialog
            id="settings-dialog"
            onSaved={handleSettingsSaved}
        />
    </div>

    async function saveFeed(draft: FeedDraft) {
        let rssUrl = draft.contentSource == 'custom' ? '' : draft.rssUrl.trim()

        if (selectedFeed) {
            feedCollection.update(selectedFeed.id.toString(), f => {
                f.name = draft.name.trim()
                f.rssUrl = rssUrl
                f.voice = draft.voice
                f.generationMode = draft.generationMode
                f.showArchivedEpisodes = draft.showArchivedEpisodes
                f.contentSource = draft.contentSource
                f.updatedAt = new Date().toISOString()
            })
        } else {
            let newFeed = {
                id: -1,
                ...draft,
                rssUrl,
                description: null,
                imageUrl: null,
                latestEpisodePublishedAt: null,
                podcastSlug: '',
                showArchivedEpisodes: draft.showArchivedEpisodes,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
            await feedCollection.insert(newFeed).isPersisted.promise
            setSelectedFeedId(-1)
            setIsCreating(false)
        }
    }

    function removeFeed() {
        if (!selectedFeed)
            return

        let confirmed = window.confirm(`Delete feed "${selectedFeed.name || 'Untitled Feed'}"?`)
        if (!confirmed)
            return

        feedCollection.delete(selectedFeed.id.toString())
        setSelectedFeedId(null)
        setIsCreating(false)
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

type SeenEpisodesMap = Record<number, string>

function loadSeenFeedEpisodes(): SeenEpisodesMap {
    try {
        let stored = typeof localStorage != 'undefined' ? localStorage.getItem('webcaster:feedSeenEpisodes') : null
        if (!stored)
            return {}

        let parsed = JSON.parse(stored)
        if (!parsed || typeof parsed != 'object')
            return {}

        let result: SeenEpisodesMap = {}
        for (let entry of Object.entries(parsed)) {
            let feedId = Number(entry[0])
            let value = entry[1]
            if (!Number.isFinite(feedId) || typeof value != 'string')
                continue
            result[feedId] = value
        }
        return result
    } catch {
        return {}
    }
}

function persistSeenFeedEpisodes(map: SeenEpisodesMap) {
    try {
        if (typeof localStorage == 'undefined')
            return

        localStorage.setItem('webcaster:feedSeenEpisodes', JSON.stringify(map))
    } catch {
    }
}

function pruneSeenFeedEpisodes(map: SeenEpisodesMap, feeds: FeedSummary[]) {
    let feedIds = new Set(feeds.map(feed => feed.id))
    let hasChanges = false
    let next = { ...map }

    for (let key of Object.keys(map)) {
        let feedId = Number(key)
        if (feedIds.has(feedId))
            continue

        delete next[feedId]
        hasChanges = true
    }

    if (hasChanges)
        persistSeenFeedEpisodes(next)

    return hasChanges ? next : map
}

function markFeedEpisodesSeen(map: SeenEpisodesMap, feedId: number, latestEpisodePublishedAt: string | null) {
    let latestTimestamp = parseTimestamp(latestEpisodePublishedAt)
    if (!latestTimestamp)
        return map

    let seenTimestamp = parseTimestamp(map[feedId])
    if (seenTimestamp && seenTimestamp >= latestTimestamp)
        return map

    let next = { ...map, [feedId]: latestEpisodePublishedAt! }
    persistSeenFeedEpisodes(next)
    return next
}

function feedHasUnseenEpisodes(feed: FeedSummary, seenEpisodes: SeenEpisodesMap) {
    let latestTimestamp = parseTimestamp(feed.latestEpisodePublishedAt)
    if (!latestTimestamp)
        return false

    let seenTimestamp = parseTimestamp(seenEpisodes[feed.id])
    if (!seenTimestamp)
        return true

    return latestTimestamp > seenTimestamp
}

function parseTimestamp(value: string | null | undefined) {
    if (!value)
        return null

    let sqliteLike = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)
    if (sqliteLike) {
        let normalized = normalizeSqliteTimestamp(value)
        let normalizedParsed = Date.parse(normalized)
        if (Number.isNaN(normalizedParsed))
            return null

        return normalizedParsed
    }

    let parsed = Date.parse(value)
    if (Number.isNaN(parsed))
        return null

    return parsed
}

function normalizeSqliteTimestamp(value: string) {
    if (!value.includes(' '))
        return value

    let normalized = value.replace(' ', 'T')
    if (normalized.includes('Z') || normalized.includes('+'))
        return normalized

    return `${normalized}Z`
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

let headerLeadStyle = style('headerLead', {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0
})

let headerActionsStyle = style('headerActions', {
    display: 'flex',
    alignItems: 'center',
    gap: 8
})

let iconButtonStyle = style('iconButton', {
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

let iconButtonActiveStyle = style('iconButtonActive', {
    color: 'var(--text)',
    backgroundColor: 'var(--panel)'
})

let mobileMenuButtonStyle = style('mobileMenuButton', {
    display: 'none',
    $: {
        '@media (max-width: 920px)': {
            display: 'flex'
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
            position: 'relative',
            overflow: 'hidden'
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

let listPanelFlyoutStyle = style('listPanelFlyout', {
    $: {
        '@media (max-width: 920px)': {
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            width: 'min(22rem, calc(100vw - 20px))',
            maxWidth: '100%',
            zIndex: 20,
            borderRadius: '0 18px 18px 0',
            padding: 18,
            boxShadow: '0 24px 48px rgba(15, 23, 42, 0.22)',
            transform: 'translateX(calc(-100% - 24px))',
            opacity: 0,
            pointerEvents: 'none',
            transition: 'transform 0.22s ease, opacity 0.22s ease'
        }
    }
})

let listPanelFlyoutOpenStyle = style('listPanelFlyoutOpen', {
    $: {
        '@media (max-width: 920px)': {
            transform: 'translateX(0)',
            opacity: 1,
            pointerEvents: 'auto'
        }
    }
})

let flyoutBackdropStyle = style('flyoutBackdrop', {
    display: 'none',
    $: {
        '@media (max-width: 920px)': {
            display: 'block',
            position: 'absolute',
            inset: 0,
            border: 'none',
            background: 'rgba(15, 23, 42, 0)',
            opacity: 0,
            pointerEvents: 'none',
            transition: 'background-color 0.22s ease, opacity 0.22s ease',
            zIndex: 10
        }
    }
})

let flyoutBackdropVisibleStyle = style('flyoutBackdropVisible', {
    $: {
        '@media (max-width: 920px)': {
            background: 'rgba(15, 23, 42, 0.34)',
            opacity: 1,
            pointerEvents: 'auto'
        }
    }
})

let panelHeadingRowStyle = style('panelHeadingRow', {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
})

let panelHeadingStyle = style('panelHeading', {
    margin: [0, 0, 4, 0],
    fontSize: 16,
    fontWeight: 600
})

let flyoutCloseButtonStyle = style('flyoutCloseButton', {
    display: 'none',
    $: {
        '@media (max-width: 920px)': {
            display: 'flex'
        }
    }
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

let feedNameRowStyle = style('feedNameRow', {
    display: 'flex',
    alignItems: 'center',
    gap: 6
})

let feedNameStyle = style('feedName', {
    margin: 0,
    fontSize: 14,
    fontWeight: 650
})

let newEpisodeBadgeStyle = style('newEpisodeBadge', {
    padding: '2px 6px',
    borderRadius: 999,
    backgroundColor: 'var(--accent)',
    color: 'var(--accent-text)',
    fontSize: 11,
    fontWeight: 650,
    letterSpacing: '-0.01em',
    lineHeight: 1.2
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

