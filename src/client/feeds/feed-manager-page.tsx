import { useEffect, useMemo, useState, type ChangeEvent } from "react"
import { classes, cssRules, style } from "stylemap"

type Feed = {
    id: number
    name: string
    rssUrl: string
    voice: string
    language: string
    createdAt: string
    updatedAt: string
}

type FeedDraft = {
    name: string
    rssUrl: string
    voice: string
    language: string
}

let voiceOptions = ['default']
let languageOptions = ['en']

export function FeedManagerPage() {
    let [feeds, setFeeds] = useState<Feed[]>([])
    let [selectedFeedId, setSelectedFeedId] = useState<number | null>(null)
    let [isCreating, setIsCreating] = useState(false)
    let [draft, setDraft] = useState<FeedDraft>({ name: '', rssUrl: '', voice: 'default', language: 'en' })
    let [isLoading, setIsLoading] = useState(true)
    let [isSaving, setIsSaving] = useState(false)
    let [isDeleting, setIsDeleting] = useState(false)
    let [error, setError] = useState('')
    let [status, setStatus] = useState('')

    let selectedFeed = useMemo(() => {
        return feeds.find(feed => feed.id == selectedFeedId) ?? null
    }, [feeds, selectedFeedId])

    useEffect(() => {
        void loadFeeds()
    }, [])

    useEffect(() => {
        if (selectedFeed) {
            setDraft({
                name: selectedFeed.name,
                rssUrl: selectedFeed.rssUrl,
                voice: selectedFeed.voice,
                language: selectedFeed.language
            })
        }
        else {
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
                        <p className={classes(feedNameStyle)}>{feed.name}</p>
                        <p className={classes(feedMetaStyle)}>{feed.rssUrl}</p>
                    </button>)}
                </div>
                {!isLoading ? <div className={classes(listActionRowStyle)}>
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
                </div> : null}
            </section>

            {selectedFeed || isCreating ? <section className={classes([panelStyle])}>
                <h2 className={classes(panelHeadingStyle)}>{selectedFeed ? 'Feed details' : 'Add feed'}</h2>
                <form
                    className={classes(formStyle)}
                    onSubmit={event => {
                        event.preventDefault()
                        void saveFeed()
                    }}
                >
                    <Field
                        label="Name"
                        value={draft.name}
                        onChange={value => setDraft(current => ({ ...current, name: value }))}
                        placeholder="Daily Tech News"
                    />
                    <Field
                        label="RSS URL"
                        value={draft.rssUrl}
                        onChange={value => setDraft(current => ({ ...current, rssUrl: value }))}
                        placeholder="https://example.com/feed.xml"
                    />
                    <SelectField
                        label="Voice"
                        value={draft.voice}
                        options={voiceOptions}
                        onChange={value => setDraft(current => ({ ...current, voice: value }))}
                    />
                    <SelectField
                        label="Language"
                        value={draft.language}
                        options={languageOptions}
                        onChange={value => setDraft(current => ({ ...current, language: value }))}
                    />

                    <div className={classes(buttonRowStyle)}>
                        <button className={classes([buttonStyle, primaryButtonStyle])} disabled={isSaving} type="submit">
                            {isSaving ? 'Saving...' : selectedFeed ? 'Save changes' : 'Add feed'}
                        </button>
                        {!selectedFeed ? <button
                            className={classes(buttonStyle)}
                            disabled={isSaving || isDeleting}
                            onClick={() => {
                                setSelectedFeedId(null)
                                setIsCreating(false)
                                setDraft({ name: '', rssUrl: '', voice: 'default', language: 'en' })
                                setStatus('')
                                setError('')
                            }}
                            type="button"
                        >
                            Cancel
                        </button> : null}
                        {selectedFeed ? <button
                            className={classes([buttonStyle, dangerButtonStyle])}
                            disabled={isSaving || isDeleting}
                            onClick={() => {
                                void removeFeed()
                            }}
                            type="button"
                        >
                            {isDeleting ? 'Deleting...' : 'Delete feed'}
                        </button> : null}
                    </div>
                </form>

                {status ? <p className={classes(statusStyle)}>{status}</p> : null}
                {error ? <p className={classes(errorStyle)}>{error}</p> : null}
            </section> : null}
        </div>
    </div>

    async function loadFeeds() {
        setIsLoading(true)
        setError('')
        try {
            let response = await fetch('/api/feeds')
            if (!response.ok)
                throw new Error('Failed to load feeds')

            let json = await response.json() as { feeds: Feed[] }
            setFeeds(json.feeds)

            if (json.feeds.length > 0) {
                let firstFeed = json.feeds.at(0)
                if (firstFeed)
                    setSelectedFeedId(current => current ?? firstFeed.id)
                setIsCreating(false)
            }

            if (json.feeds.length == 0) {
                setSelectedFeedId(null)
                setIsCreating(false)
            }
        }
        catch {
            setError('Could not load feeds')
        }
        finally {
            setIsLoading(false)
        }
    }

    async function saveFeed() {
        setError('')
        setStatus('')

        if (!draft.rssUrl.trim()) {
            setError('RSS URL is required')
            return
        }

        setIsSaving(true)
        try {
            let method = selectedFeed ? 'PUT' : 'POST'
            let url = selectedFeed ? `/api/feeds/${selectedFeed.id}` : '/api/feeds'
            let response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: draft.name.trim(),
                    rssUrl: draft.rssUrl.trim(),
                    voice: draft.voice,
                    language: draft.language
                })
            })

            if (!response.ok) {
                let err = await readError(response)
                throw new Error(err)
            }

            let json = await response.json() as { feed: Feed }
            if (selectedFeed) {
                setFeeds(current => current.map(feed => feed.id == json.feed.id ? json.feed : feed))
                setStatus('Feed updated')
            }
            else {
                setFeeds(current => [json.feed, ...current])
                setSelectedFeedId(json.feed.id)
                setIsCreating(false)
                setStatus('Feed added')
            }
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save feed')
        }
        finally {
            setIsSaving(false)
        }
    }

    async function removeFeed() {
        if (!selectedFeed)
            return

        setIsDeleting(true)
        setError('')
        setStatus('')
        try {
            let response = await fetch(`/api/feeds/${selectedFeed.id}`, { method: 'DELETE' })
            if (!response.ok) {
                let err = await readError(response)
                throw new Error(err)
            }

            setFeeds(current => {
                let next = current.filter(feed => feed.id != selectedFeed.id)
                if (next.length > 0) {
                    let firstFeed = next.at(0)
                    if (firstFeed)
                        setSelectedFeedId(firstFeed.id)
                }
                else {
                    setSelectedFeedId(null)
                    setIsCreating(false)
                }

                return next
            })
            setStatus('Feed deleted')
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete feed')
        }
        finally {
            setIsDeleting(false)
        }
    }
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

function SelectField(props: {
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

async function readError(response: Response) {
    try {
        let json = await response.json() as { error?: string }
        if (json.error)
            return json.error
    }
    catch {
    }

    return 'Request failed'
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

let formStyle = style('form', {
    display: 'grid',
    gap: 12
})

let fieldGroupStyle = style('fieldGroup', {
    display: 'grid',
    gap: 6
})

let labelStyle = style('label', {
    fontSize: 13,
    color: 'var(--muted)'
})

let inputStyle = style('input', {
    width: '100%',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: [10, 12],
    backgroundColor: 'transparent',
    color: 'inherit'
})

let buttonRowStyle = style('buttonRow', {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap'
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

let dangerButtonStyle = style('dangerButton', {
    color: 'var(--danger)',
    borderColor: 'var(--danger)'
})

let statusStyle = style('status', {
    margin: [4, 0, 0, 0],
    color: 'var(--muted)'
})

let errorStyle = style('error', {
    margin: [6, 0, 0, 0],
    color: 'var(--danger)'
})
