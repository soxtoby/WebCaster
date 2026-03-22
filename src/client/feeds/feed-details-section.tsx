import { type ChangeEvent, useEffect, useState } from "react"
import { classes, style } from "stylemap"
import { buildEpisodeTranscriptDialogId, EpisodeTranscriptDialog } from "./episode-transcript-dialog"
import { VoiceSelectorDialog } from "./voice-selector-dialog"
import { VoiceSelectorField, type VoiceOption } from "./voice-selector-field"

type FeedDraft = {
    name: string
    rssUrl: string
    voice: string
    generationMode: string
    contentSource: string
}

type Episode = {
    episodeKey: string
    title: string
    sourceUrl: string
    publishedAt: string | null
    durationSeconds: number | null
    isDurationEstimated: boolean
    status: string
    errorMessage: string | null
    audioReady: boolean
    audioUrl: string
    voice: string | null
    progressPercent: number
    chunksProcessed: number
    chunksTotal: number
    progressMode: string
    estimatedSecondsRemaining: number
}

export function FeedDetailsSection(props: {
    activeEpisodeAudioUrl: string
    activeEpisodeKey: string | null
    draft: FeedDraft
    episodes: Episode[]
    error: string
    feedId: number | null
    isAddingArticle: boolean
    isEditing: boolean
    podcastUrl: string
    onAddArticle: (url: string) => Promise<void>
    onCancel: () => void
    onDelete: () => void
    onDraftChange: (field: keyof FeedDraft, value: string) => void
    onRemoveArticle: (episode: Episode) => void
    onPlayEpisode: (episode: Episode) => void
    onEpisodeVoiceChange: (episodeKey: string, voice: string) => void
    onSubmit: () => void
    removingEpisodeKey: string | null
    status: string
    updatingEpisodeVoiceKey: string | null
    voiceOptions: VoiceOption[]
}) {
    let [isSettingsExpanded, setIsSettingsExpanded] = useState(!props.isEditing)
    let [articleUrl, setArticleUrl] = useState('')
    let isCustomFeed = props.draft.contentSource == 'custom'

    useEffect(() => {
        setArticleUrl('')
    }, [props.feedId, props.draft.contentSource])

    let sortedEpisodes = [...props.episodes].sort((a, b) => {
        if (!a.publishedAt) return 1
        if (!b.publishedAt) return -1
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    })

    return <section className={classes(panelStyle)}>
        <header className={classes(headerStyle)}>
            <div className={classes(headerInfoStyle)}>
                <h2 className={classes(headerTitleStyle)}>{props.draft.name || (props.isEditing ? 'Unnamed Feed' : 'New Feed')}</h2>
                {props.isEditing
                    ? <a className={classes(rssLinkStyle)} href={props.podcastUrl} target="_blank" rel="noreferrer">
                        {props.podcastUrl}
                    </a>
                    : null
                }
            </div>

            <div className={classes(headerActionsStyle)}>
                {props.isEditing
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

        {(isSettingsExpanded || !props.isEditing) && (
            <div className={classes(settingsSectionStyle)}>
                <div className={classes(settingsGridStyle)}>
                    <Field
                        label="Name"
                        value={props.draft.name}
                        onChange={value => props.onDraftChange('name', value)}
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
                            value={props.draft.rssUrl}
                            onChange={value => props.onDraftChange('rssUrl', value)}
                            placeholder="https://example.com/feed.xml"
                        />}
                    <VoiceSelectorField
                        label="Voice"
                        value={props.draft.voice}
                        options={props.voiceOptions}
                        onChange={value => props.onDraftChange('voice', value)}
                    />
                    <TextSelectField
                        label="Generation mode"
                        value={props.draft.generationMode}
                        options={['on_demand', 'every_episode']}
                        onChange={value => props.onDraftChange('generationMode', value)}
                    />
                    <TextSelectField
                        label="Content source"
                        value={props.draft.contentSource}
                        options={['feed_article', 'source_page', 'custom']}
                        onChange={value => props.onDraftChange('contentSource', value)}
                    />
                </div>

                {props.podcastUrl && (
                    <div className={classes(podcastUrlBannerStyle)}>
                        <span className={classes(statusLabelStyle)}>Podcast Feed:</span>
                        <a className={classes(rssLinkStyle)} href={props.podcastUrl} rel="noreferrer" target="_blank">{props.podcastUrl}</a>
                    </div>
                )}

                <div className={classes(settingsActionsStyle)}>
                    {props.isEditing ? (
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
                        onClick={props.onSubmit}
                        type="button"
                    >
                        {props.isEditing ? 'Save' : 'Create Feed'}
                    </button>
                </div>
            </div>
        )}

        {(props.status || props.error) && (
            <div className={classes(messageContainerStyle)}>
                {props.status ? <span className={classes(statusStyle)}>{props.status}</span> : null}
                {props.error ? <span className={classes(errorStyle)}>{props.error}</span> : null}
            </div>
        )}

        {props.isEditing && (
            <div className={classes(episodesAreaStyle)}>
                {isCustomFeed
                    ? <div className={classes(customArticleBarStyle)}>
                        <div className={classes(customArticleInfoStyle)}>
                            <span className={classes(fieldLabelStyle)}>Add article URL</span>
                            <span className={classes(customArticleHintStyle)}>Import a single web article as a podcast episode.</span>
                        </div>
                        <div className={classes(customArticleFormStyle)}>
                            <input
                                className={classes(fieldInputStyle)}
                                onChange={(event: ChangeEvent<HTMLInputElement>) => setArticleUrl(event.target.value)}
                                placeholder="https://example.com/article"
                                type="url"
                                value={articleUrl}
                            />
                            <button
                                className={classes([actionButtonStyle, primaryButtonStyle])}
                                disabled={!articleUrl.trim() || props.isAddingArticle}
                                onClick={async () => {
                                    let value = articleUrl.trim()
                                    if (!value || props.isAddingArticle)
                                        return

                                    await props.onAddArticle(value)
                                    setArticleUrl('')
                                }}
                                type="button"
                            >
                                {props.isAddingArticle ? 'Adding...' : 'Add article'}
                            </button>
                        </div>
                    </div>
                    : null}

                <div className={classes(episodesListContainerStyle)}>
                    {sortedEpisodes.length === 0 ? (
                        <div className={classes(emptyEpisodesStyle)}>{isCustomFeed ? 'No articles yet. Add a URL to create the first episode.' : 'No episodes discovered yet.'}</div>
                    ) : (
                        <table className={classes(episodesTableStyle)}>
                            <thead>
                                <tr>
                                    <th className={classes([thStyle, thTitleStyle])}>Episode Title</th>
                                    <th className={classes([thStyle, thDateStyle])}>Published</th>
                                    <th className={classes([thStyle, thDurationStyle])}>Length</th>
                                    <th className={classes([thStyle, thStatusStyle])}>Status</th>
                                    <th className={classes([thStyle, thVoiceStyle])}>Voice</th>
                                    <th className={classes([thStyle, thTranscriptStyle])}>Transcript</th>
                                    <th className={classes([thStyle, thAudioStyle])}>Audio</th>
                                    {isCustomFeed ? <th className={classes([thStyle, thActionsStyle])}>Actions</th> : null}
                                </tr>
                            </thead>
                            <tbody>
                                {sortedEpisodes.map(episode => {
                                    let isPlayingEpisode = props.activeEpisodeKey === episode.episodeKey

                                    let dateStr = ''
                                    if (episode.publishedAt) {
                                        dateStr = new Date(episode.publishedAt).toLocaleDateString(undefined, {
                                            month: 'short', day: 'numeric', year: 'numeric'
                                        })
                                    }

                                    return (
                                        <tr key={episode.episodeKey} className={classes([trStyle, isPlayingEpisode && activeTrStyle])}>
                                            <td className={classes([tdStyle, tdTitleStyle])}>
                                                <div className={classes(episodeTitleTextStyle)} title={episode.title}>{episode.title}</div>
                                                {episode.errorMessage ? <div className={classes(episodeErrorTextStyle)}>{episode.errorMessage}</div> : null}
                                            </td>
                                            <td className={classes([tdStyle, tdDateStyle])}>
                                                {dateStr}
                                            </td>
                                            <td className={classes([tdStyle, tdDurationStyle])}>
                                                {buildEpisodeDurationLabel(episode)}
                                            </td>
                                            <td className={classes(tdStyle)}>
                                                {episode.status == 'generating'
                                                    ? <div className={classes(progressStatusStyle)}>
                                                        <div className={classes(progressTrackStyle)}>
                                                            <div
                                                                className={classes(progressFillStyle)}
                                                                style={{ width: `${Math.min(100, Math.max(0, episode.progressPercent))}%` }}
                                                            />
                                                        </div>
                                                        <div className={classes(progressMetaStyle)}>
                                                            {buildEpisodeProgressLabel(episode)}
                                                        </div>
                                                    </div>
                                                    : <span className={classes([statusBadgeStyle, episode.status === 'ready' && completedBadgeStyle])}>
                                                        {episode.status.replace('_', ' ')}
                                                    </span>}
                                            </td>
                                            <td className={classes([tdStyle, tdVoiceStyle])}>
                                                <button
                                                    className={classes(episodeVoiceButtonStyle)}
                                                    commandFor={buildEpisodeVoiceDialogId(episode.episodeKey)}
                                                    command="show-modal"
                                                    disabled={props.updatingEpisodeVoiceKey == episode.episodeKey}
                                                    aria-label={buildEpisodeVoiceAriaLabel(props.voiceOptions, episode.voice, props.updatingEpisodeVoiceKey == episode.episodeKey)}
                                                    type="button"
                                                >
                                                    {props.updatingEpisodeVoiceKey == episode.episodeKey
                                                        ? 'Saving...'
                                                        : <span className={classes([episodeVoiceButtonInnerStyle, !episode.voice && episodeVoiceButtonIconOnlyStyle])}>
                                                            <svg className={classes(episodeVoiceIconStyle)} viewBox="0 0 24 24" aria-hidden="true">
                                                                <path fill="currentColor" d="M23 9q0 1.725-.612 3.288t-1.663 2.837q-.3.35-.75.375t-.8-.325q-.325-.325-.3-.775t.3-.825q.75-.95 1.163-2.125T20.75 9t-.412-2.425t-1.163-2.1q-.3-.375-.312-.825t.312-.8t.788-.338t.762.363q1.05 1.275 1.663 2.838T23 9m-4.55 0q0 .8-.25 1.538t-.7 1.362q-.275.375-.737.388t-.813-.338q-.325-.325-.337-.787t.212-.888q.15-.275.238-.6T16.15 9t-.088-.675t-.237-.625q-.225-.425-.213-.875t.338-.775q.35-.35.813-.338t.737.388q.45.625.7 1.363T18.45 9M9 13q-1.65 0-2.825-1.175T5 9t1.175-2.825T9 5t2.825 1.175T13 9t-1.175 2.825T9 13m-8 6v-.8q0-.825.425-1.55t1.175-1.1q1.275-.65 2.875-1.1T9 14t3.525.45t2.875 1.1q.75.375 1.175 1.1T17 18.2v.8q0 .825-.587 1.413T15 21H3q-.825 0-1.412-.587T1 19" />
                                                            </svg>
                                                            {episode.voice
                                                                ? <span className={classes(episodeVoiceTextStyle)}>{buildEpisodeVoiceSummary(props.voiceOptions, episode.voice)}</span>
                                                                : null}
                                                        </span>}
                                                </button>
                                                <VoiceSelectorDialog
                                                    id={buildEpisodeVoiceDialogId(episode.episodeKey)}
                                                    value={episode.voice || ''}
                                                    options={buildEpisodeVoiceDialogOptions(props.voiceOptions, episode.voice)}
                                                    onSave={value => props.onEpisodeVoiceChange(episode.episodeKey, value)}
                                                />
                                            </td>
                                            <td className={classes([tdStyle, tdTranscriptStyle])}>
                                                {props.feedId != null
                                                    ? <>
                                                        <button
                                                            className={classes(transcriptButtonStyle)}
                                                            commandFor={buildEpisodeTranscriptDialogId(episode.episodeKey)}
                                                            command="show-modal"
                                                            type="button"
                                                            aria-label="View transcript"
                                                        >
                                                            View
                                                        </button>
                                                        <EpisodeTranscriptDialog
                                                            feedId={props.feedId}
                                                            feedTitle={props.draft.name || 'Unnamed Feed'}
                                                            episode={{ episodeKey: episode.episodeKey, title: episode.title }}
                                                        />
                                                    </>
                                                    : null}
                                            </td>
                                            <td className={classes([tdStyle, tdAudioStyle])}>
                                                {isPlayingEpisode && props.activeEpisodeAudioUrl ? (
                                                    <audio
                                                        autoPlay
                                                        className={classes(compactAudioStyle)}
                                                        controls
                                                        preload="none"
                                                        src={props.activeEpisodeAudioUrl}
                                                    />
                                                ) : (
                                                    <button
                                                        aria-label="Play episode"
                                                        className={classes(playButtonStyle)}
                                                        onClick={() => props.onPlayEpisode(episode)}
                                                        type="button"
                                                        title="Play audio"
                                                    >
                                                        ▶ Play
                                                    </button>
                                                )}
                                            </td>
                                            {isCustomFeed
                                                ? <td className={classes([tdStyle, tdActionsStyle])}>
                                                    <details className={classes(rowMenuStyle)}>
                                                        <summary
                                                            className={classes(rowMenuTriggerStyle)}
                                                            aria-label="Episode actions"
                                                            title="Episode actions"
                                                        >
                                                            <svg className={classes(rowMenuTriggerIconStyle)} viewBox="0 0 24 24" aria-hidden="true">
                                                                <path fill="currentColor" d="M12 7a1.75 1.75 0 1 1 0-3.5A1.75 1.75 0 0 1 12 7m0 7a1.75 1.75 0 1 1 0-3.5A1.75 1.75 0 0 1 12 14m0 7a1.75 1.75 0 1 1 0-3.5A1.75 1.75 0 0 1 12 21" />
                                                            </svg>
                                                        </summary>
                                                        <div className={classes(rowMenuPopoverStyle)}>
                                                            <button
                                                                className={classes(removeArticleMenuButtonStyle)}
                                                                disabled={props.removingEpisodeKey == episode.episodeKey || episode.status == 'generating'}
                                                                onClick={(event) => {
                                                                    props.onRemoveArticle(episode)
                                                                    event.currentTarget.closest('details')?.removeAttribute('open')
                                                                }}
                                                                title={episode.status == 'generating' ? 'Wait for generation to finish before removing this article' : 'Remove article'}
                                                                type="button"
                                                            >
                                                                {props.removingEpisodeKey == episode.episodeKey ? 'Removing...' : 'Remove article'}
                                                            </button>
                                                        </div>
                                                    </details>
                                                </td>
                                                : null}
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        )}
    </section>
}

function buildEpisodeVoiceDialogId(episodeKey: string) {
    return `episode-voice-${episodeKey}`
}

function buildEpisodeVoiceDialogOptions(options: VoiceOption[], selectedVoiceId: string | null) {
    let filtered = [...options]

    if (!filtered.some(option => option.id == ''))
        filtered.unshift({
            id: '',
            name: 'Default',
            description: 'Use feed voice',
            gender: 'unknown',
            provider: 'default'
        })

    if (selectedVoiceId && !filtered.some(option => option.id == selectedVoiceId))
        filtered.unshift({
            id: selectedVoiceId,
            name: 'Saved voice',
            description: 'Saved voice',
            gender: 'unknown',
            provider: 'saved'
        })

    return filtered
}

function buildEpisodeVoiceSummary(options: VoiceOption[], selectedVoiceId: string | null) {
    if (!selectedVoiceId)
        return ''

    let selected = options.find(option => option.id == selectedVoiceId)
    if (!selected)
        return 'Saved voice'

    return selected.name
}

function buildEpisodeVoiceAriaLabel(options: VoiceOption[], selectedVoiceId: string | null, isSaving: boolean) {
    if (isSaving)
        return 'Saving voice'

    if (!selectedVoiceId)
        return 'Choose episode voice (currently default)'

    let selected = options.find(option => option.id == selectedVoiceId)
    if (!selected)
        return 'Choose episode voice (currently saved voice)'

    return `Choose episode voice (currently ${selected.name})`
}

function buildEpisodeProgressLabel(episode: Episode) {
    let progressPercent = Math.min(100, Math.max(0, episode.progressPercent || 0))

    if (episode.progressMode == 'chunk' && episode.chunksTotal > 0)
        return `${progressPercent}% · Chunk ${Math.min(episode.chunksProcessed, episode.chunksTotal)}/${episode.chunksTotal}`

    if (episode.progressMode == 'estimated') {
        let remaining = formatSeconds(episode.estimatedSecondsRemaining)
        if (remaining)
            return `${progressPercent}% · ${remaining} left (est.)`

        return `${progressPercent}% (est.)`
    }

    return `${progressPercent}%`
}

function buildEpisodeDurationLabel(episode: Episode) {
    if (episode.durationSeconds == null)
        return '—'

    let formatted = formatSeconds(episode.durationSeconds)
    if (!formatted)
        return '—'

    return episode.isDurationEstimated ? `~${formatted}` : formatted
}

function formatSeconds(value: number) {
    if (!Number.isFinite(value) || value <= 0)
        return ''

    let totalSeconds = Math.floor(value)
    let hours = Math.floor(totalSeconds / 3600)
    let minutes = Math.floor(totalSeconds / 60)
    let seconds = totalSeconds % 60

    if (hours > 0)
        return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

    return `${minutes}:${String(seconds).padStart(2, '0')}`

    return `${minutes}m ${seconds}s`
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

let panelStyle = style('panel', {
    backgroundColor: 'var(--panel)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    overflow: 'hidden'
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

let episodesAreaStyle = style('episodesArea', {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    backgroundColor: 'var(--panel)'
})

let customArticleBarStyle = style('customArticleBar', {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
    backgroundColor: 'var(--bg)',
    flexWrap: 'wrap'
})

let customArticleInfoStyle = style('customArticleInfo', {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minWidth: 0
})

let customArticleHintStyle = style('customArticleHint', {
    fontSize: 13,
    color: 'var(--muted)'
})

let customArticleFormStyle = style('customArticleForm', {
    display: 'grid',
    gridTemplateColumns: 'minmax(280px, 1fr) auto',
    gap: 12,
    alignItems: 'center',
    flex: 1,
    minWidth: 'min(100%, 420px)'
})

let episodesListContainerStyle = style('episodesListContainer', {
    flex: 1,
    overflow: 'auto',
    padding: 0
})

let episodesTableStyle = style('table', {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    tableLayout: 'auto',
    minWidth: 900
})

let emptyEpisodesStyle = style('emptyEpisodes', {
    padding: 40,
    textAlign: 'center',
    color: 'var(--muted)',
    fontSize: 14
})

let thStyle = style('th', {
    padding: '10px 20px',
    borderBottom: '1px solid var(--border)',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--muted)',
    position: 'sticky',
    top: 0,
    backgroundColor: 'var(--bg)',
    zIndex: 1
})

let thTitleStyle = style('thTitle', {
    width: '45%'
})

let thDateStyle = style('thDate', {
    width: '15%'
})

let thDurationStyle = style('thDuration', {
    width: 110
})

let thStatusStyle = style('thStatus', {
    width: 180
})

let thVoiceStyle = style('thVoice', {
    width: 180
})

let thTranscriptStyle = style('thTranscript', {
    width: 120,
    textAlign: 'center'
})

let thAudioStyle = style('thAudio', {
    width: '240px',
    textAlign: 'right'
})

let thActionsStyle = style('thActions', {
    width: 120,
    textAlign: 'right'
})

let trStyle = style('tr', {
    borderBottom: '1px solid var(--border)',
    $: {
        '&:hover': {
            backgroundColor: 'var(--bg)'
        }
    }
})

let activeTrStyle = style('activeTr', {
    backgroundColor: 'color-mix(in srgb, var(--accent) 5%, transparent)',
    $: {
        '&:hover': {
            backgroundColor: 'color-mix(in srgb, var(--accent) 8%, transparent)'
        }
    }
})

let tdStyle = style('td', {
    padding: '12px 20px',
    fontSize: 13,
    verticalAlign: 'middle',
    color: 'var(--text)'
})

let tdTitleStyle = style('tdTitle', {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
})

let tdDateStyle = style('tdDate', {
    color: 'var(--muted)'
})

let tdDurationStyle = style('tdDuration', {
    color: 'var(--muted)',
    whiteSpace: 'nowrap'
})

let tdVoiceStyle = style('tdVoice', {
    minWidth: 0
})

let tdTranscriptStyle = style('tdTranscript', {
    textAlign: 'center'
})

let transcriptButtonStyle = style('transcriptButton', {
    border: '1px solid var(--border)',
    backgroundColor: 'var(--panel)',
    color: 'var(--text)',
    padding: '4px 10px',
    borderRadius: 14,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.1s',
    $: {
        '&:hover': {
            borderColor: 'var(--accent)',
            color: 'var(--accent)'
        }
    }
})

let tdAudioStyle = style('tdAudio', {
    textAlign: 'right'
})

let tdActionsStyle = style('tdActions', {
    textAlign: 'right',
    whiteSpace: 'nowrap',
    position: 'relative'
})

let rowMenuStyle = style('rowMenu', {
    position: 'relative',
    display: 'inline-block'
})

let rowMenuTriggerStyle = style('rowMenuTrigger', {
    listStyle: 'none',
    width: 30,
    height: 30,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid var(--border)',
    borderRadius: 999,
    backgroundColor: 'var(--panel)',
    color: 'var(--muted)',
    cursor: 'pointer',
    transition: 'all 0.1s',
    $: {
        '&::-webkit-details-marker': {
            display: 'none'
        },
        '&:hover': {
            borderColor: 'var(--accent)',
            color: 'var(--accent)'
        }
    }
})

let rowMenuTriggerIconStyle = style('rowMenuTriggerIcon', {
    width: 16,
    height: 16,
    display: 'block'
})

let rowMenuPopoverStyle = style('rowMenuPopover', {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    minWidth: 160,
    padding: 6,
    borderRadius: 12,
    border: '1px solid color-mix(in srgb, var(--border) 90%, transparent)',
    backgroundColor: 'color-mix(in srgb, var(--panel) 94%, white)',
    boxShadow: '0 14px 32px rgba(15, 23, 42, 0.14)',
    zIndex: 3,
    backdropFilter: 'blur(10px)'
})

let episodeVoiceButtonStyle = style('episodeVoiceButton', {
    display: 'flex',
    alignItems: 'center',
    maxWidth: '100%',
    padding: '6px 10px',
    border: '1px solid var(--border)',
    borderRadius: 6,
    backgroundColor: 'var(--bg)',
    color: 'var(--text)',
    fontSize: 12,
    minHeight: 30,
    textAlign: 'left',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
})

let episodeVoiceButtonInnerStyle = style('episodeVoiceButtonInner', {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%'
})

let episodeVoiceButtonIconOnlyStyle = style('episodeVoiceButtonIconOnly', {
    width: '100%',
    justifyContent: 'center'
})

let episodeVoiceIconStyle = style('episodeVoiceIcon', {
    width: 18,
    height: 18,
    display: 'block',
    lineHeight: 0,
    transform: 'translateY(-0.5px)',
    flexShrink: 0
})

let episodeVoiceTextStyle = style('episodeVoiceText', {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
})

let episodeTitleTextStyle = style('episodeTitle', {
    fontWeight: 500,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
})

let episodeErrorTextStyle = style('episodeError', {
    color: 'var(--danger)',
    fontSize: 12,
    marginTop: 4,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
})

let statusBadgeStyle = style('statusBadge', {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 600,
    backgroundColor: 'color-mix(in srgb, var(--muted) 15%, transparent)',
    color: 'var(--text)',
    textTransform: 'uppercase'
})

let completedBadgeStyle = style('completedBadge', {
    backgroundColor: 'color-mix(in srgb, #10b981 15%, transparent)',
    color: '#10b981'
})

let progressStatusStyle = style('progressStatus', {
    width: '100%',
    minWidth: 120,
    maxWidth: 170,
    display: 'flex',
    flexDirection: 'column',
    gap: 5
})

let progressTrackStyle = style('progressTrack', {
    width: '100%',
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'color-mix(in srgb, var(--muted) 20%, transparent)'
})

let progressFillStyle = style('progressFill', {
    height: '100%',
    borderRadius: 999,
    backgroundColor: 'var(--accent)',
    transition: 'width 0.3s ease'
})

let progressMetaStyle = style('progressMeta', {
    fontSize: 11,
    color: 'var(--muted)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
})

let playButtonStyle = style('playButton', {
    border: '1px solid var(--border)',
    backgroundColor: 'var(--panel)',
    color: 'var(--text)',
    padding: '4px 10px',
    borderRadius: 14,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    transition: 'all 0.1s',
    $: {
        '&:hover': {
            borderColor: 'var(--accent)',
            color: 'var(--accent)'
        }
    }
})

let removeArticleMenuButtonStyle = style('removeArticleMenuButton', {
    width: '100%',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--danger)',
    padding: '8px 10px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.1s',
    $: {
        '&:hover': {
            backgroundColor: 'color-mix(in srgb, var(--danger) 10%, var(--panel))'
        },
        '&:disabled': {
            opacity: 0.55,
            cursor: 'not-allowed'
        }
    }
})

let compactAudioStyle = style('compactAudio', {
    height: 32,
    width: '100%',
    maxWidth: 200,
    display: 'inline-block',
    verticalAlign: 'middle'
})

let noAudioTextStyle = style('noAudio', {
    fontSize: 12,
    color: 'var(--muted)',
    fontStyle: 'italic'
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











