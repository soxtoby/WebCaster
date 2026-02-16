import { join } from "node:path"

let appDataPath = process.env.APPDATA || process.env.LOCALAPPDATA || 'data'

export let dbDirectory = join(appDataPath, 'WebCaster')
export let dbPath = join(dbDirectory, 'webcaster.sqlite')