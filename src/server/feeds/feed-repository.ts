import { desc, eq, sql } from "drizzle-orm"
import { database } from "../db"
import type { Feed } from "../db/schema"
import { articlesTable, feedsTable } from "../db/schema"
import type { FeedInput } from "./feed-types"

export type FeedListItem = Feed & {
    latestEpisodeAt: string | null
}

export function listFeeds() {
    let latestEpisodeAt = sql<string | null>`(
        select max(
            coalesce(
                ${articlesTable.publishedAt},
                replace(${articlesTable.createdAt}, ' ', 'T') || '.000Z'
            )
        )
        from ${articlesTable}
        where ${articlesTable.feedId} = ${feedsTable.id}
    )`

    return database
        .select({
            id: feedsTable.id,
            name: feedsTable.name,
            rssUrl: feedsTable.rssUrl,
            description: feedsTable.description,
            imageUrl: feedsTable.imageUrl,
            voice: feedsTable.voice,
            generationMode: feedsTable.generationMode,
            contentSource: feedsTable.contentSource,
            showArchivedEpisodes: feedsTable.showArchivedEpisodes,
            podcastSlug: feedsTable.podcastSlug,
            createdAt: feedsTable.createdAt,
            updatedAt: feedsTable.updatedAt,
            latestEpisodeAt
        })
        .from(feedsTable)
        .orderBy(desc(feedsTable.id))
        .all()
}

export function getFeedById(id: number) {
    let row = database
        .select()
        .from(feedsTable)
        .where(eq(feedsTable.id, id))
        .get()

    return row || null
}

export function createFeed(input: FeedInput & { description?: string | null; imageUrl?: string | null }) {
    let podcastSlug = generateUniqueSlug(input.name)
    let created = database
        .insert(feedsTable)
        .values({
            name: input.name,
            rssUrl: input.rssUrl,
            description: input.description ?? null,
            imageUrl: input.imageUrl ?? null,
            voice: input.voice,
            generationMode: input.generationMode,
            contentSource: input.contentSource,
            showArchivedEpisodes: input.showArchivedEpisodes,
            podcastSlug
        })
        .returning()
        .get()

    if (!created)
        throw new Error('Failed to create feed')

    return created
}

export function updateFeedById(id: number, input: FeedInput & { description?: string | null; imageUrl?: string | null }) {
    let updated = database
        .update(feedsTable)
        .set({
            name: input.name,
            rssUrl: input.rssUrl,
            description: input.description ?? null,
            imageUrl: input.imageUrl ?? null,
            voice: input.voice,
            generationMode: input.generationMode,
            contentSource: input.contentSource,
            showArchivedEpisodes: input.showArchivedEpisodes,
            updatedAt: sql`CURRENT_TIMESTAMP`
        })
        .where(eq(feedsTable.id, id))
        .returning()
        .get()

    if (!updated)
        return null

    return updated
}

function generateUniqueSlug(title: string): string {
    let base = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40) || 'feed'

    if (!slugExists(base))
        return base

    let counter = 2
    while (slugExists(`${base}-${counter}`))
        counter++

    return `${base}-${counter}`
}

function slugExists(slug: string) {
    let feed = database
        .select({ id: feedsTable.id })
        .from(feedsTable)
        .where(eq(feedsTable.podcastSlug, slug))
        .get()

    return feed != null
}

export function deleteFeedById(id: number) {
    let deleted = database
        .delete(feedsTable)
        .where(eq(feedsTable.id, id))
        .returning({ id: feedsTable.id })
        .get()
    return deleted != null
}
