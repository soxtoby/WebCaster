import { type ChangeEvent, useEffect, useMemo, useState } from "react"
import { classes, style } from "stylemap"
import type { Feed } from "../../server/db/schema"
import { EpisodesSection } from "./episodes-section"
import { VoiceSelectorField, type VoiceOption } from "./voice-selector-field"

export type FeedDraft = {
    name: string
    rssUrl: string
    voice: string
    generationMode: string
    showArchivedEpisodes: boolean
    contentSource: string
}

export function FeedDetailsSection(props: {
    feed: Feed | null
    onCancel: () => void
    onDelete: () => void
    onSave: (draft: FeedDraft) => Promise<void>
    voiceOptions: VoiceOption[]
}) {
    let isEditing = props.feed != null
    let [draft, setDraft] = useState(() => buildInitialDraft(props.feed, props.voiceOptions))
    let [error, setError] = useState('')
    let [status, setStatus] = useState('')
    let [podcastUrl, setPodcastUrl] = useState('')
    let [isSettingsExpanded, setIsSettingsExpanded] = useState(!isEditing)
    let resolvedVoiceOptions = useMemo(() => {
        let options = [...props.voiceOptions]

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
    }, [props.voiceOptions, draft.voice])
    let isCustomFeed = draft.contentSource == 'custom'

    useEffect(() => {
        setDraft(buildInitialDraft(props.feed, props.voiceOptions))
        setError('')
        setStatus('')
        setPodcastUrl('')
        setIsSettingsExpanded(!isEditing)
    }, [props.feed?.id, isEditing])

    useEffect(() => {
        if (draft.voice)
            return

        let fallbackVoiceId = getFallbackVoiceId(props.voiceOptions)
        if (!fallbackVoiceId)
            return

        setDraft(current => current.voice ? current : { ...current, voice: fallbackVoiceId })
    }, [props.voiceOptions, draft.voice])

    return <section className={classes(panelStyle)}>
        <header className={classes(headerStyle)}>
            <div className={classes(headerInfoStyle)}>
                <h2 className={classes(headerTitleStyle)}>{draft.name || (isEditing ? 'Unnamed Feed' : 'New Feed')}</h2>
                {isEditing
                    ? <a className={classes(rssLinkStyle)} href={podcastUrl} target="_blank" rel="noreferrer">
                        {podcastUrl}
                    </a>
                    : null
                }
            </div>

            <div className={classes(headerActionsStyle)}>
                {isEditing
                    ? <button
                        className={classes([actionButtonStyle, isSettingsExpanded && activeActionButtonStyle])}
                        onClick={() => setIsSettingsExpanded(prev => !prev)}
                        type="button"
                    >
                        {isSettingsExpanded ? 'Hide settings' : 'Settings'}
                    </button>
                    : null}
            </div>
        </header>

        {(isSettingsExpanded || !isEditing) && (
            <div className={classes(settingsSectionStyle)}>
                <div className={classes(settingsGridStyle)}>
                    <Field
                        label="Name"
                        value={draft.name}
                        onChange={value => updateDraft('name', value)}
                        placeholder="Daily Tech News"
                    />
                    {isCustomFeed
                        ? <div className={classes(fieldOuterStyle)}>
                            <span className={classes(fieldLabelStyle)}>RSS URL</span>
                            <div className={classes(customFeedNoteStyle)}>
                                <span className={classes(customFeedNoteBadgeStyle)}>Custom</span>
                                <span>Added manually below</span>
                            </div>
                        </div>
                        : <Field
                            label="RSS URL"
                            value={draft.rssUrl}
                            onChange={value => updateDraft('rssUrl', value)}
                            placeholder="https://example.com/feed.xml"
                        />}
                    <VoiceSelectorField
                        label="Voice"
                        value={draft.voice}
                        options={resolvedVoiceOptions}
                        onChange={value => updateDraft('voice', value)}
                    />
                    <TextSelectField
                        label="Generation mode"
                        value={draft.generationMode}
                        options={['on_demand', 'every_episode']}
                        onChange={value => updateDraft('generationMode', value)}
                    />
                    <TextSelectField
                        label="Content source"
                        value={draft.contentSource}
                        options={['feed_article', 'source_page', 'custom']}
                        onChange={value => updateDraft('contentSource', value)}
                    />
                    <ToggleField
                        checked={draft.showArchivedEpisodes}
                        description="Show archived episodes"
                        label="Archived episodes"
                        onChange={value => updateDraft('showArchivedEpisodes', value)}
                    />
                </div>

                {podcastUrl && (
                    <div className={classes(podcastUrlBannerStyle)}>
                        <span className={classes(statusLabelStyle)}>Podcast Feed:</span>
                        <a className={classes(rssLinkStyle)} href={podcastUrl} rel="noreferrer" target="_blank">{podcastUrl}</a>
                    </div>
                )}

                <div className={classes(settingsActionsStyle)}>
                    {isEditing ? (
                        <button
                            className={classes([actionButtonStyle, dangerButtonStyle])}
                            onClick={props.onDelete}
                            type="button"
                            title="Delete feed"
                        >
                            Delete
                        </button>
                    ) : (
                        <button
                            className={classes(actionButtonStyle)}
                            onClick={props.onCancel}
                            type="button"
                        >
                            Cancel
                        </button>
                    )}

                    <div className={classes(spacerStyle)} />

                    <button
                        className={classes([actionButtonStyle, primaryButtonStyle])}
                        onClick={() => void saveFeed()}
                        type="button"
                    >
                        {isEditing ? 'Save' : 'Create Feed'}
                    </button>
                </div>
            </div>
        )}

        {(status || error) && (
            <div className={classes(messageContainerStyle)}>
                {status ? <span className={classes(statusStyle)}>{status}</span> : null}
                {error ? <span className={classes(errorStyle)}>{error}</span> : null}
            </div>
        )}

        {isEditing && (
            props.feed
                ? <EpisodesSection
                    feed={props.feed}
                    feedTitle={draft.name || 'Unnamed Feed'}
                    contentSource={draft.contentSource}
                    showArchivedEpisodes={draft.showArchivedEpisodes}
                    voiceOptions={resolvedVoiceOptions}
                    onPodcastUrlChange={setPodcastUrl}
                    onError={setError}
                    onStatus={setStatus}
                />
                : null
        )}
    </section>

    function updateDraft(field: keyof FeedDraft, value: string | boolean) {
        setDraft(current => ({ ...current, [field]: value }))
    }

    async function saveFeed() {
        setError('')
        setStatus('')

        if (draft.contentSource != 'custom' && !draft.rssUrl.trim()) {
            setError('RSS URL is required')
            return
        }

        if (draft.contentSource == 'custom' && !draft.name.trim()) {
            setError('Name is required for custom feeds')
            return
        }

        if (!draft.voice.trim()) {
            setError('Voice is required')
            return
        }

        try {
            await props.onSave(draft)
            setStatus(isEditing ? 'Feed updated' : 'Feed added')
        }
        catch (cause) {
            let message = cause instanceof Error ? cause.message : 'Failed to save feed'
            setError(message)
        }
    }
}

function buildInitialDraft(feed: Feed | null, voiceOptions: VoiceOption[]): FeedDraft {
    if (feed) {
        return {
            name: feed.name,
            rssUrl: feed.rssUrl,
            voice: feed.voice,
            generationMode: feed.generationMode,
            showArchivedEpisodes: feed.showArchivedEpisodes,
            contentSource: feed.contentSource
        }
    }

    return {
        name: '',
        rssUrl: '',
        voice: getFallbackVoiceId(voiceOptions),
        generationMode: 'on_demand',
        showArchivedEpisodes: false,
        contentSource: 'feed_article'
    }
}

function getFallbackVoiceId(voiceOptions: VoiceOption[]) {
    let firstVoice = voiceOptions.at(0)
    if (firstVoice)
        return firstVoice.id

    return ''
}

function Field(props: {
    label: string
    value: string
    onChange: (value: string) => void
    placeholder?: string
}) {
    return <label className={classes(fieldOuterStyle)}>
        <span className={classes(fieldLabelStyle)}>{props.label}</span>
        <input
            className={classes(fieldInputStyle)}
            onChange={(event: ChangeEvent<HTMLInputElement>) => props.onChange(event.target.value)}
            placeholder={props.placeholder}
            type="text"
            value={props.value}
        />
    </label>
}

function TextSelectField(props: {
    label: string
    value: string
    options: string[]
    onChange: (value: string) => void
}) {
    return <label className={classes(fieldOuterStyle)}>
        <span className={classes(fieldLabelStyle)}>{props.label}</span>
        <select
            className={classes(fieldInputStyle)}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => props.onChange(event.target.value)}
            value={props.value}
        >
            {props.options.map(option => (
                <option key={option} value={option}>
                    {option === 'on_demand' ? 'On demand' :
                        option === 'every_episode' ? 'Every episode' :
                            option === 'feed_article' ? 'Feed article' :
                                option === 'source_page' ? 'Source page' :
                                    option === 'custom' ? 'Custom' : option}
                </option>
            ))}
        </select>
    </label>
}

function ToggleField(props: {
    checked: boolean
    description: string
    label: string
    onChange: (value: boolean) => void
}) {
    return <label className={classes(fieldOuterStyle)}>
        <span className={classes(fieldLabelStyle)}>{props.label}</span>
        <span className={classes(toggleFieldStyle)}>
            {props.description ? <span className={classes(toggleDescriptionStyle)}>{props.description}</span> : <span className={classes(toggleSpacerStyle)} />}
            <span className={classes(toggleControlWrapStyle)}>
                <input
                    checked={props.checked}
                    className={classes(toggleInputStyle)}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => props.onChange(event.target.checked)}
                    type="checkbox"
                />
                <span className={classes([toggleTrackStyle, props.checked && toggleTrackCheckedStyle])} aria-hidden="true">
                    <span className={classes([toggleThumbStyle, props.checked && toggleThumbCheckedStyle])} />
                </span>
            </span>
        </span>
    </label>
}

let panelStyle = style('panel', {
    backgroundColor: 'var(--panel)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    overflow: 'hidden',
    $: {
        '@media (max-width: 920px)': {
            overflowY: 'auto'
        }
    }
})

let headerStyle = style('header', {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
    backgroundColor: 'var(--bg)',
    gap: 16,
    flexShrink: 0
})

let headerInfoStyle = style('headerInfo', {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 4
})

let headerTitleStyle = style('headerTitle', {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
})

let headerActionsStyle = style('headerActions', {
    display: 'flex',
    gap: 8,
    flexShrink: 0
})

let actionButtonStyle = style('actionButton', {
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '6px 12px',
    backgroundColor: 'var(--panel)',
    color: 'var(--text)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s ease'
})

let activeActionButtonStyle = style('activeActionButton', {
    backgroundColor: 'var(--border)'
})

let primaryButtonStyle = style('primaryButton', {
    backgroundColor: 'var(--accent)',
    borderColor: 'var(--accent)',
    color: 'var(--accent-text)',
    border: 'none'
})

let dangerButtonStyle = style('dangerButton', {
    color: 'var(--danger)',
    borderColor: 'var(--border)'
})

let settingsSectionStyle = style('settingsSection', {
    padding: 20,
    borderBottom: '1px solid var(--border)',
    backgroundColor: 'var(--panel)',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    flexShrink: 0
})

let settingsGridStyle = style('settingsGrid', {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 16
})

let toggleFieldStyle = style('toggleField', {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 34,
    padding: '6px 12px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    backgroundColor: 'var(--bg)'
})

let toggleDescriptionStyle = style('toggleDescription', {
    fontSize: 12,
    lineHeight: 1.3,
    color: 'var(--muted)',
    minWidth: 0,
    flex: 1
})

let toggleSpacerStyle = style('toggleSpacer', {
    flex: 1,
    minWidth: 0
})

let toggleControlWrapStyle = style('toggleControlWrap', {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    flexShrink: 0
})

let toggleInputStyle = style('toggleInput', {
    position: 'absolute',
    inset: 0,
    opacity: 0,
    cursor: 'pointer'
})

let toggleTrackStyle = style('toggleTrack', {
    width: 42,
    height: 24,
    borderRadius: 999,
    backgroundColor: 'color-mix(in srgb, var(--muted) 22%, transparent)',
    border: '1px solid color-mix(in srgb, var(--border) 88%, transparent)',
    padding: 2,
    display: 'inline-flex',
    alignItems: 'center',
    transition: 'background-color 0.15s ease, border-color 0.15s ease'
})

let toggleTrackCheckedStyle = style('toggleTrackChecked', {
    backgroundColor: 'color-mix(in srgb, var(--accent) 20%, white)',
    borderColor: 'color-mix(in srgb, var(--accent) 40%, var(--border))'
})

let toggleThumbStyle = style('toggleThumb', {
    width: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: 'white',
    boxShadow: '0 2px 6px rgba(15, 23, 42, 0.18)',
    transition: 'transform 0.15s ease'
})

let toggleThumbCheckedStyle = style('toggleThumbChecked', {
    transform: 'translateX(18px)'
})

let settingsActionsStyle = style('settingsActions', {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    paddingTop: 8,
    marginTop: 'auto'
})

let customFeedNoteStyle = style('customFeedNote', {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    width: 'fit-content',
    maxWidth: '100%',
    border: '1px solid color-mix(in srgb, var(--border) 88%, transparent)',
    borderRadius: 999,
    padding: '7px 12px',
    fontSize: 12,
    lineHeight: 1.3,
    color: 'var(--muted)',
    backgroundColor: 'color-mix(in srgb, var(--bg) 82%, white)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
})

let customFeedNoteBadgeStyle = style('customFeedNoteBadge', {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: 999,
    backgroundColor: 'color-mix(in srgb, var(--accent) 12%, white)',
    color: 'var(--accent)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.02em',
    textTransform: 'uppercase'
})

let spacerStyle = style('spacer', {
    flex: 1
})

let podcastUrlBannerStyle = style('podcastBanner', {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    backgroundColor: 'var(--bg)',
    borderRadius: 6,
    border: '1px solid var(--border)'
})

let rssLinkStyle = style('rssLink', {
    color: 'var(--muted)',
    fontSize: 13,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    $: {
        '&:hover': {
            color: 'var(--accent)',
            textDecoration: 'underline'
        }
    }
})

let statusLabelStyle = style('statusLabel', {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--muted)'
})

let messageContainerStyle = style('messageContainer', {
    padding: '8px 20px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    gap: 16,
    fontSize: 13,
    flexShrink: 0
})


let fieldOuterStyle = style('fieldGroup', {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    minWidth: 0
})

let fieldLabelStyle = style('fieldLabel', {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--muted)'
})

let fieldInputStyle = style('fieldInput', {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid var(--border)',
    borderRadius: 6,
    fontSize: 13,
    backgroundColor: 'var(--bg)',
    color: 'var(--text)',
    outline: 'none',
    transition: 'border-color 0.15s',
    minHeight: 34,
    $: {
        '&:hover': {
            borderColor: 'var(--muted)'
        },
        '&:focus': {
            borderColor: 'var(--accent)'
        }
    }
})

let statusStyle = style('detailsStatus', {
    fontSize: 13,
    color: 'var(--muted)'
})

let errorStyle = style('detailsError', {
    fontSize: 13,
    color: 'var(--danger)'
})

let episodeExpandedPanelStyle = style('episodeExpandedPanel', {
    padding: 18,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    background: 'linear-gradient(180deg, color-mix(in srgb, var(--bg) 72%, white) 0%, color-mix(in srgb, var(--panel) 92%, white) 100%)',
    $: {
        '@media (max-width: 920px)': {
            padding: 16
        }
    }
})

let episodeExpandedHeaderStyle = style('episodeExpandedHeader', {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
    $: {
        '@media (max-width: 920px)': {
            flexDirection: 'column',
            alignItems: 'stretch',
            gap: 12
        }
    }
})

let episodeExpandedTitleBlockStyle = style('episodeExpandedTitleBlock', {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    minWidth: 0,
    flex: 1
})

let episodeExpandedEyebrowStyle = style('episodeExpandedEyebrow', {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--accent)'
})

let episodeExpandedTitleStyle = style('episodeExpandedTitle', {
    fontSize: 16,
    fontWeight: 650,
    lineHeight: 1.35,
    overflowWrap: 'anywhere'
})

let episodeMetaListStyle = style('episodeMetaList', {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    alignItems: 'center',
    $: {
        '@media (max-width: 920px)': {
            width: '100%'
        }
    }
})

let episodeMetaPillStyle = style('episodeMetaPill', {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 12,
    color: 'var(--muted)',
    backgroundColor: 'color-mix(in srgb, var(--bg) 88%, white)',
    border: '1px solid color-mix(in srgb, var(--border) 88%, transparent)',
    maxWidth: '100%'
})

let episodePlayingPillStyle = style('episodePlayingPill', {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--accent)',
    backgroundColor: 'color-mix(in srgb, var(--accent) 12%, white)'
})

let episodeSourceLinkStyle = style('episodeSourceLink', {
    width: 'fit-content',
    maxWidth: '100%',
    color: 'var(--accent)',
    fontSize: 13,
    fontWeight: 500,
    textDecoration: 'none',
    overflowWrap: 'anywhere',
    $: {
        '&:hover': {
            textDecoration: 'underline'
        }
    }
})

let episodeControlRowStyle = style('episodeControlRow', {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.35fr) minmax(180px, 0.8fr) minmax(180px, 0.9fr)',
    gap: 12,
    alignItems: 'end',
    $: {
        '@media (max-width: 880px)': {
            gridTemplateColumns: '1fr'
        }
    }
})

let episodeControlItemStyle = style('episodeControlItem', {
    minWidth: 0,
    display: 'grid',
    gap: 6,
    alignContent: 'start'
})

let episodeControlLabelStyle = style('episodeControlLabel', {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: 'var(--muted)'
})

let episodeDetailGridStyle = style('episodeDetailGrid', {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 14
})

let episodeDetailCardStyle = style('episodeDetailCard', {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    border: '1px solid color-mix(in srgb, var(--border) 90%, transparent)',
    backgroundColor: 'color-mix(in srgb, var(--panel) 92%, white)',
    boxShadow: '0 10px 24px rgba(15, 23, 42, 0.06)',
    minWidth: 0
})

let episodeDetailAudioCardStyle = style('episodeDetailAudioCard', {
    gridColumn: 'span 2',
    $: {
        '@media (max-width: 760px)': {
            gridColumn: 'span 1'
        }
    }
})

let episodeDetailLabelStyle = style('episodeDetailLabel', {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'var(--muted)'
})

let episodeDetailHintStyle = style('episodeDetailHint', {
    fontSize: 12,
    lineHeight: 1.45,
    color: 'var(--muted)'
})

let episodeDetailAudioContentStyle = style('episodeDetailAudioContent', {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    minWidth: 0
})











