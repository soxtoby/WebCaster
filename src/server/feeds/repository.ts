import { db } from "./db"

type Feed = {
    id: number
    name: string
    rssUrl: string
    voice: string
    language: string
    createdAt: string
    updatedAt: string
}

type FeedInput = {
    name: string
    rssUrl: string
    voice: string
    language: string
}

type FeedRow = {
    id: number
    name: string
    rss_url: string
    voice: string
    language: string
    created_at: string
    updated_at: string
}

export function listFeeds() {
    let rows = db.query(`
        SELECT id, name, rss_url, voice, language, created_at, updated_at 
        FROM feeds 
        ORDER BY id DESC`)
        .all() as FeedRow[]
    return rows.map(mapFeedRow)
}

export function getFeedById(id: number) {
    let row = db.query(`
        SELECT id, name, rss_url, voice, language, created_at, updated_at 
        FROM feeds 
        WHERE id = ?`)
        .get(id) as FeedRow | null
    if (row)
        return mapFeedRow(row)

    return null
}

export function createFeed(input: FeedInput) {
    db.query('INSERT INTO feeds (name, rss_url, voice, language) VALUES (?, ?, ?, ?)').run(input.name, input.rssUrl, input.voice, input.language)
    let created = db.query(`
        SELECT id, name, rss_url, voice, language, created_at, updated_at 
        FROM feeds 
        WHERE id = last_insert_rowid()`)
        .get() as FeedRow | null
    if (created)
        return mapFeedRow(created)

    throw new Error('Failed to create feed')
}

export function updateFeedById(id: number, input: FeedInput) {
    db.query(`
        UPDATE feeds 
        SET name = ?, rss_url = ?, voice = ?, language = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?`)
        .run(input.name, input.rssUrl, input.voice, input.language, id)
    return getFeedById(id)
}

export function deleteFeedById(id: number) {
    let result = db.query(`
        DELETE FROM feeds 
        WHERE id = ?`)
        .run(id)
    return result.changes > 0
}

function mapFeedRow(row: FeedRow): Feed {
    return {
        id: row.id,
        name: row.name,
        rssUrl: row.rss_url,
        voice: row.voice,
        language: row.language,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    }
}