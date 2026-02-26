import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import { migrate } from "drizzle-orm/bun-sqlite/migrator"
import { mkdir } from "node:fs/promises"
import { dbPath } from "../paths"
import { dirname } from "path"

await mkdir(dirname(dbPath), { recursive: true })

export const db = new Database(dbPath, { create: true })
export const database = drizzle(db)

migrate(database, { migrationsFolder: 'drizzle' })