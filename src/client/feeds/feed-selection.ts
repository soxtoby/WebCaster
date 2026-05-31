import { useEffect, useMemo } from "react"
import { type FeedListItem } from "./feed-collections"

export function useFeedSelection(
    feeds: FeedListItem[],
    routedFeedSlug: string | null,
    isCreating: boolean,
    replaceFeedRoute: (feed: FeedListItem | null) => void
) {
    let selectedFeed = useMemo(() => feeds.find(feed => feed.podcastSlug == routedFeedSlug) ?? null, [feeds, routedFeedSlug])

    useEffect(() => {
        if (isCreating)
            return

        if (selectedFeed)
            return

        let fallbackFeed = feeds.at(0)
        if (fallbackFeed)
            replaceFeedRoute(fallbackFeed)
        else
            replaceFeedRoute(null)
    }, [feeds, isCreating, selectedFeed, replaceFeedRoute])

    return selectedFeed
}
