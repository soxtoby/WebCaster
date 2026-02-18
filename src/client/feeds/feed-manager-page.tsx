import { useLiveQuery } from "@tanstack/react-db"
import { useEffect, useMemo, useState } from "react"
import { classes, cssRules, style } from "stylemap"
import { feedCollection } from "./feed-collections"
import { FeedDetailsSection } from "./feed-details-section"

type FeedDraft = {
    name: string
    rssUrl: string
    voice: string
    language: string
}

let voiceOptions = ['default']
let languageOptions = ['en']

export function FeedManagerPage() {
    let [selectedFeedId, setSelectedFeedId] = useState<number | null>(null)
    let [isCreating, setIsCreating] = useState(false)
    let [draft, setDraft] = useState<FeedDraft>({ name: '', rssUrl: '', voice: 'default', language: 'en' })
    let [error, setError] = useState('')
    let [status, setStatus] = useState('')

    let { data: feeds = [], isLoading, isError } = useLiveQuery(q => q.from({ feedCollection }))

    let selectedFeed = useMemo(() => {
        return feeds.find(feed => feed.id == selectedFeedId) ?? null
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
        if (selectedFeed) {
            setDraft({
                name: selectedFeed.name,
                rssUrl: selectedFeed.rssUrl,
                voice: selectedFeed.voice,
                language: selectedFeed.language
            })
        } else {
            setDraft({ name: '', rssUrl: '', voice: 'default', language: 'en' })
        }
    }, [selectedFeed])

    return <div className={classes(pageStyle)}>
        <header>
            <h1 className={classes(headingStyle)}>RSS Feeds</h1>
            <p className={classes(subtitleStyle)}>Manage feed sources and narration defaults in one view.</p>
        </header>

        <div className={classes(layoutStyle)}>
            <section className={classes([panelStyle])}>
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
                    draft={draft}
                    error={error}
                    isEditing={selectedFeed != null}
                    languageOptions={languageOptions}
                    onCancel={() => {
                        setSelectedFeedId(null)
                        setIsCreating(false)
                        setDraft({ name: "", rssUrl: "", voice: "default", language: "en" })
                        setStatus("")
                        setError("")
                    }}
                    onDelete={() => removeFeed()}
                    onDraftChange={(field, value) => {
                        setDraft(current => ({ ...current, [field]: value }))
                    }}
                    onSubmit={() => {
                        void saveFeed()
                    }}
                    status={status}
                    voiceOptions={voiceOptions}
                />
                : null}
        </div>
    </div>

    async function saveFeed() {
        setError('')
        setStatus('')

        if (!draft.rssUrl.trim()) {
            setError('RSS URL is required')
            return
        }

        if (selectedFeed) {
            feedCollection.update(selectedFeed.id.toString(), f => {
                f.name = draft.name.trim()
                f.rssUrl = draft.rssUrl.trim()
                f.voice = draft.voice
                f.language = draft.language
                f.updatedAt = new Date().toISOString()
            });
            setStatus('Feed updated')
        } else {
            let newFeed = {
                id: -feedCollection.size,
                ...draft,
                description: null,
                imageUrl: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
            feedCollection.insert(newFeed)
            setSelectedFeedId(newFeed.id)
            setIsCreating(false)
            setStatus('Feed added')
        }
    }

    function removeFeed() {
        if (!selectedFeed)
            return

        setError('')
        setStatus('')
        feedCollection.delete(selectedFeed.id.toString())
        setSelectedFeedId(null)
        setIsCreating(false)
        setStatus('Feed deleted')
    }
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
    minHeight: '100%',
    display: 'grid',
    gridTemplateRows: 'auto 1fr',
    gap: 16,
    padding: 20
})

let headingStyle = style('heading', {
    margin: 0,
    fontSize: 28,
    lineHeight: 1.2
})

let subtitleStyle = style('subtitle', {
    margin: [6, 0, 0, 0],
    color: 'var(--muted)'
})

let layoutStyle = style('layout', {
    display: 'grid',
    gap: 16,
    gridTemplateColumns: 'minmax(260px, 360px) minmax(380px, 1fr)',
    $: {
        '@media (max-width: 920px)': {
            gridTemplateColumns: '1fr'
        }
    }
})

let panelStyle = style('panel', {
    backgroundColor: 'var(--panel)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 16
})

let panelHeadingStyle = style('panelHeading', {
    margin: [0, 0, 12, 0],
    fontSize: 18
})

let listStyle = style('feedList', {
    display: 'grid',
    gap: 8
})

let listActionRowStyle = style('listActionRow', {
    marginTop: 12
})

let feedCardStyle = style('feedCard', {
    width: '100%',
    textAlign: 'left',
    border: '1px solid var(--border)',
    borderRadius: 10,
    backgroundColor: 'transparent',
    color: 'inherit',
    padding: 12,
    cursor: 'pointer'
})

let feedCardSelectedStyle = style('feedCardSelected', {
    borderColor: 'var(--accent)',
    backgroundColor: 'color-mix(in srgb, var(--accent) 13%, transparent)'
})

let feedCardContentStyle = style('feedCardContent', {
    display: 'flex',
    gap: 12,
    alignItems: 'center'
})

let feedImageStyle = style('feedImage', {
    width: 48,
    height: 48,
    objectFit: 'cover',
    borderRadius: 6,
    flexShrink: 0
})

let feedPlaceholderStyle = style('feedPlaceholder', {
    width: 48,
    height: 48,
    borderRadius: 6,
    flexShrink: 0,
    backgroundColor: 'var(--accent)',
    color: 'var(--accent-text)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    fontWeight: 600
})

let feedTextStyle = style('feedText', {
    minWidth: 0,
    flex: 1
})

let feedNameStyle = style('feedName', {
    margin: 0,
    fontSize: 15,
    fontWeight: 650
})

let feedMetaStyle = style('feedMeta', {
    margin: [4, 0, 0, 0],
    color: 'var(--muted)',
    fontSize: 13,
    overflowWrap: 'anywhere'
})

let emptyStyle = style('empty', {
    margin: 0,
    color: 'var(--muted)'
})

let buttonStyle = style('button', {
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: [9, 12],
    backgroundColor: 'transparent',
    color: 'inherit',
    cursor: 'pointer'
})

let primaryButtonStyle = style('primaryButton', {
    backgroundColor: 'var(--accent)',
    borderColor: 'var(--accent)',
    color: 'var(--accent-text)'
})

let errorStyle = style('error', {
    margin: [6, 0, 0, 0],
    color: 'var(--danger)'
})
