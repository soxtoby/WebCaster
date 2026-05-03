import { join } from "node:path"

let appDataDirectory = join(process.env.APPDATA || process.env.LOCALAPPDATA || 'data', 'WebCaster')
export let iconPath = join(appDataDirectory, 'icon.ico')
export let dbPath = join(appDataDirectory, 'webcaster.sqlite')
export let voicePreviewsDirectory = join(appDataDirectory, 'voices')
export let episodesDirectory = join(appDataDirectory, 'episodes')

export let updateDir = join(appDataDirectory, 'update')
export let updateExePath = join(updateDir, 'WebCaster.exe')
export let updateShaPath = join(updateDir, 'WebCaster.exe.sha256')
export let updateBackupPath = join(updateDir, 'WebCaster.exe.backup')
export let updateHelperPath = join(updateDir, 'WebCaster.Update.exe')
export let updateLogPath = join(updateDir, 'update.log')
export let updateStatusPath = join(updateDir, 'last-update.json')
export let instanceLockPath = join(appDataDirectory, 'webcaster.lock')

export function voicePreviewPath(voiceId: string) {
	return join(voicePreviewsDirectory, `${sanitizeFileName(voiceId)}.mp3`)
}

export function episodePath(podcastSlug: string, episodeKey: string) {
	return join(podcastDirectory(podcastSlug), `${episodeKey}.mp3`)
}

export function podcastDirectory(podcastSlug: string) {
	return join(episodesDirectory, podcastSlug)
}

function sanitizeFileName(name: string) {
	return name.replace(/[<>:"/\\|?*]/g, '_')
}
