import { type BunFile } from "bun";
import type { Database } from 'bun:sqlite';
import { createHash } from 'crypto';
import journal from "../../../drizzle/meta/_journal.json" with { type: "json" };

export async function migrate(db: Database): Promise<void> {
    db.run(`
        CREATE TABLE IF NOT EXISTS __drizzle_migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
            hash text NOT NULL,
            created_at numeric
        )
    `)

    let lastApplied = db
        .query<{ created_at: number }, []>(
            `SELECT created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1`
        )
        .get()

    let pending = journal.entries
        .filter(e => !lastApplied || e.when > lastApplied.created_at)

    if (pending.length) {
        let loaded = await Promise.all(pending
            .map(async e => ({
                entry: e,
                rawSql: await readAsset(`${e.tag}.sql`, `./drizzle/${e.tag}.sql`),
            })))

        db.transaction(() => {
            for (let { entry, rawSql } of loaded) {
                let statements = rawSql.split(/\s*--> statement-breakpoint\s*/)
                let hash = createHash('sha256').update(rawSql).digest('hex')
                for (let stmt of statements) {
                    if (stmt.trim())
                        run(db, entry, stmt)
                }
                db.run(
                    `INSERT INTO __drizzle_migrations ("hash", "created_at") VALUES (?, ?)`,
                    [hash, entry.when])
            }
        })()
    }
}

function run(db: Database, entry: typeof journal.entries[number], stmt: string) {
    try {
        db.run(stmt)
    } catch (e) {
        console.error(`Failed to run statement in entry ${entry.tag}: ${stmt}`)
        throw e
    }
}

function readAsset(name: string, fallbackPath: string) {
    let blob = Bun.embeddedFiles.find(f => (f as BunFile).name == name)
    return blob?.text()
        ?? Bun.file(fallbackPath).text()
}