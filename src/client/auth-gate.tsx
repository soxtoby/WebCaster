import { type ReactNode, type SubmitEvent, useEffect, useState } from "react"
import { classes, style } from "stylemap"
import { api } from "./api"

export function AuthGate(props: { children: ReactNode }) {
    let [loading, setLoading] = useState(true)
    let [passwordRequired, setPasswordRequired] = useState(false)
    let [authenticated, setAuthenticated] = useState(false)
    let [password, setPassword] = useState('')
    let [error, setError] = useState('')
    let [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        void checkStatus()
    }, [])

    if (loading)
        return <div className={classes(screenStyle)}>
            <p className={classes(messageStyle)}>Loading...</p>
        </div>

    if (!passwordRequired || authenticated)
        return props.children

    return <div className={classes(screenStyle)}>
        <form className={classes(cardStyle)} onSubmit={onSubmit}>
            <h1 className={classes(titleStyle)}>Enter password</h1>
            <p className={classes(subtitleStyle)}>WebCaster is locked. Enter the server password to continue.</p>
            <input
                className={classes(inputStyle)}
                type="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder="Password"
                autoFocus
                autoComplete="current-password"
            />
            {error ? <p className={classes(errorStyle)}>{error}</p> : null}
            <button className={classes(buttonStyle)} type="submit" disabled={isSubmitting || !password.trim()}>
                {isSubmitting ? "Signing in..." : "Sign in"}
            </button>
        </form>
    </div>

    async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault()
        setError('')

        try {
            setIsSubmitting(true)
            await api.auth.login.mutate({ password: password.trim() })

            setAuthenticated(true)
            setPassword('')
        } catch {
            setError('Invalid password')
        } finally {
            setIsSubmitting(false)
        }
    }

    async function checkStatus() {
        try {
            let state = await api.auth.status.query()
            setAuthenticated(state.authenticated)
            setPasswordRequired(state.passwordRequired)
        } catch {
            setAuthenticated(false)
            setPasswordRequired(true)
        } finally {
            setLoading(false)
        }
    }
}

let screenStyle = style('authScreen', {
    minHeight: '100dvh',
    display: 'grid',
    placeItems: 'center',
    background: 'var(--bg)',
    color: 'var(--text)',
    padding: 20
})

let cardStyle = style('authCard', {
    width: '100%',
    maxWidth: 360,
    display: 'grid',
    gap: 12,
    padding: 20,
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--panel)'
})

let titleStyle = style('authTitle', {
    margin: 0,
    fontSize: 20,
    fontWeight: 600
})

let subtitleStyle = style('authSubtitle', {
    margin: 0,
    color: 'var(--muted)',
    fontSize: 14,
    lineHeight: 1.4
})

let inputStyle = style('authInput', {
    width: '100%',
    border: '1px solid var(--border)',
    borderRadius: 8,
    background: 'var(--bg)',
    color: 'var(--text)',
    padding: '10px 12px',
    fontSize: 14,
    outline: 'none',
    $: {
        '&:focus': {
            borderColor: 'var(--accent)'
        }
    }
})

let buttonStyle = style('authButton', {
    width: '100%',
    border: 0,
    borderRadius: 8,
    background: 'var(--accent)',
    color: 'white',
    padding: '10px 12px',
    fontWeight: 600,
    cursor: 'pointer',
    $: {
        '&:disabled': {
            opacity: 0.6,
            cursor: 'not-allowed'
        }
    }
})

let errorStyle = style('authError', {
    margin: 0,
    fontSize: 13,
    color: 'var(--danger)'
})

let messageStyle = style('authMessage', {
    margin: 0,
    color: 'var(--muted)'
})
