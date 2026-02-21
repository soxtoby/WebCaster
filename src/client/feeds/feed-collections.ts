import { queryCollectionOptions } from "@tanstack/query-db-collection"
import { createCollection } from "@tanstack/react-db"
import { QueryClient } from "@tanstack/react-query"
import type { Feed } from "../../server/db/schema"
import { api } from "../api"

export let queryClient = new QueryClient()

export const feedCollection = createCollection(queryCollectionOptions<Feed>({
    queryClient,
    queryKey: ['feeds'],
    getKey: (feed) => feed.id.toString(),
    queryFn: async () => (await api.feeds.list.query()).feeds,
    onInsert: async ({ transaction }) => {
        let feed = transaction.mutations[0].modified
        await api.feeds.create.mutate({
            name: feed.name,
            rssUrl: feed.rssUrl,
            voice: feed.voice,
            language: feed.language,
            generationMode: feed.generationMode,
            contentSource: feed.contentSource
        })
    },
    onUpdate: async ({ transaction }) => {
        let { original, modified } = transaction.mutations[0]
        await api.feeds.update.mutate({
            id: original.id,
            name: modified.name,
            rssUrl: modified.rssUrl,
            voice: modified.voice,
            language: modified.language,
            generationMode: modified.generationMode,
            contentSource: modified.contentSource
        })
    },
    onDelete: async ({ transaction }) => {
        let feed = transaction.mutations[0].original
        await api.feeds.delete.mutate({ id: feed.id })
    }
}))
