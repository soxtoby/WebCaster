import { type ChangeEvent, Fragment, useEffect, useState } from "react"
import { classes, style } from "stylemap"
import type { Feed } from "../../server/db/schema"
import { api } from "../api"
import { buildEpisodeTranscriptDialogId, EpisodeTranscriptDialog } from "./episode-transcript-dialog"
import { VoiceSelectorDialog } from "./voice-selector-dialog"
import type { VoiceOption } from "./voice-selector-field"

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

export interface EpisodesSectionProps {
    feed: Feed
    feedTitle: string
    contentSource: string
    showArchivedEpisodes: boolean
    voiceOptions: VoiceOption[]
    onPodcastUrlChange: (value: string) => void
    onError: (value: string) => void
    onStatus: (value: string) => void
}

export function EpisodesSection({
    feed,
    feedTitle,
    contentSource,
    showArchivedEpisodes,
    voiceOptions,
    onPodcastUrlChange,
    onError,
    onStatus
}: EpisodesSectionProps) {
    let feedId = feed.id
    let [episodes, setEpisodes] = useState<Episode[]>([])
    let [selectedEpisodeKey, setSelectedEpisodeKey] = useState<string | null>(null)
    let [activeEpisodeKey, setActiveEpisodeKey] = useState<string | null>(null)
    let [activeEpisodeAudioUrl, setActiveEpisodeAudioUrl] = useState('')
    let [isAddingArticle, setIsAddingArticle] = useState(false)
    let [removingEpisodeKey, setRemovingEpisodeKey] = useState<string | null>(null)
    let [updatingEpisodeVoiceKey, setUpdatingEpisodeVoiceKey] = useState<string | null>(null)
    let [updatingEpisodeArchiveKey, setUpdatingEpisodeArchiveKey] = useState<string | null>(null)
    let [articleUrl, setArticleUrl] = useState('')
    let [isNarrowViewport, setIsNarrowViewport] = useState(() => window.matchMedia('(max-width: 920px)').matches)
    let isCustomFeed = contentSource == 'custom'

    useEffect(() => {
        setArticleUrl('')
    }, [feedId, contentSource])

    useEffect(() => {
        setSelectedEpisodeKey(null)
        setActiveEpisodeKey(null)
        setActiveEpisodeAudioUrl('')
        setIsAddingArticle(false)
        setRemovingEpisodeKey(null)
        setUpdatingEpisodeVoiceKey(null)
        setUpdatingEpisodeArchiveKey(null)
        void loadEpisodes(feedId)
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
        if (showArchivedEpisodes || !selectedEpisodeKey)
            return

        let selectedEpisode = episodes.find(episode => episode.episodeKey == selectedEpisodeKey)
        if (!selectedEpisode?.archived)
            return

        setSelectedEpisodeKey(null)

        if (activeEpisodeKey == selectedEpisodeKey) {
            setActiveEpisodeKey(null)
            setActiveEpisodeAudioUrl('')
        }
    }, [showArchivedEpisodes, episodes, selectedEpisodeKey, activeEpisodeKey])

    useEffect(() => {
        if (!episodes.some(episode => episode.status == 'generating' || episode.status == 'queued'))
            return

        let timer = setInterval(() => {
            void loadEpisodes(feedId)
        }, 5000)

        return () => {
            clearInterval(timer)
        }
    }, [feedId, episodes])

    useEffect(() => {
        let mediaQuery = window.matchMedia('(max-width: 920px)')

        function handleMediaQueryChange(event: MediaQueryListEvent) {
            setIsNarrowViewport(event.matches)
        }

        setIsNarrowViewport(mediaQuery.matches)
        mediaQuery.addEventListener('change', handleMediaQueryChange)

        return () => {
            mediaQuery.removeEventListener('change', handleMediaQueryChange)
        }
    }, [])

    let visibleEpisodes = episodes.filter(episode => showArchivedEpisodes || !episode.archived)
    let sortedEpisodes = [...visibleEpisodes].sort((a, b) => {
        if (!a.publishedAt) return 1
        if (!b.publishedAt) return -1
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    })
    let summaryColumnCount = isNarrowViewport ? 2 : 5

    return <div className={classes(episodesAreaStyle)}>
        {isCustomFeed
            ? <div className={classes(customArticleBarStyle)}>
                <div className={classes(customArticleInfoStyle)}>
                    <span className={classes(episodesFieldLabelStyle)}>Add article URL</span>
                    <span className={classes(customArticleHintStyle)}>Import a single web article as a podcast episode.</span>
                </div>
                <div className={classes(customArticleFormStyle)}>
                    <input
                        className={classes(episodesFieldInputStyle)}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => setArticleUrl(event.target.value)}
                        placeholder="https://example.com/article"
                        type="url"
                        value={articleUrl}
                    />
                    <button
                        className={classes([episodesActionButtonStyle, episodesPrimaryButtonStyle])}
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
                    {episodes.length > 0 && !showArchivedEpisodes
                        ? 'Only archived episodes remain. Enable "Show archived episodes" in settings to review them.'
                        : isCustomFeed
                            ? 'No articles yet. Add a URL to create the first episode.'
                            : 'No episodes discovered yet.'}
                </div>
            ) : (
                <div className={classes(episodesTableScrollerStyle)}>
                    <table className={classes(episodesTableStyle)}>
                        <thead>
                            <tr>
                                <th className={classes([thStyle, thTitleStyle])}>Episode Title</th>
                                {!isNarrowViewport ? <th className={classes([thStyle, thDateStyle])}>Published</th> : null}
                                {!isNarrowViewport ? <th className={classes([thStyle, thDurationStyle])}>Length</th> : null}
                                {!isNarrowViewport ? <th className={classes([thStyle, thStatusStyle])}>Status</th> : null}
                                <th className={classes([thStyle, thActionsStyle])}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedEpisodes.map(episode => <EpisodeTableRow
                                key={episode.episodeKey}
                                episode={episode}
                                isSelected={selectedEpisodeKey == episode.episodeKey}
                                isPlaying={activeEpisodeKey == episode.episodeKey}
                                activeAudioUrl={activeEpisodeAudioUrl}
                                isNarrowViewport={isNarrowViewport}
                                isCustomFeed={isCustomFeed}
                                summaryColumnCount={summaryColumnCount}
                                isRemoving={removingEpisodeKey == episode.episodeKey}
                                isUpdatingVoice={updatingEpisodeVoiceKey == episode.episodeKey}
                                isUpdatingArchive={updatingEpisodeArchiveKey == episode.episodeKey}
                                feedId={feedId}
                                feedTitle={feedTitle}
                                voiceOptions={voiceOptions}
                                onToggleSelected={() => setSelectedEpisodeKey(current => current == episode.episodeKey ? null : episode.episodeKey)}
                                onRemoveArticle={removeArticleFromFeed}
                                onUpdateVoice={updateEpisodeVoice}
                                onUpdateArchived={updateEpisodeArchived}
                                onCancelGeneration={cancelEpisodeAudioGeneration}
                                onPlay={playEpisode}
                                onGenerateAudio={generateEpisodeAudio}
                            />)}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    </div>

    async function addArticleToFeed(url: string) {
        onError('')
        onStatus('')
        setIsAddingArticle(true)

        try {
            await api.feeds.addArticle.mutate({ id: feedId, url })
            onStatus(feed.generationMode == 'every_episode' ? 'Article added and generation started' : 'Article added')
            await loadEpisodes(feedId)
        }
        catch (cause) {
            let message = cause instanceof Error ? cause.message : 'Failed to add article'
            onError(message)
            throw cause
        }
        finally {
            setIsAddingArticle(false)
        }
    }

    async function removeArticleFromFeed(episode: Episode) {
        let confirmed = window.confirm(`Remove "${episode.title}" from "${feed.name || 'Untitled Feed'}"?`)
        if (!confirmed)
            return

        onError('')
        onStatus('')
        setRemovingEpisodeKey(episode.episodeKey)

        try {
            await api.feeds.removeArticle.mutate({ id: feedId, episodeKey: episode.episodeKey })

            if (activeEpisodeKey == episode.episodeKey) {
                setActiveEpisodeKey(null)
                setActiveEpisodeAudioUrl('')
            }

            if (selectedEpisodeKey == episode.episodeKey)
                setSelectedEpisodeKey(null)

            onStatus('Article removed')
            await loadEpisodes(feedId)
        }
        catch (cause) {
            let message = cause instanceof Error ? cause.message : 'Failed to remove article'
            onError(message)
        }
        finally {
            setRemovingEpisodeKey(null)
        }
    }

    async function generateEpisodeAudio(episode: Episode) {
        if (episode.audioReady || episode.status == 'generating' || episode.status == 'queued')
            return

        onError('')
        onStatus('')
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
            onError(message)
            await loadEpisodes(feedId)
        }
    }

    async function cancelEpisodeAudioGeneration(episode: Episode) {
        if (episode.status != 'generating' && episode.status != 'queued')
            return

        onError('')
        onStatus('')
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
            onError(message)
            await loadEpisodes(feedId)
        }
    }

    async function updateEpisodeVoice(episodeKey: string, voice: string) {
        onError('')
        onStatus('')
        setUpdatingEpisodeVoiceKey(episodeKey)

        try {
            await api.feeds.setEpisodeVoice.mutate({ id: feedId, episodeKey, voice })
            onStatus(voice ? 'Episode voice updated' : 'Episode voice reset to feed default')

            if (activeEpisodeKey == episodeKey)
                setActiveEpisodeAudioUrl(`${window.location.origin}/feed/${feed.podcastSlug}/${episodeKey}?v=${Date.now()}`)

            await loadEpisodes(feedId)
        }
        catch (cause) {
            let message = cause instanceof Error ? cause.message : 'Failed to update episode voice'
            onError(message)
        }
        finally {
            setUpdatingEpisodeVoiceKey(null)
        }
    }

    async function updateEpisodeArchived(episodeKey: string, archived: boolean) {
        onError('')
        onStatus('')
        setUpdatingEpisodeArchiveKey(episodeKey)

        try {
            await api.feeds.setEpisodeArchive.mutate({ id: feedId, episodeKey, archived })
            onStatus(archived ? 'Episode archived' : 'Episode restored')

            if (archived && !showArchivedEpisodes) {
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
            onError(message)
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
            onPodcastUrlChange(`${window.location.origin}${response.podcastUrl}`)
            let enrichedEpisodes = response.episodes.map(episode => ({
                ...episode,
                audioUrl: `${window.location.origin}${episode.episodePath}`
            }))
            setEpisodes(enrichedEpisodes)
        }
        catch {
            setEpisodes([])
            onPodcastUrlChange('')
        }
    }
}

interface EpisodeTableRowProps {
    episode: Episode
    isSelected: boolean
    isPlaying: boolean
    activeAudioUrl: string
    isNarrowViewport: boolean
    isCustomFeed: boolean
    summaryColumnCount: number
    isRemoving: boolean
    isUpdatingVoice: boolean
    isUpdatingArchive: boolean
    feedId: number
    feedTitle: string
    voiceOptions: VoiceOption[]
    onToggleSelected: () => void
    onRemoveArticle: (episode: Episode) => Promise<void>
    onUpdateVoice: (episodeKey: string, voice: string) => Promise<void>
    onUpdateArchived: (episodeKey: string, archived: boolean) => Promise<void>
    onCancelGeneration: (episode: Episode) => Promise<void>
    onPlay: (episode: Episode) => void
    onGenerateAudio: (episode: Episode) => Promise<void>
}

function EpisodeTableRow({
    episode,
    isSelected,
    isPlaying,
    activeAudioUrl,
    isNarrowViewport,
    isCustomFeed,
    summaryColumnCount,
    isRemoving,
    isUpdatingVoice,
    isUpdatingArchive,
    feedId,
    feedTitle,
    voiceOptions,
    onToggleSelected,
    onRemoveArticle,
    onUpdateVoice,
    onUpdateArchived,
    onCancelGeneration,
    onPlay,
    onGenerateAudio
}: EpisodeTableRowProps) {
    let isGeneratingEpisode = episode.status == 'generating' || episode.status == 'queued'
    let dateStr = ''

    if (episode.publishedAt) {
        dateStr = new Date(episode.publishedAt).toLocaleDateString(undefined, {
            month: 'short', day: 'numeric', year: 'numeric'
        })
    }

    return <Fragment>
        <tr
            aria-expanded={isSelected}
            className={classes([trStyle, episode.archived && archivedTrStyle, isSelected && activeTrStyle])}
            onClick={onToggleSelected}
            onKeyDown={event => {
                if (event.key == 'Enter' || event.key == ' ') {
                    event.preventDefault()
                    onToggleSelected()
                }
            }}
            tabIndex={0}
        >
            <td className={classes([tdStyle, tdTitleStyle])}>
                <div className={classes(episodeRowSummaryStyle)}>
                    <span className={classes([episodeExpandIconStyle, isSelected && episodeExpandIconOpenStyle])} aria-hidden="true">
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
                        {isNarrowViewport
                            ? <div className={classes(mobileEpisodeMetaRowStyle)}>
                                <span className={classes([statusBadgeStyle, episode.status == 'ready' && completedBadgeStyle])}>
                                    {episode.status.replace('_', ' ')}
                                </span>
                                {dateStr ? <span className={classes(mobileEpisodeMetaTextStyle)}>{dateStr}</span> : null}
                                <span className={classes(mobileEpisodeMetaTextStyle)}>{buildEpisodeDurationLabel(episode)}</span>
                            </div>
                            : null}
                    </div>
                </div>
            </td>
            {!isNarrowViewport ? <td className={classes([tdStyle, tdDateStyle])}>{dateStr || '—'}</td> : null}
            {!isNarrowViewport ? <td className={classes([tdStyle, tdDurationStyle])}>{buildEpisodeDurationLabel(episode)}</td> : null}
            {!isNarrowViewport ? <td className={classes(tdStyle)}>
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
            </td> : null}
            <td className={classes([tdStyle, tdActionsStyle])} onClick={event => event.stopPropagation()}>
                <div className={classes(rowActionGroupStyle)}>
                    <button
                        aria-label={buildCollapsedGenerateButtonLabel(episode)}
                        className={classes([playButtonStyle, rowIconButtonStyle, generateAudioButtonStyle])}
                        disabled={episode.audioReady || isGeneratingEpisode}
                        onClick={() => void onGenerateAudio(episode)}
                        title={buildCollapsedGenerateButtonLabel(episode)}
                        type="button"
                    >
                        {episode.audioReady
                            ? <svg className={classes(rowActionIconStyle)} viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M9.75 16.4l-3.15-3.15 1.4-1.4 1.75 1.75 6.25-6.25 1.4 1.4z" fill="currentColor" />
                            </svg>
                            : <svg className={classes(rowActionIconStyle)} viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M12 4.75l1.7 4.55 4.55 1.7-4.55 1.7L12 17.25l-1.7-4.55-4.55-1.7 4.55-1.7zm5.35 8.65l.7 1.85 1.85.7-1.85.7-.7 1.85-.7-1.85-1.85-.7 1.85-.7zm-9.65 1.45l.9 2.45 2.45.9-2.45.9-.9 2.45-.9-2.45-2.45-.9 2.45-.9z" fill="currentColor" />
                            </svg>}
                    </button>
                    <button
                        aria-label={episode.archived ? 'Unarchive episode' : 'Archive episode'}
                        className={classes([playButtonStyle, rowIconButtonStyle, episode.archived ? restoreEpisodeButtonStyle : archiveEpisodeButtonStyle])}
                        disabled={isUpdatingArchive}
                        onClick={() => void onUpdateArchived(episode.episodeKey, !episode.archived)}
                        title={episode.archived ? 'Restore episode to the podcast feed' : 'Archive episode from the podcast feed'}
                        type="button"
                    >
                        {isUpdatingArchive
                            ? <span className={classes(rowActionBusyDotStyle)} aria-hidden="true" />
                            : <svg className={classes(rowActionIconStyle)} viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M7 8h10l-1 10H8zm1.3-3h7.4l1.2 2H7.1z" fill="currentColor" />
                            </svg>}
                    </button>
                    {isCustomFeed
                        ? <details className={classes(rowMenuStyle)}>
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
                                    disabled={isRemoving || isGeneratingEpisode}
                                    onClick={(event) => {
                                        void onRemoveArticle(episode)
                                        event.currentTarget.closest('details')?.removeAttribute('open')
                                    }}
                                    title={isGeneratingEpisode ? 'Wait for generation to finish before removing this article' : 'Remove article'}
                                    type="button"
                                >
                                    {isRemoving ? 'Removing...' : 'Remove article'}
                                </button>
                            </div>
                        </details>
                        : null}
                </div>
            </td>
        </tr>
        {isSelected
            ? <tr className={classes(expandedTrStyle)}>
                <td className={classes(expandedTdStyle)} colSpan={summaryColumnCount}>
                    <EpisodeExpandedPanel
                        episode={episode}
                        feedId={feedId}
                        feedTitle={feedTitle}
                        voiceOptions={voiceOptions}
                        isPlaying={isPlaying}
                        activeAudioUrl={activeAudioUrl}
                        isUpdatingVoice={isUpdatingVoice}
                        isUpdatingArchive={isUpdatingArchive}
                        onUpdateVoice={onUpdateVoice}
                        onUpdateArchived={onUpdateArchived}
                        onCancelGeneration={onCancelGeneration}
                        onPlay={onPlay}
                        onGenerateAudio={onGenerateAudio}
                    />
                </td>
            </tr>
            : null}
    </Fragment>
}

interface EpisodeExpandedPanelProps {
    episode: Episode
    feedId: number | null
    feedTitle: string
    voiceOptions: VoiceOption[]
    isPlaying: boolean
    activeAudioUrl: string
    isUpdatingVoice: boolean
    isUpdatingArchive: boolean
    onUpdateVoice: (episodeKey: string, voice: string) => Promise<void>
    onUpdateArchived: (episodeKey: string, archived: boolean) => Promise<void>
    onCancelGeneration: (episode: Episode) => Promise<void>
    onPlay: (episode: Episode) => void
    onGenerateAudio: (episode: Episode) => Promise<void>
}

function EpisodeExpandedPanel({
    episode,
    feedId,
    feedTitle,
    voiceOptions,
    isPlaying,
    activeAudioUrl,
    isUpdatingVoice,
    isUpdatingArchive,
    onUpdateVoice,
    onUpdateArchived,
    onCancelGeneration,
    onPlay,
    onGenerateAudio
}: EpisodeExpandedPanelProps) {
    let isGeneratingEpisode = episode.status == 'generating' || episode.status == 'queued'
    let dateStr = ''

    if (episode.publishedAt) {
        dateStr = new Date(episode.publishedAt).toLocaleDateString(undefined, {
            month: 'short', day: 'numeric', year: 'numeric'
        })
    }

    return <div className={classes(episodeExpandedPanelStyle)}>
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
                {isPlaying ? <span className={classes(episodePlayingPillStyle)}>Now playing</span> : null}
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
                    disabled={isUpdatingVoice}
                    aria-label={buildEpisodeVoiceAriaLabel(voiceOptions, episode.voice, isUpdatingVoice)}
                    type="button"
                >
                    {isUpdatingVoice
                        ? 'Saving...'
                        : <span className={classes(episodeVoiceButtonInnerStyle)}>
                            <svg className={classes(episodeVoiceIconStyle)} viewBox="0 0 24 24" aria-hidden="true">
                                <path fill="currentColor" d="M23 9q0 1.725-.612 3.288t-1.663 2.837q-.3.35-.75.375t-.8-.325q-.325-.325-.3-.775t.3-.825q.75-.95 1.163-2.125T20.75 9t-.412-2.425t-1.163-2.1q-.3-.375-.312-.825t.312-.8t.788-.338t.762.363q1.05 1.275 1.663 2.838T23 9m-4.55 0q0 .8-.25 1.538t-.7 1.362q-.275.375-.737.388t-.813-.338q-.325-.325-.337-.787t.212-.888q.15-.275.238-.6T16.15 9t-.088-.675t-.237-.625q-.225-.425-.213-.875t.338-.775q.35-.35.813-.338t.737.388q.45.625.7 1.363T18.45 9M9 13q-1.65 0-2.825-1.175T5 9t1.175-2.825T9 5t2.825 1.175T13 9t-1.175 2.825T9 13m-8 6v-.8q0-.825.425-1.55t1.175-1.1q1.275-.65 2.875-1.1T9 14t3.525.45t2.875 1.1q.75.375 1.175 1.1T17 18.2v.8q0 .825-.587 1.413T15 21H3q-.825 0-1.412-.587T1 19" />
                            </svg>
                            <span className={classes(episodeVoiceTextStyle)}>{buildEpisodeVoiceSummary(voiceOptions, episode.voice) || 'Feed default'}</span>
                        </span>}
                </button>
                <VoiceSelectorDialog
                    id={buildEpisodeVoiceDialogId(episode.episodeKey)}
                    value={episode.voice || ''}
                    options={buildEpisodeVoiceDialogOptions(voiceOptions, episode.voice)}
                    onSave={value => onUpdateVoice(episode.episodeKey, value)}
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
                            feedTitle={feedTitle}
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
                    onClick={() => void onUpdateArchived(episode.episodeKey, !episode.archived)}
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
                    {isPlaying && activeAudioUrl ? (
                        <audio
                            autoPlay
                            className={classes(expandedAudioStyle)}
                            controls
                            preload="none"
                            src={activeAudioUrl}
                        />
                    ) : isGeneratingEpisode ? (
                        <button
                            aria-label="Cancel audio generation"
                            className={classes([playButtonStyle, detailActionButtonStyle, cancelAudioButtonStyle])}
                            onClick={() => void onCancelGeneration(episode)}
                            type="button"
                            title="Cancel generation"
                        >
                            Cancel generation
                        </button>
                    ) : episode.audioReady ? (
                        <button
                            aria-label="Play episode"
                            className={classes([playButtonStyle, detailActionButtonStyle])}
                            onClick={() => onPlay(episode)}
                            type="button"
                            title="Play audio"
                        >
                            Play episode
                        </button>
                    ) : (
                        <button
                            aria-label="Generate audio"
                            className={classes([playButtonStyle, detailActionButtonStyle, generateAudioButtonStyle])}
                            onClick={() => void onGenerateAudio(episode)}
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
                            ? (isPlaying ? 'Playback is active for this episode.' : 'Audio is ready to play.')
                            : 'Generate narrated audio for this episode.'}
                </span>
            </div>
        </div>
    </div>
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

function buildCollapsedGenerateButtonLabel(episode: Episode) {
    if (episode.status == 'queued')
        return 'Audio generation is queued'

    if (episode.status == 'generating')
        return 'Audio generation is in progress'

    if (episode.audioReady)
        return 'Audio has already been generated'

    return 'Generate'
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
}

let episodesActionButtonStyle = style('episodesActionButton', {
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

let episodesPrimaryButtonStyle = style('episodesPrimaryButton', {
    backgroundColor: 'var(--accent)',
    borderColor: 'var(--accent)',
    color: 'var(--accent-text)',
    border: 'none'
})

let episodesFieldLabelStyle = style('episodesFieldLabel', {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--muted)'
})

let episodesFieldInputStyle = style('episodesFieldInput', {
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
    minWidth: 0,
    overflow: 'auto',
    padding: 0,
    scrollbarGutter: 'stable',
    $: {
        '@media (max-width: 920px)': {
            scrollbarGutter: 'auto'
        }
    }
})

let episodesTableScrollerStyle = style('episodesTableScroller', {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    overflow: 'visible',
    $: {
        '@media (max-width: 920px)': {
            overflowX: 'auto',
            overflowY: 'visible',
            overscrollBehaviorX: 'contain',
            touchAction: 'pan-x',
            WebkitOverflowScrolling: 'touch'
        }
    }
})

let episodesTableStyle = style('episodesTable', {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    tableLayout: 'auto',
    minWidth: 620,
    $: {
        '@media (max-width: 920px)': {
            minWidth: '100%'
        }
    }
})

let emptyEpisodesStyle = style('emptyEpisodes', {
    padding: 40,
    textAlign: 'center',
    color: 'var(--muted)',
    fontSize: 14
})

let thStyle = style('episodesTh', {
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

let thTitleStyle = style('episodesThTitle', {
    width: '45%',
    $: {
        '@media (max-width: 920px)': {
            width: 'auto'
        }
    }
})

let thDateStyle = style('episodesThDate', {
    width: '15%',
    $: {
        '@media (max-width: 920px)': {
            display: 'none'
        }
    }
})

let thDurationStyle = style('episodesThDuration', {
    width: 110,
    $: {
        '@media (max-width: 920px)': {
            display: 'none'
        }
    }
})

let thStatusStyle = style('episodesThStatus', {
    width: 180,
    $: {
        '@media (max-width: 920px)': {
            width: 132
        }
    }
})

let thActionsStyle = style('episodesThActions', {
    width: 144,
    textAlign: 'right',
    $: {
        '@media (max-width: 920px)': {
            width: 124
        }
    }
})

let trStyle = style('episodesTr', {
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

let activeTrStyle = style('episodesActiveTr', {
    backgroundColor: 'color-mix(in srgb, var(--accent) 5%, transparent)',
    $: {
        '&:hover': {
            backgroundColor: 'color-mix(in srgb, var(--accent) 8%, transparent)'
        }
    }
})

let archivedTrStyle = style('episodesArchivedTr', {
    opacity: 0.82
})

let tdStyle = style('episodesTd', {
    padding: '12px 20px',
    fontSize: 13,
    verticalAlign: 'middle',
    color: 'var(--text)',
    $: {
        '@media (max-width: 920px)': {
            padding: '12px 14px'
        }
    }
})

let tdTitleStyle = style('episodesTdTitle', {
    minWidth: 0
})

let tdDateStyle = style('episodesTdDate', {
    color: 'var(--muted)',
    $: {
        '@media (max-width: 920px)': {
            display: 'none'
        }
    }
})

let tdDurationStyle = style('episodesTdDuration', {
    color: 'var(--muted)',
    whiteSpace: 'nowrap',
    $: {
        '@media (max-width: 920px)': {
            display: 'none'
        }
    }
})

let transcriptButtonStyle = style('episodesTranscriptButton', {
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

let transcriptButtonCompactStyle = style('episodesTranscriptButtonCompact', {
    width: '100%',
    minHeight: 34,
    borderRadius: 8,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center'
})

let tdActionsStyle = style('episodesTdActions', {
    textAlign: 'right',
    position: 'relative'
})

let rowActionGroupStyle = style('episodesRowActionGroup', {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    flexWrap: 'nowrap'
})

let rowIconButtonStyle = style('episodesRowIconButton', {
    width: 38,
    height: 38,
    minHeight: 38,
    borderRadius: 999,
    padding: 0,
    justifyContent: 'center',
    flexShrink: 0,
    backgroundColor: 'color-mix(in srgb, var(--panel) 86%, var(--bg))',
    boxShadow: '0 1px 2px rgba(16, 24, 40, 0.06)',
    $: {
        '&:disabled': {
            opacity: 0.55,
            boxShadow: 'none'
        }
    }
})

let rowActionIconStyle = style('episodesRowActionIcon', {
    width: 22,
    height: 22,
    display: 'block',
    overflow: 'visible'
})

let rowActionBusyDotStyle = style('episodesRowActionBusyDot', {
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: 'currentColor',
    display: 'block'
})

let expandedTrStyle = style('episodesExpandedTr', {
    backgroundColor: 'color-mix(in srgb, var(--accent) 3%, var(--panel))'
})

let expandedTdStyle = style('episodesExpandedTd', {
    padding: 0,
    borderBottom: '1px solid var(--border)'
})

let rowMenuStyle = style('episodesRowMenu', {
    position: 'relative',
    display: 'inline-block'
})

let rowMenuTriggerStyle = style('episodesRowMenuTrigger', {
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

let rowMenuTriggerIconStyle = style('episodesRowMenuTriggerIcon', {
    width: 16,
    height: 16,
    display: 'block'
})

let rowMenuPopoverStyle = style('episodesRowMenuPopover', {
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

let episodeVoiceButtonStyle = style('episodesVoiceButton', {
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

let episodeVoiceButtonCompactStyle = style('episodesVoiceButtonCompact', {
    minWidth: 0,
    width: '100%',
    minHeight: 34,
    padding: '6px 10px',
    backgroundColor: 'var(--panel)'
})

let episodeVoiceButtonInnerStyle = style('episodesVoiceButtonInner', {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%'
})

let episodeVoiceIconStyle = style('episodesVoiceIcon', {
    width: 18,
    height: 18,
    display: 'block',
    lineHeight: 0,
    transform: 'translateY(-0.5px)',
    flexShrink: 0
})

let episodeVoiceTextStyle = style('episodesVoiceText', {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
})

let episodeTitleTextStyle = style('episodesTitleText', {
    fontWeight: 500,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
})

let episodeTitleRowStyle = style('episodesTitleRow', {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0
})

let episodeRowSummaryStyle = style('episodesRowSummary', {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    minWidth: 0
})

let episodeRowTextStyle = style('episodesRowText', {
    minWidth: 0,
    flex: 1
})

let episodeExpandIconStyle = style('episodesExpandIcon', {
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

let episodeExpandIconOpenStyle = style('episodesExpandIconOpen', {
    color: 'var(--accent)',
    borderColor: 'color-mix(in srgb, var(--accent) 35%, var(--border))',
    transform: 'rotate(90deg)'
})

let episodeExpandIconGlyphStyle = style('episodesExpandIconGlyph', {
    width: 14,
    height: 14,
    display: 'block'
})

let episodeErrorTextStyle = style('episodesErrorText', {
    color: 'var(--danger)',
    fontSize: 12,
    marginTop: 4,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
})

let mobileEpisodeMetaRowStyle = style('episodesMobileMetaRow', {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 8
})

let mobileEpisodeMetaTextStyle = style('episodesMobileMetaText', {
    fontSize: 12,
    color: 'var(--muted)',
    whiteSpace: 'nowrap'
})

let statusBadgeStyle = style('episodesStatusBadge', {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 600,
    backgroundColor: 'color-mix(in srgb, var(--muted) 15%, transparent)',
    color: 'var(--text)',
    textTransform: 'uppercase'
})

let archivedBadgeStyle = style('episodesArchivedBadge', {
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

let completedBadgeStyle = style('episodesCompletedBadge', {
    backgroundColor: 'color-mix(in srgb, #10b981 15%, transparent)',
    color: '#10b981'
})

let progressStatusStyle = style('episodesProgressStatus', {
    width: '100%',
    minWidth: 120,
    maxWidth: 170,
    display: 'flex',
    flexDirection: 'column',
    gap: 5
})

let progressTrackStyle = style('episodesProgressTrack', {
    width: '100%',
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'color-mix(in srgb, var(--muted) 20%, transparent)'
})

let progressFillStyle = style('episodesProgressFill', {
    height: '100%',
    borderRadius: 999,
    backgroundColor: 'var(--accent)',
    transition: 'width 0.3s ease'
})

let progressMetaStyle = style('episodesProgressMeta', {
    fontSize: 11,
    color: 'var(--muted)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
})

let playButtonStyle = style('episodesPlayButton', {
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

let detailActionButtonStyle = style('episodesDetailActionButton', {
    minHeight: 40,
    borderRadius: 10,
    justifyContent: 'center',
    padding: '8px 14px'
})

let episodeActionCompactStyle = style('episodesActionCompact', {
    width: '100%',
    minHeight: 34,
    borderRadius: 8,
    padding: '6px 10px'
})

let generateAudioButtonStyle = style('episodesGenerateAudioButton', {
    borderColor: 'color-mix(in srgb, var(--accent) 45%, var(--border))',
    color: 'var(--accent)'
})

let cancelAudioButtonStyle = style('episodesCancelAudioButton', {
    borderColor: 'color-mix(in srgb, var(--danger) 45%, var(--border))',
    color: 'var(--danger)',
    $: {
        '&:hover': {
            borderColor: 'var(--danger)',
            color: 'var(--danger)'
        }
    }
})

let archiveEpisodeButtonStyle = style('episodesArchiveButton', {
    borderColor: 'color-mix(in srgb, #f59e0b 45%, var(--border))',
    color: '#b45309',
    $: {
        '&:hover': {
            borderColor: '#f59e0b',
            color: '#92400e'
        }
    }
})

let restoreEpisodeButtonStyle = style('episodesRestoreButton', {
    borderColor: 'color-mix(in srgb, #10b981 40%, var(--border))',
    color: '#047857',
    $: {
        '&:hover': {
            borderColor: '#10b981',
            color: '#065f46'
        }
    }
})

let removeArticleMenuButtonStyle = style('episodesRemoveArticleMenuButton', {
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

let expandedAudioStyle = style('episodesExpandedAudio', {
    width: '100%',
    minWidth: 0,
    height: 40
})

let episodeExpandedPanelStyle = style('episodesExpandedPanel', {
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

let episodeExpandedHeaderStyle = style('episodesExpandedHeader', {
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

let episodeExpandedTitleBlockStyle = style('episodesExpandedTitleBlock', {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    minWidth: 0,
    flex: 1
})

let episodeExpandedEyebrowStyle = style('episodesExpandedEyebrow', {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--accent)'
})

let episodeExpandedTitleStyle = style('episodesExpandedTitle', {
    fontSize: 16,
    fontWeight: 650,
    lineHeight: 1.35,
    overflowWrap: 'anywhere'
})

let episodeMetaListStyle = style('episodesMetaList', {
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

let episodeMetaPillStyle = style('episodesMetaPill', {
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

let episodePlayingPillStyle = style('episodesPlayingPill', {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--accent)',
    backgroundColor: 'color-mix(in srgb, var(--accent) 12%, white)'
})

let episodeSourceLinkStyle = style('episodesSourceLink', {
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

let episodeControlRowStyle = style('episodesControlRow', {
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

let episodeControlItemStyle = style('episodesControlItem', {
    minWidth: 0,
    display: 'grid',
    gap: 6,
    alignContent: 'start'
})

let episodeControlLabelStyle = style('episodesControlLabel', {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: 'var(--muted)'
})

let episodeDetailGridStyle = style('episodesDetailGrid', {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 14
})

let episodeDetailCardStyle = style('episodesDetailCard', {
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

let episodeDetailAudioCardStyle = style('episodesDetailAudioCard', {
    gridColumn: 'span 2',
    $: {
        '@media (max-width: 760px)': {
            gridColumn: 'span 1'
        }
    }
})

let episodeDetailLabelStyle = style('episodesDetailLabel', {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'var(--muted)'
})

let episodeDetailHintStyle = style('episodesDetailHint', {
    fontSize: 12,
    lineHeight: 1.45,
    color: 'var(--muted)'
})

let episodeDetailAudioContentStyle = style('episodesDetailAudioContent', {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    minWidth: 0
})