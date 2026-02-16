import { defineConfig } from "drizzle-kit"
import { dbPath } from "./src/server/db/location"

export default defineConfig({
    schema: './src/server/db/schema.ts',
    out: './drizzle',
    dialect: 'sqlite',
    dbCredentials: {
        url: dbPath
    }
})
