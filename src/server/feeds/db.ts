import { Database } from "bun:sqlite"
import { mkdirSync } from "node:fs"
import { join } from "node:path"

let appDataPath = process.env.APPDATA || process.env.LOCALAPPDATA || 'data'
let dbDirectory = join(appDataPath, 'WebCaster')
let dbPath = join(dbDirectory, 'webcaster.sqlite')

mkdirSync(dbDirectory, { recursive: true })

export const db = new Database(dbPath, { create: true })

db.run(`
    CREATE TABLE IF NOT EXISTS feeds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        rss_url TEXT NOT NULL,
        voice TEXT NOT NULL,
        language TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
`)