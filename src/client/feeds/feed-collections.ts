import { queryCollectionOptions } from "@tanstack/query-db-collection"
import { createCollection } from "@tanstack/react-db"
import { QueryClient } from "@tanstack/react-query"
import type { Feed } from "../../server/db/schema"

export let queryClient = new QueryClient()

export const feedCollection = createCollection(queryCollectionOptions<Feed>({
    queryClient,
    queryKey: ['feeds'],
    getKey: (feed) => feed.id.toString(),
    queryFn: async () => {
        let response = await fetch('/api/feeds')
        if (!response.ok)
            throw new Error('Failed to load feeds')

        let json = await response.json() as { feeds: Feed[] }
        return json.feeds
    },
    onInsert: async ({ transaction }) => {
        let feed = transaction.mutations[0].modified
        let response = await fetch('/api/feeds', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(feed)
        })
        if (!response.ok)
            throw new Error(await readError(response))
    },
    onUpdate: async ({ transaction }) => {
        let { original, modified } = transaction.mutations[0]
        let response = await fetch(`/api/feeds/${original.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(modified)
        })
        if (!response.ok)
            throw new Error(await readError(response))
    },
    onDelete: async ({ transaction }) => {
        let feed = transaction.mutations[0].original
        let response = await fetch(`/api/feeds/${feed.id}`, {
            method: 'DELETE'
        })
        if (!response.ok)
            throw new Error(await readError(response))
    }
}))

async function readError(response: Response) {
    try {
        let json = await response.json() as { error?: string }
        if (json.error)
            return json.error
    } catch { }
    
    return 'Request failed'
}