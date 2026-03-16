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
        let embeddedScripts = new Map(Bun.embeddedFiles
            .map(f => [(f as BunFile).name!, f] as const)
            .filter(([name]) => name.startsWith('drizzle/') && name.endsWith('.sql')))

        let loaded = await Promise.all(pending
            .map(async e => ({
                entry: e,
                rawSql: await readScript(e.tag, embeddedScripts),
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

function readScript(name: string, embeddedScripts: Map<string, Blob>) {
    let blob = embeddedScripts.get(`drizzle/${name}.sql`)
        ?? Bun.file(`./drizzle/${name}.sql`)
    return blob.text()
}