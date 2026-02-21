import { desc, eq, sql } from "drizzle-orm"
import { database } from "../db"
import { feedsTable } from "../db/schema"
import type { FeedInput } from "./feed-types"

export function listFeeds() {
    return database
        .select()
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
    let created = database
        .insert(feedsTable)
        .values({
            name: input.name,
            rssUrl: input.rssUrl,
            description: input.description ?? null,
            imageUrl: input.imageUrl ?? null,
            voice: input.voice,
            language: input.language
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
            language: input.language,
            updatedAt: sql`CURRENT_TIMESTAMP`
        })
        .where(eq(feedsTable.id, id))
        .returning()
        .get()

    if (!updated)
        return null

    return updated
}

export function deleteFeedById(id: number) {
    let deleted = database
        .delete(feedsTable)
        .where(eq(feedsTable.id, id))
        .returning({ id: feedsTable.id })
        .get()
    return deleted != null
}
