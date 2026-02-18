import { sql, type InferSelectModel } from "drizzle-orm"
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export type Feed = InferSelectModel<typeof feedsTable>
export const feedsTable = sqliteTable('feeds', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    rssUrl: text('rss_url').notNull(),
    description: text('description'),
    imageUrl: text('image_url'),
    voice: text('voice').notNull(),
    language: text('language').notNull(),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
})

export type Article = InferSelectModel<typeof articlesTable>
export const articlesTable = sqliteTable('articles', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    feedId: integer('feed_id').notNull().references(() => feedsTable.id, { onDelete: 'cascade' }),
    guid: text('guid'),
    sourceUrl: text('source_url').notNull(),
    title: text('title').notNull(),
    summary: text('summary'),
    audioUrl: text('audio_url'),
    status: text('status').notNull().default('pending'),
    publishedAt: text('published_at'),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
})