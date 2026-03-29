import { queryCollectionOptions } from "@tanstack/query-db-collection"
import { createCollection } from "@tanstack/react-db"
import { QueryClient } from "@tanstack/react-query"
import type { Feed } from "../../server/db/schema"
import { api } from "../api"

globalThis.crypto.randomUUID ??= createUuidV4; // Required by tanstack db, but only available in secure context

export let queryClient = new QueryClient()

export type FeedWithEpisodes = Feed & { latestEpisodePublishedAt: string | null }

export const feedCollection = createCollection(queryCollectionOptions<FeedWithEpisodes>({
    queryClient,
    queryKey: ['feeds'],
    getKey: (feed) => feed.id.toString(),
    queryFn: async () => (await api.feeds.list.query()).feeds,
    onInsert: async ({ transaction }) => {
        let feed = transaction.mutations[0].modified
        return await api.feeds.create.mutate({
            name: feed.name,
            rssUrl: feed.rssUrl,
            voice: feed.voice,
            generationMode: feed.generationMode,
            showArchivedEpisodes: feed.showArchivedEpisodes,
            contentSource: feed.contentSource
        })
    },
    onUpdate: async ({ transaction }) => {
        let { original, modified } = transaction.mutations[0]
        return await api.feeds.update.mutate({
            id: original.id,
            name: modified.name,
            rssUrl: modified.rssUrl,
            voice: modified.voice,
            generationMode: modified.generationMode,
            showArchivedEpisodes: modified.showArchivedEpisodes,
            contentSource: modified.contentSource
        })
    },
    onDelete: async ({ transaction }) => {
        let feed = transaction.mutations[0].original
        return await api.feeds.delete.mutate({ id: feed.id })
    }
}))

function createUuidV4() {
    let bytes = new Uint8Array(16);
    let byte6 = bytes[6] ?? 0
    let byte8 = bytes[8] ?? 0
    bytes[6] = (byte6 & 0x0f) | 0x40
    bytes[8] = (byte8 & 0x3f) | 0x80
    let hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}` as const
}
