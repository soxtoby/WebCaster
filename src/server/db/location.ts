import { join } from "node:path"

export let appDataDirectory = join(process.env.APPDATA || process.env.LOCALAPPDATA || 'data', 'WebCaster')
export let dbPath = join(appDataDirectory, 'webcaster.sqlite')

export function resolvePreviewPath(previewKey: string) {
	return join(appDataDirectory, 'voice-previews', `${previewKey}.mp3`)
}
