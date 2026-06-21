import { style } from "stylemap"

export let dialogContainerStyle = style('settingsDialog', {
    width: '100%',
    maxWidth: 600,
    maxHeight: 'min(720px, calc(100vh - 32px))',
    backgroundColor: 'var(--panel)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    boxShadow: '0 8px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
    overflow: 'hidden',
    padding: 0,
    $: {
        '&[open]': {
            display: 'flex',
            flexDirection: 'column'
        },
        '&::backdrop': {
            backgroundColor: 'color-mix(in srgb, var(--bg) 60%, transparent)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)'
        }
    }
})

export let headerStyle = style('settingsHeader', {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 20px',
    borderBottom: '1px solid var(--border)',
    backgroundColor: 'var(--bg)'
})

export let headingStyle = style('settingsHeading', {
    margin: 0,
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--text)'
})

export let closeButtonStyle = style('closeButton', {
    background: 'none',
    border: 'none',
    color: 'var(--muted)',
    width: 36,
    height: 36,
    padding: 0,
    cursor: 'pointer',
    borderRadius: 4,
    display: 'grid',
    placeItems: 'center',
    transition: 'all 0.15s',
    $: {
        '&:hover': {
            backgroundColor: 'var(--border)',
            color: 'var(--text)'
        }
    }
})

export let closeIconStyle = style('closeIcon', {
    width: 16,
    height: 16,
    display: 'block'
})

export let layoutStyle = style('settingsLayout', {
    display: 'flex',
    minWidth: 0,
    minHeight: 0,
    flex: 1,
    $: {
        '@media (max-width: 500px)': {
            flexDirection: 'column'
        }
    }
})

export let sidebarStyle = style('settingsSidebar', {
    width: 160,
    borderRight: '1px solid var(--border)',
    backgroundColor: 'var(--panel)',
    padding: '12px 8px',
    flexShrink: 0,
    minHeight: 0,
    overflowY: 'auto',
    $: {
        '@media (max-width: 500px)': {
            width: '100%',
            borderRight: 'none',
            borderBottom: '1px solid var(--border)',
            padding: '8px',
            display: 'flex',
            overflowX: 'auto',
            overflowY: 'visible'
        }
    }
})

export let tabsContainerStyle = style('settingsTabs', {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    $: {
        '@media (max-width: 500px)': {
            flexDirection: 'row'
        }
    }
})

export let tabDividerStyle = style('tabDivider', {
    height: 1,
    backgroundColor: 'var(--border)',
    margin: '4px 8px'
})

export let tabButtonStyle = style('tabButton', {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--muted)',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.1s',
    $: {
        '&:hover': {
            backgroundColor: 'var(--bg)',
            color: 'var(--text)'
        },
        '@media (max-width: 500px)': {
            whiteSpace: 'nowrap'
        }
    }
})

export let activeTabButtonStyle = style('activeTabButton', {
    backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)',
    color: 'var(--accent)',
    $: {
        '&:hover': {
            backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)',
            color: 'var(--accent)'
        }
    }
})

export let statusDotStyle = style('statusDot', {
    width: 6,
    height: 6,
    borderRadius: '50%',
    backgroundColor: 'var(--muted)',
    flexShrink: 0,
    transition: 'background-color 0.2s'
})

export let hiddenStatusDotStyle = style('hiddenStatusDot', {
    opacity: 0
})

export let activeDotStyle = style('activeDot', {
    backgroundColor: '#10b981',
    boxShadow: '0 0 4px color-mix(in srgb, #10b981 40%, transparent)'
})

export let contentStyle = style('settingsContent', {
    flex: 1,
    padding: 24,
    backgroundColor: 'var(--panel)',
    minWidth: 0,
    minHeight: 0,
    overflowY: 'auto'
})

export let panelContainerStyle = style('panelContainer', {
    display: 'flex',
    flexDirection: 'column',
    gap: 20
})

export let panelHeaderStyle = style('panelHeader', {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderBottom: '1px solid var(--border)',
    paddingBottom: 12
})

export let panelTitleStyle = style('panelTitle', {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--text)'
})

export let hiddenCheckboxStyle = style('hiddenCheckbox', {
    position: 'absolute',
    opacity: 0,
    width: 0,
    height: 0
})

export let toggleLabelStyle = style('toggleLabel', {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
    userSelect: 'none'
})

export let toggleTrackStyle = style('toggleTrack', {
    width: 36,
    height: 20,
    backgroundColor: 'var(--border)',
    borderRadius: 10,
    position: 'relative',
    transition: 'background-color 0.2s',
    border: '1px solid var(--border)',
    boxSizing: 'border-box'
})

export let activeToggleTrackStyle = style('activeToggleTrack', {
    backgroundColor: 'var(--accent)',
    borderColor: 'var(--accent)'
})

export let toggleThumbStyle = style('toggleThumb', {
    position: 'absolute',
    top: 1,
    left: 1,
    width: 16,
    height: 16,
    backgroundColor: '#fff',
    borderRadius: '50%',
    transition: 'transform 0.2s',
    boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
})

export let activeToggleThumbStyle = style('activeToggleThumb', {
    transform: 'translateX(16px)'
})

export let toggleTextStyle = style('toggleText', {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--muted)',
    width: '60px' // Keep width fixed so it doesn't jump
})

export let toggleTextContainerStyle = style('toggleTextContainer', {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--muted)'
})

export let fieldsGridStyle = style('fieldsGrid', {
    display: 'flex',
    flexDirection: 'column',
    gap: 16
})

export let fieldGroupStyle = style('fieldGroup', {
    display: 'flex',
    flexDirection: 'column',
    gap: 6
})

export let labelStyle = style('label', {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--muted)'
})

export let hintStyle = style('hint', {
    fontSize: 11,
    color: 'var(--muted)',
    opacity: 0.8
})

export let inputStyle = style('input', {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid var(--border)',
    borderRadius: 6,
    fontSize: 13,
    fontFamily: 'monospace',
    backgroundColor: 'var(--bg)',
    color: 'var(--text)',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    minHeight: 34,
    $: {
        '&:hover': {
            borderColor: 'var(--muted)'
        },
        '&:focus': {
            borderColor: 'var(--accent)',
            boxShadow: '0 0 0 2px color-mix(in srgb, var(--accent) 20%, transparent)'
        }
    }
})

export let voiceboxStatusPanelStyle = style('voiceboxStatusPanel', {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 12,
    border: '1px solid var(--border)',
    borderRadius: 6,
    backgroundColor: 'var(--bg)'
})

export let voiceboxStatusTextStyle = style('voiceboxStatusText', {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text)'
})

export let voiceboxActionsStyle = style('voiceboxActions', {
    display: 'flex',
    gap: 8
})

export let footerStyle = style('settingsFooter', {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 20px',
    borderTop: '1px solid var(--border)',
    backgroundColor: 'var(--bg)',
    gap: 12
})

export let statusAreaStyle = style('statusArea', {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    flex: 1,
    minWidth: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
})

export let footerActionsStyle = style('footerActions', {
    display: 'flex',
    gap: 8,
    flexShrink: 0
})

export let buttonStyle = style('button', {
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '6px 14px',
    backgroundColor: 'var(--panel)',
    color: 'var(--text)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
    $: {
        '&:hover': {
            borderColor: 'var(--muted)',
            backgroundColor: 'var(--bg)'
        },
        '&:disabled': {
            opacity: 0.6,
            cursor: 'not-allowed'
        }
    }
})

export let primaryButtonStyle = style('primaryButton', {
    backgroundColor: 'var(--accent)',
    borderColor: 'var(--accent)',
    color: 'var(--accent-text)',
    border: 'none',
    $: {
        '&:hover': {
            backgroundColor: 'color-mix(in srgb, var(--accent) 85%, black)',
            borderColor: 'transparent'
        }
    }
})

export let statusStyle = style('statusInfo', {
    color: 'var(--muted)'
})

export let errorStyle = style('statusError', {
    color: 'var(--danger)',
    fontWeight: 500
})
