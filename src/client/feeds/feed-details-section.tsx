import { type ChangeEvent, useState } from "react"
import { classes, style } from "stylemap"
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
    status: string
    errorMessage: string | null
    audioReady: boolean
    audioUrl: string
}

export function FeedDetailsSection(props: {
    activeEpisodeAudioUrl: string
    activeEpisodeKey: string | null
    draft: FeedDraft
    episodes: Episode[]
    error: string
    isEditing: boolean
    podcastUrl: string
    onCancel: () => void
    onDelete: () => void
    onDraftChange: (field: keyof FeedDraft, value: string) => void
    onPlayEpisode: (episode: Episode) => void
    onSubmit: () => void
    status: string
    voiceOptions: VoiceOption[]
}) {
    let [isSettingsExpanded, setIsSettingsExpanded] = useState(!props.isEditing)

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
                    ? <a className={classes(rssLinkStyle)} href={props.draft.rssUrl} target="_blank" rel="noreferrer">
                        {props.draft.rssUrl}
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
                    <Field
                        label="RSS URL"
                        value={props.draft.rssUrl}
                        onChange={value => props.onDraftChange('rssUrl', value)}
                        placeholder="https://example.com/feed.xml"
                    />
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
                        options={['feed_article', 'source_page']}
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
                <div className={classes(episodesListContainerStyle)}>
                    {sortedEpisodes.length === 0 ? (
                        <div className={classes(emptyEpisodesStyle)}>No episodes discovered yet.</div>
                    ) : (
                        <table className={classes(episodesTableStyle)}>
                            <thead>
                                <tr>
                                    <th className={classes([thStyle, thTitleStyle])}>Episode Title</th>
                                    <th className={classes([thStyle, thDateStyle])}>Published</th>
                                    <th className={classes(thStyle)}>Status</th>
                                    <th className={classes([thStyle, thAudioStyle])}>Audio</th>
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
                                            <td className={classes(tdStyle)}>
                                                <span className={classes([statusBadgeStyle, episode.status === 'completed' && completedBadgeStyle])}>
                                                    {episode.status.replace('_', ' ')}
                                                </span>
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
                                option === 'source_page' ? 'Source page' : option}
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

let episodesListContainerStyle = style('episodesListContainer', {
    flex: 1,
    overflowY: 'auto',
    padding: 0
})

let episodesTableStyle = style('table', {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    tableLayout: 'fixed'
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

let thAudioStyle = style('thAudio', {
    width: '240px',
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

let tdAudioStyle = style('tdAudio', {
    textAlign: 'right'
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
