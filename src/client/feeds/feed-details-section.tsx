import { type ChangeEvent, Fragment, useEffect, useMemo, useState } from "react"
import { classes, style } from "stylemap"
import type { Feed } from "../../server/db/schema"
import { api } from "../api"
import { buildEpisodeTranscriptDialogId, EpisodeTranscriptDialog } from "./episode-transcript-dialog"
import { VoiceSelectorDialog } from "./voice-selector-dialog"
import { VoiceSelectorField, type VoiceOption } from "./voice-selector-field"

export type FeedDraft = {
    name: string
    rssUrl: string
    voice: string
    generationMode: string
    showArchivedEpisodes: boolean
    contentSource: string
}

type Episode = {
    episodeKey: string
    title: string
    sourceUrl: string
    publishedAt: string | null
    durationSeconds: number | null
    isDurationEstimated: boolean
    archived: boolean
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
    feed: Feed | null
    onCancel: () => void
    onDelete: () => void
    onSave: (draft: FeedDraft) => Promise<void>
    voiceOptions: VoiceOption[]
}) {
    let isEditing = props.feed != null
    let feedId = props.feed?.id ?? null
    let [draft, setDraft] = useState(() => buildInitialDraft(props.feed, props.voiceOptions))
    let [error, setError] = useState('')
    let [status, setStatus] = useState('')
    let [podcastUrl, setPodcastUrl] = useState('')
    let [episodes, setEpisodes] = useState<Episode[]>([])
    let [selectedEpisodeKey, setSelectedEpisodeKey] = useState<string | null>(null)
    let [activeEpisodeKey, setActiveEpisodeKey] = useState<string | null>(null)
    let [activeEpisodeAudioUrl, setActiveEpisodeAudioUrl] = useState('')
    let [isAddingArticle, setIsAddingArticle] = useState(false)
    let [removingEpisodeKey, setRemovingEpisodeKey] = useState<string | null>(null)
    let [updatingEpisodeVoiceKey, setUpdatingEpisodeVoiceKey] = useState<string | null>(null)
    let [updatingEpisodeArchiveKey, setUpdatingEpisodeArchiveKey] = useState<string | null>(null)
    let [isSettingsExpanded, setIsSettingsExpanded] = useState(!isEditing)
    let [articleUrl, setArticleUrl] = useState('')
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
        setArticleUrl('')
    }, [feedId, draft.contentSource])

    useEffect(() => {
        setDraft(buildInitialDraft(props.feed, props.voiceOptions))
        setError('')
        setStatus('')
        setPodcastUrl('')
        setEpisodes([])
        setSelectedEpisodeKey(null)
        setActiveEpisodeKey(null)
        setActiveEpisodeAudioUrl('')
        setIsAddingArticle(false)
        setRemovingEpisodeKey(null)
        setUpdatingEpisodeVoiceKey(null)
        setUpdatingEpisodeArchiveKey(null)
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

    useEffect(() => {
        setSelectedEpisodeKey(null)
        setActiveEpisodeKey(null)
        setActiveEpisodeAudioUrl('')

        if (feedId != null)
            void loadEpisodes(feedId)
        else {
            setPodcastUrl('')
            setEpisodes([])
        }
    }, [feedId])

    useEffect(() => {
        if (selectedEpisodeKey && !episodes.some(episode => episode.episodeKey == selectedEpisodeKey))
            setSelectedEpisodeKey(null)

        if (activeEpisodeKey && !episodes.some(episode => episode.episodeKey == activeEpisodeKey)) {
            setActiveEpisodeKey(null)
            setActiveEpisodeAudioUrl('')
        }
    }, [episodes, selectedEpisodeKey, activeEpisodeKey])

    useEffect(() => {
        if (draft.showArchivedEpisodes || !selectedEpisodeKey)
            return

        let selectedEpisode = episodes.find(episode => episode.episodeKey == selectedEpisodeKey)
        if (!selectedEpisode?.archived)
            return

        setSelectedEpisodeKey(null)

        if (activeEpisodeKey == selectedEpisodeKey) {
            setActiveEpisodeKey(null)
            setActiveEpisodeAudioUrl('')
        }
    }, [draft.showArchivedEpisodes, episodes, selectedEpisodeKey, activeEpisodeKey])

    useEffect(() => {
        if (feedId == null)
            return

        if (!episodes.some(episode => episode.status == 'generating' || episode.status == 'queued'))
            return

        let timer = setInterval(() => {
            void loadEpisodes(feedId)
        }, 5000)

        return () => {
            clearInterval(timer)
        }
    }, [feedId, episodes])

    let visibleEpisodes = episodes.filter(episode => draft.showArchivedEpisodes || !episode.archived)
    let sortedEpisodes = [...visibleEpisodes].sort((a, b) => {
        if (!a.publishedAt) return 1
        if (!b.publishedAt) return -1
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    })
    let summaryColumnCount = isCustomFeed ? 5 : 4

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
                                disabled={!articleUrl.trim() || isAddingArticle}
                                onClick={async () => {
                                    let value = articleUrl.trim()
                                    if (!value || isAddingArticle)
                                        return

                                    await addArticleToFeed(value)
                                    setArticleUrl('')
                                }}
                                type="button"
                            >
                                {isAddingArticle ? 'Adding...' : 'Add article'}
                            </button>
                        </div>
                    </div>
                    : null}

                <div className={classes(episodesListContainerStyle)}>
                    {sortedEpisodes.length === 0 ? (
                        <div className={classes(emptyEpisodesStyle)}>
                            {episodes.length > 0 && !draft.showArchivedEpisodes
                                ? 'Only archived episodes remain. Enable "Show archived episodes" in settings to review them.'
                                : isCustomFeed
                                    ? 'No articles yet. Add a URL to create the first episode.'
                                    : 'No episodes discovered yet.'}
                        </div>
                    ) : (
                        <table className={classes(episodesTableStyle)}>
                            <thead>
                                <tr>
                                    <th className={classes([thStyle, thTitleStyle])}>Episode Title</th>
                                    <th className={classes([thStyle, thDateStyle])}>Published</th>
                                    <th className={classes([thStyle, thDurationStyle])}>Length</th>
                                    <th className={classes([thStyle, thStatusStyle])}>Status</th>
                                    {isCustomFeed ? <th className={classes([thStyle, thActionsStyle])}>Actions</th> : null}
                                </tr>
                            </thead>
                            <tbody>
                                {sortedEpisodes.map(episode => {
                                    let isPlayingEpisode = activeEpisodeKey == episode.episodeKey
                                    let isSelectedEpisode = selectedEpisodeKey == episode.episodeKey
                                    let isGeneratingEpisode = episode.status == 'generating' || episode.status == 'queued'
                                    let isUpdatingArchive = updatingEpisodeArchiveKey == episode.episodeKey

                                    let dateStr = ''
                                    if (episode.publishedAt) {
                                        dateStr = new Date(episode.publishedAt).toLocaleDateString(undefined, {
                                            month: 'short', day: 'numeric', year: 'numeric'
                                        })
                                    }

                                    return <Fragment key={episode.episodeKey}>
                                        <tr
                                            aria-expanded={isSelectedEpisode}
                                            className={classes([trStyle, episode.archived && archivedTrStyle, isSelectedEpisode && activeTrStyle])}
                                            onClick={() => setSelectedEpisodeKey(current => current == episode.episodeKey ? null : episode.episodeKey)}
                                            onKeyDown={event => {
                                                if (event.key == 'Enter' || event.key == ' ') {
                                                    event.preventDefault()
                                                    setSelectedEpisodeKey(current => current == episode.episodeKey ? null : episode.episodeKey)
                                                }
                                            }}
                                            tabIndex={0}
                                        >
                                            <td className={classes([tdStyle, tdTitleStyle])}>
                                                <div className={classes(episodeRowSummaryStyle)}>
                                                    <span className={classes([episodeExpandIconStyle, isSelectedEpisode && episodeExpandIconOpenStyle])} aria-hidden="true">
                                                        <svg className={classes(episodeExpandIconGlyphStyle)} viewBox="0 0 20 20">
                                                            <path d="M7 4l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                                                        </svg>
                                                    </span>
                                                    <div className={classes(episodeRowTextStyle)}>
                                                        <div className={classes(episodeTitleRowStyle)}>
                                                            <div className={classes(episodeTitleTextStyle)} title={episode.title}>{episode.title}</div>
                                                            {episode.archived ? <span className={classes(archivedBadgeStyle)}>Archived</span> : null}
                                                        </div>
                                                        {episode.errorMessage ? <div className={classes(episodeErrorTextStyle)}>{episode.errorMessage}</div> : null}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className={classes([tdStyle, tdDateStyle])}>{dateStr || '—'}</td>
                                            <td className={classes([tdStyle, tdDurationStyle])}>{buildEpisodeDurationLabel(episode)}</td>
                                            <td className={classes(tdStyle)}>
                                                {episode.status == 'generating'
                                                    ? <div className={classes(progressStatusStyle)}>
                                                        <div className={classes(progressTrackStyle)}>
                                                            <div
                                                                className={classes(progressFillStyle)}
                                                                style={{ width: `${Math.min(100, Math.max(0, episode.progressPercent))}%` }}
                                                            />
                                                        </div>
                                                        <div className={classes(progressMetaStyle)}>{buildEpisodeProgressLabel(episode)}</div>
                                                    </div>
                                                    : <span className={classes([statusBadgeStyle, episode.status == 'ready' && completedBadgeStyle])}>
                                                        {episode.status.replace('_', ' ')}
                                                    </span>}
                                            </td>
                                            {isCustomFeed
                                                ? <td className={classes([tdStyle, tdActionsStyle])} onClick={event => event.stopPropagation()}>
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
                                                                disabled={removingEpisodeKey == episode.episodeKey || episode.status == 'generating'}
                                                                onClick={(event) => {
                                                                    void removeArticleFromFeed(episode)
                                                                    event.currentTarget.closest('details')?.removeAttribute('open')
                                                                }}
                                                                title={episode.status == 'generating' ? 'Wait for generation to finish before removing this article' : 'Remove article'}
                                                                type="button"
                                                            >
                                                                {removingEpisodeKey == episode.episodeKey ? 'Removing...' : 'Remove article'}
                                                            </button>
                                                        </div>
                                                    </details>
                                                </td>
                                                : null}
                                        </tr>
                                        {isSelectedEpisode
                                            ? <tr className={classes(expandedTrStyle)}>
                                                <td className={classes(expandedTdStyle)} colSpan={summaryColumnCount}>
                                                    <div className={classes(episodeExpandedPanelStyle)}>
                                                        <div className={classes(episodeExpandedHeaderStyle)}>
                                                            <div className={classes(episodeExpandedTitleBlockStyle)}>
                                                                <span className={classes(episodeExpandedEyebrowStyle)}>Episode details</span>
                                                                <div className={classes(episodeExpandedTitleStyle)}>{episode.title}</div>
                                                            </div>
                                                            <div className={classes(episodeMetaListStyle)}>
                                                                <span className={classes(episodeMetaPillStyle)}>{dateStr || 'Unpublished'}</span>
                                                                <span className={classes(episodeMetaPillStyle)}>{buildEpisodeDurationLabel(episode)}</span>
                                                                <span className={classes([statusBadgeStyle, episode.status == 'ready' && completedBadgeStyle])}>
                                                                    {episode.status.replace('_', ' ')}
                                                                </span>
                                                                {episode.archived ? <span className={classes(archivedBadgeStyle)}>Archived</span> : null}
                                                                {isPlayingEpisode ? <span className={classes(episodePlayingPillStyle)}>Now playing</span> : null}
                                                            </div>
                                                        </div>

                                                        {episode.sourceUrl
                                                            ? <a className={classes(episodeSourceLinkStyle)} href={episode.sourceUrl} rel="noreferrer" target="_blank">
                                                                Open source article
                                                            </a>
                                                            : null}

                                                        <div className={classes(episodeControlRowStyle)}>
                                                            <div className={classes(episodeControlItemStyle)}>
                                                                <span className={classes(episodeControlLabelStyle)}>Voice</span>
                                                                <button
                                                                    className={classes([episodeVoiceButtonStyle, episodeVoiceButtonCompactStyle])}
                                                                    commandFor={buildEpisodeVoiceDialogId(episode.episodeKey)}
                                                                    command="show-modal"
                                                                    disabled={updatingEpisodeVoiceKey == episode.episodeKey}
                                                                    aria-label={buildEpisodeVoiceAriaLabel(resolvedVoiceOptions, episode.voice, updatingEpisodeVoiceKey == episode.episodeKey)}
                                                                    type="button"
                                                                >
                                                                    {updatingEpisodeVoiceKey == episode.episodeKey
                                                                        ? 'Saving...'
                                                                        : <span className={classes(episodeVoiceButtonInnerStyle)}>
                                                                            <svg className={classes(episodeVoiceIconStyle)} viewBox="0 0 24 24" aria-hidden="true">
                                                                                <path fill="currentColor" d="M23 9q0 1.725-.612 3.288t-1.663 2.837q-.3.35-.75.375t-.8-.325q-.325-.325-.3-.775t.3-.825q.75-.95 1.163-2.125T20.75 9t-.412-2.425t-1.163-2.1q-.3-.375-.312-.825t.312-.8t.788-.338t.762.363q1.05 1.275 1.663 2.838T23 9m-4.55 0q0 .8-.25 1.538t-.7 1.362q-.275.375-.737.388t-.813-.338q-.325-.325-.337-.787t.212-.888q.15-.275.238-.6T16.15 9t-.088-.675t-.237-.625q-.225-.425-.213-.875t.338-.775q.35-.35.813-.338t.737.388q.45.625.7 1.363T18.45 9M9 13q-1.65 0-2.825-1.175T5 9t1.175-2.825T9 5t2.825 1.175T13 9t-1.175 2.825T9 13m-8 6v-.8q0-.825.425-1.55t1.175-1.1q1.275-.65 2.875-1.1T9 14t3.525.45t2.875 1.1q.75.375 1.175 1.1T17 18.2v.8q0 .825-.587 1.413T15 21H3q-.825 0-1.412-.587T1 19" />
                                                                            </svg>
                                                                            <span className={classes(episodeVoiceTextStyle)}>{buildEpisodeVoiceSummary(resolvedVoiceOptions, episode.voice) || 'Feed default'}</span>
                                                                        </span>}
                                                                </button>
                                                                <VoiceSelectorDialog
                                                                    id={buildEpisodeVoiceDialogId(episode.episodeKey)}
                                                                    value={episode.voice || ''}
                                                                    options={buildEpisodeVoiceDialogOptions(resolvedVoiceOptions, episode.voice)}
                                                                    onSave={value => updateEpisodeVoice(episode.episodeKey, value)}
                                                                />
                                                            </div>

                                                            <div className={classes(episodeControlItemStyle)}>
                                                                <span className={classes(episodeControlLabelStyle)}>Transcript</span>
                                                                {feedId != null
                                                                    ? <>
                                                                        <button
                                                                            className={classes([transcriptButtonStyle, transcriptButtonCompactStyle])}
                                                                            commandFor={buildEpisodeTranscriptDialogId(episode.episodeKey)}
                                                                            command="show-modal"
                                                                            type="button"
                                                                            aria-label="Open transcript"
                                                                        >
                                                                            Open transcript
                                                                        </button>
                                                                        <EpisodeTranscriptDialog
                                                                            feedId={feedId}
                                                                            feedTitle={draft.name || 'Unnamed Feed'}
                                                                            episode={{ episodeKey: episode.episodeKey, title: episode.title }}
                                                                        />
                                                                    </>
                                                                    : null}
                                                            </div>

                                                            <div className={classes(episodeControlItemStyle)}>
                                                                <span className={classes(episodeControlLabelStyle)}>Visibility</span>
                                                                <button
                                                                    className={classes([playButtonStyle, detailActionButtonStyle, episodeActionCompactStyle, episode.archived ? restoreEpisodeButtonStyle : archiveEpisodeButtonStyle])}
                                                                    disabled={isUpdatingArchive}
                                                                    onClick={() => void updateEpisodeArchived(episode.episodeKey, !episode.archived)}
                                                                    type="button"
                                                                >
                                                                    {isUpdatingArchive
                                                                        ? (episode.archived ? 'Restoring...' : 'Archiving...')
                                                                        : episode.archived ? 'Unarchive episode' : 'Archive episode'}
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div className={classes(episodeDetailGridStyle)}>

                                                            <div className={classes([episodeDetailCardStyle, episodeDetailAudioCardStyle])}>
                                                                <span className={classes(episodeDetailLabelStyle)}>Audio</span>
                                                                <div className={classes(episodeDetailAudioContentStyle)}>
                                                                    {isPlayingEpisode && activeEpisodeAudioUrl ? (
                                                                        <audio
                                                                            autoPlay
                                                                            className={classes(expandedAudioStyle)}
                                                                            controls
                                                                            preload="none"
                                                                            src={activeEpisodeAudioUrl}
                                                                        />
                                                                    ) : isGeneratingEpisode ? (
                                                                        <button
                                                                            aria-label="Cancel audio generation"
                                                                            className={classes([playButtonStyle, detailActionButtonStyle, cancelAudioButtonStyle])}
                                                                            onClick={() => void cancelEpisodeAudioGeneration(episode)}
                                                                            type="button"
                                                                            title="Cancel generation"
                                                                        >
                                                                            Cancel generation
                                                                        </button>
                                                                    ) : episode.audioReady ? (
                                                                        <button
                                                                            aria-label="Play episode"
                                                                            className={classes([playButtonStyle, detailActionButtonStyle])}
                                                                            onClick={() => playEpisode(episode)}
                                                                            type="button"
                                                                            title="Play audio"
                                                                        >
                                                                            Play episode
                                                                        </button>
                                                                    ) : (
                                                                        <button
                                                                            aria-label="Generate audio"
                                                                            className={classes([playButtonStyle, detailActionButtonStyle, generateAudioButtonStyle])}
                                                                            onClick={() => void generateEpisodeAudio(episode)}
                                                                            type="button"
                                                                            title="Generate audio"
                                                                        >
                                                                            Generate audio
                                                                        </button>
                                                                    )}
                                                                </div>
                                                                <span className={classes(episodeDetailHintStyle)}>
                                                                    {isGeneratingEpisode
                                                                        ? buildEpisodeProgressLabel(episode)
                                                                        : episode.audioReady
                                                                            ? (isPlayingEpisode ? 'Playback is active for this episode.' : 'Audio is ready to play.')
                                                                            : 'Generate narrated audio for this episode.'}
                                                                </span>
                                                            </div>

                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                            : null}
                                    </Fragment>
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
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

            if (feedId != null)
                await loadEpisodes(feedId)
        }
        catch (cause) {
            let message = cause instanceof Error ? cause.message : 'Failed to save feed'
            setError(message)
        }
    }

    async function addArticleToFeed(url: string) {
        if (feedId == null || !props.feed)
            return

        setError('')
        setStatus('')
        setIsAddingArticle(true)

        try {
            await api.feeds.addArticle.mutate({ id: feedId, url })
            setStatus(props.feed.generationMode == 'every_episode' ? 'Article added and generation started' : 'Article added')
            await loadEpisodes(feedId)
        }
        catch (cause) {
            let message = cause instanceof Error ? cause.message : 'Failed to add article'
            setError(message)
            throw cause
        }
        finally {
            setIsAddingArticle(false)
        }
    }

    async function removeArticleFromFeed(episode: Episode) {
        if (feedId == null || !props.feed)
            return

        let confirmed = window.confirm(`Remove "${episode.title}" from "${props.feed.name || 'Untitled Feed'}"?`)
        if (!confirmed)
            return

        setError('')
        setStatus('')
        setRemovingEpisodeKey(episode.episodeKey)

        try {
            await api.feeds.removeArticle.mutate({ id: feedId, episodeKey: episode.episodeKey })

            if (activeEpisodeKey == episode.episodeKey) {
                setActiveEpisodeKey(null)
                setActiveEpisodeAudioUrl('')
            }

            if (selectedEpisodeKey == episode.episodeKey)
                setSelectedEpisodeKey(null)

            setStatus('Article removed')
            await loadEpisodes(feedId)
        }
        catch (cause) {
            let message = cause instanceof Error ? cause.message : 'Failed to remove article'
            setError(message)
        }
        finally {
            setRemovingEpisodeKey(null)
        }
    }

    async function generateEpisodeAudio(episode: Episode) {
        if (feedId == null || episode.audioReady || episode.status == 'generating' || episode.status == 'queued')
            return

        setError('')
        setStatus('')
        setEpisodes(current => current.map(entry => entry.episodeKey == episode.episodeKey
            ? {
                ...entry,
                status: 'queued',
                errorMessage: null,
                progressPercent: 0,
                progressMode: 'none',
                chunksProcessed: 0,
                chunksTotal: 0,
                estimatedSecondsRemaining: 0
            }
            : entry
        ))

        try {
            await api.feeds.generateEpisode.mutate({ id: feedId, episodeKey: episode.episodeKey })
            await loadEpisodes(feedId)
        }
        catch (cause) {
            let message = cause instanceof Error ? cause.message : 'Failed to generate audio'
            setError(message)
            await loadEpisodes(feedId)
        }
    }

    async function cancelEpisodeAudioGeneration(episode: Episode) {
        if (feedId == null || (episode.status != 'generating' && episode.status != 'queued'))
            return

        setError('')
        setStatus('')
        setEpisodes(current => current.map(entry => entry.episodeKey == episode.episodeKey
            ? {
                ...entry,
                status: 'pending',
                errorMessage: null,
                progressPercent: 0,
                progressMode: 'none',
                chunksProcessed: 0,
                chunksTotal: 0,
                estimatedSecondsRemaining: 0
            }
            : entry
        ))

        try {
            await api.feeds.cancelEpisode.mutate({ id: feedId, episodeKey: episode.episodeKey })
            await loadEpisodes(feedId)
        }
        catch (cause) {
            let message = cause instanceof Error ? cause.message : 'Failed to cancel audio generation'
            setError(message)
            await loadEpisodes(feedId)
        }
    }

    async function updateEpisodeVoice(episodeKey: string, voice: string) {
        if (feedId == null || !props.feed)
            return

        setError('')
        setStatus('')
        setUpdatingEpisodeVoiceKey(episodeKey)

        try {
            await api.feeds.setEpisodeVoice.mutate({ id: feedId, episodeKey, voice })
            setStatus(voice ? 'Episode voice updated' : 'Episode voice reset to feed default')

            if (activeEpisodeKey == episodeKey)
                setActiveEpisodeAudioUrl(`${window.location.origin}/feed/${props.feed.podcastSlug}/${episodeKey}?v=${Date.now()}`)

            await loadEpisodes(feedId)
        }
        catch (cause) {
            let message = cause instanceof Error ? cause.message : 'Failed to update episode voice'
            setError(message)
        }
        finally {
            setUpdatingEpisodeVoiceKey(null)
        }
    }

    async function updateEpisodeArchived(episodeKey: string, archived: boolean) {
        if (feedId == null || !props.feed)
            return

        setError('')
        setStatus('')
        setUpdatingEpisodeArchiveKey(episodeKey)

        try {
            await api.feeds.setEpisodeArchive.mutate({ id: feedId, episodeKey, archived })
            setStatus(archived ? 'Episode archived' : 'Episode restored')

            if (archived && !draft.showArchivedEpisodes) {
                if (selectedEpisodeKey == episodeKey)
                    setSelectedEpisodeKey(null)

                if (activeEpisodeKey == episodeKey) {
                    setActiveEpisodeKey(null)
                    setActiveEpisodeAudioUrl('')
                }
            }

            await loadEpisodes(feedId)
        }
        catch (cause) {
            let message = cause instanceof Error ? cause.message : 'Failed to update archived state'
            setError(message)
        }
        finally {
            setUpdatingEpisodeArchiveKey(null)
        }
    }

    function playEpisode(episode: Episode) {
        setSelectedEpisodeKey(episode.episodeKey)
        setActiveEpisodeKey(episode.episodeKey)
        setActiveEpisodeAudioUrl(episode.audioUrl)
    }

    async function loadEpisodes(nextFeedId: number) {
        try {
            let response = await api.feeds.episodes.query({ id: nextFeedId })
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

let episodesAreaStyle = style('episodesArea', {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    backgroundColor: 'var(--panel)',
    $: {
        '@media (max-width: 920px)': {
            flex: 'none',
            minHeight: 'fit-content'
        }
    }
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
    padding: 0,
    $: {
        '@media (max-width: 920px)': {
            overflow: 'visible'
        }
    }
})

let episodesTableStyle = style('table', {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    tableLayout: 'auto',
    minWidth: 620
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
    cursor: 'pointer',
    outline: 'none',
    $: {
        '&:focus-visible': {
            boxShadow: 'inset 0 0 0 2px color-mix(in srgb, var(--accent) 45%, transparent)'
        },
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

let archivedTrStyle = style('archivedTr', {
    opacity: 0.82
})

let tdStyle = style('td', {
    padding: '12px 20px',
    fontSize: 13,
    verticalAlign: 'middle',
    color: 'var(--text)'
})

let tdTitleStyle = style('tdTitle', {
    minWidth: 0
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

let transcriptButtonExpandedStyle = style('transcriptButtonExpanded', {
    width: '100%',
    minHeight: 38,
    borderRadius: 10,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center'
})

let transcriptButtonCompactStyle = style('transcriptButtonCompact', {
    width: '100%',
    minHeight: 34,
    borderRadius: 8,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center'
})

let tdAudioStyle = style('tdAudio', {
    textAlign: 'right'
})

let tdActionsStyle = style('tdActions', {
    textAlign: 'right',
    whiteSpace: 'nowrap',
    position: 'relative'
})

let expandedTrStyle = style('expandedTr', {
    backgroundColor: 'color-mix(in srgb, var(--accent) 3%, var(--panel))'
})

let expandedTdStyle = style('expandedTd', {
    padding: 0,
    borderBottom: '1px solid var(--border)'
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

let episodeVoiceButtonExpandedStyle = style('episodeVoiceButtonExpanded', {
    width: '100%',
    minHeight: 38,
    padding: '8px 12px',
    backgroundColor: 'var(--panel)'
})

let episodeVoiceButtonCompactStyle = style('episodeVoiceButtonCompact', {
    minWidth: 0,
    width: '100%',
    minHeight: 34,
    padding: '6px 10px',
    backgroundColor: 'var(--panel)'
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

let episodeTitleRowStyle = style('episodeTitleRow', {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0
})

let episodeRowSummaryStyle = style('episodeRowSummary', {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    minWidth: 0
})

let episodeRowTextStyle = style('episodeRowText', {
    minWidth: 0,
    flex: 1
})

let episodeExpandIconStyle = style('episodeExpandIcon', {
    width: 22,
    height: 22,
    borderRadius: 999,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--muted)',
    backgroundColor: 'color-mix(in srgb, var(--bg) 88%, white)',
    border: '1px solid color-mix(in srgb, var(--border) 88%, transparent)',
    flexShrink: 0,
    marginTop: 1,
    transition: 'transform 0.15s ease, color 0.15s ease, border-color 0.15s ease'
})

let episodeExpandIconOpenStyle = style('episodeExpandIconOpen', {
    color: 'var(--accent)',
    borderColor: 'color-mix(in srgb, var(--accent) 35%, var(--border))',
    transform: 'rotate(90deg)'
})

let episodeExpandIconGlyphStyle = style('episodeExpandIconGlyph', {
    width: 14,
    height: 14,
    display: 'block'
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

let archivedBadgeStyle = style('archivedBadge', {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 9px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
    color: '#92400e',
    backgroundColor: 'color-mix(in srgb, #f59e0b 18%, white)'
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
    whiteSpace: 'nowrap',
    transition: 'all 0.1s',
    $: {
        '&:hover': {
            borderColor: 'var(--accent)',
            color: 'var(--accent)'
        }
    }
})

let detailActionButtonStyle = style('detailActionButton', {
    minHeight: 40,
    borderRadius: 10,
    justifyContent: 'center',
    padding: '8px 14px'
})

let episodeActionCompactStyle = style('episodeActionCompact', {
    width: '100%',
    minHeight: 34,
    borderRadius: 8,
    padding: '6px 10px'
})

let generateAudioButtonStyle = style('generateAudioButton', {
    borderColor: 'color-mix(in srgb, var(--accent) 45%, var(--border))',
    color: 'var(--accent)'
})

let cancelAudioButtonStyle = style('cancelAudioButton', {
    borderColor: 'color-mix(in srgb, var(--danger) 45%, var(--border))',
    color: 'var(--danger)',
    $: {
        '&:hover': {
            borderColor: 'var(--danger)',
            color: 'var(--danger)'
        }
    }
})

let archiveEpisodeButtonStyle = style('archiveEpisodeButton', {
    borderColor: 'color-mix(in srgb, #f59e0b 45%, var(--border))',
    color: '#b45309',
    $: {
        '&:hover': {
            borderColor: '#f59e0b',
            color: '#92400e'
        }
    }
})

let restoreEpisodeButtonStyle = style('restoreEpisodeButton', {
    borderColor: 'color-mix(in srgb, #10b981 40%, var(--border))',
    color: '#047857',
    $: {
        '&:hover': {
            borderColor: '#10b981',
            color: '#065f46'
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

let expandedAudioStyle = style('expandedAudio', {
    width: '100%',
    minWidth: 0,
    height: 40
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

let episodeExpandedPanelStyle = style('episodeExpandedPanel', {
    padding: 18,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    background: 'linear-gradient(180deg, color-mix(in srgb, var(--bg) 72%, white) 0%, color-mix(in srgb, var(--panel) 92%, white) 100%)'
})

let episodeExpandedHeaderStyle = style('episodeExpandedHeader', {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap'
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
    alignItems: 'center'
})

let episodeMetaPillStyle = style('episodeMetaPill', {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 12,
    color: 'var(--muted)',
    backgroundColor: 'color-mix(in srgb, var(--bg) 88%, white)',
    border: '1px solid color-mix(in srgb, var(--border) 88%, transparent)'
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











