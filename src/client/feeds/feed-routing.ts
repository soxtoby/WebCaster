import { useCallback, useEffect, useState } from "react"
import { type FeedListItem } from "./feed-collections"

export function useFeedRouting(onRouteChanged: () => void) {
    let [routedFeedSlug, setRoutedFeedSlug] = useState<string | null>(() => getRoutedFeedSlug())
    let pushFeedRoute = useCallback((feed: FeedListItem | null) => {
        setRoutedFeedSlug(feed?.podcastSlug ?? null)
        pushBrowserFeedRoute(feed)
    }, [])

    let replaceFeedRoute = useCallback((feed: FeedListItem | null) => {
        setRoutedFeedSlug(feed?.podcastSlug ?? null)
        replaceBrowserFeedRoute(feed)
    }, [])

    useEffect(() => {
        function handlePopState() {
            setRoutedFeedSlug(getRoutedFeedSlug())
            onRouteChanged()
        }

        window.addEventListener('popstate', handlePopState)

        return () => {
            window.removeEventListener('popstate', handlePopState)
        }
    }, [onRouteChanged])

    return {
        routedFeedSlug,
        pushFeedRoute,
        replaceFeedRoute
    }
}

function getRoutedFeedSlug() {
    if (typeof window == 'undefined')
        return null

    let match = /^\/feeds\/([^/]+)$/.exec(window.location.pathname)
    if (!match)
        return null

    try {
        return decodeURIComponent(match[1] ?? '')
    } catch {
        return null
    }
}

function pushBrowserFeedRoute(feed: FeedListItem | null) {
    updateFeedRoute(feed, 'push')
}

function replaceBrowserFeedRoute(feed: FeedListItem | null) {
    updateFeedRoute(feed, 'replace')
}

function updateFeedRoute(feed: FeedListItem | null, mode: 'push' | 'replace') {
    if (typeof window == 'undefined')
        return

    let url = feed?.podcastSlug ? `/feeds/${encodeURIComponent(feed.podcastSlug)}` : '/'
    if (window.location.pathname == url)
        return

    if (mode == 'push')
        window.history.pushState(null, '', url)
    else
        window.history.replaceState(null, '', url)
}
