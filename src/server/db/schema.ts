import { sql, type InferSelectModel } from "drizzle-orm"
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export type TtsProviderSetting = InferSelectModel<typeof ttsProviderSettingsTable>
export const ttsProviderSettingsTable = sqliteTable('tts_provider_settings', {
    providerType: text('provider_type').primaryKey(),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
    apiKey: text('api_key').notNull().default(''),
    baseUrl: text('base_url'),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
})

export type TtsVoice = InferSelectModel<typeof ttsVoicesTable>
export const ttsVoicesTable = sqliteTable('tts_voices', {
    id: text('id').primaryKey(),
    provider: text('provider').notNull(),
    providerVoiceId: text('provider_voice_id').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    gender: text('gender').notNull(),
    updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
})

export type Feed = InferSelectModel<typeof feedsTable>
export const feedsTable = sqliteTable('feeds', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    rssUrl: text('rss_url').notNull(),
    description: text('description'),
    imageUrl: text('image_url'),
    voice: text('voice').notNull().references(() => ttsVoicesTable.id),
    generationMode: text('generation_mode').notNull().default('on_demand'),
    contentSource: text('content_source').notNull().default('feed_article'),
    podcastSlug: text('podcast_slug').notNull(),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, table => [
    uniqueIndex('feeds_podcast_slug_unique').on(table.podcastSlug)
])

export type Article = InferSelectModel<typeof articlesTable>
export const articlesTable = sqliteTable('articles', {
    feedId: integer('feed_id').notNull().references(() => feedsTable.id, { onDelete: 'cascade' }),
    episodeKey: text('episode_key').notNull().default(''),
    guid: text('guid'),
    sourceUrl: text('source_url').notNull(),
    title: text('title').notNull(),
    summary: text('summary'),
    content: text('content'),
    audioUrl: text('audio_url'),
    status: text('status').notNull().default('pending'),
    errorMessage: text('error_message'),
    generationMode: text('generation_mode'),
    contentSource: text('content_source'),
    lastGenerationAttemptAt: text('last_generation_attempt_at'),
    publishedAt: text('published_at'),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, table => [
    uniqueIndex('articles_feed_source_unique').on(table.feedId, table.sourceUrl),
    uniqueIndex('articles_feed_episode_key_unique').on(table.feedId, table.episodeKey)
])