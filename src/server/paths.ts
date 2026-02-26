import { join } from "node:path"

let appDataDirectory = join(process.env.APPDATA || process.env.LOCALAPPDATA || 'data', 'WebCaster')
export let iconPath = join(appDataDirectory, 'icon.ico')
export let dbPath = join(appDataDirectory, 'webcaster.sqlite')
export let voicePreviewsDirectory = join(appDataDirectory, 'voices')
export let episodesDirectory = join(appDataDirectory, 'episodes')

export function voicePreviewPath(voiceId: string) {
	return join(voicePreviewsDirectory, `${voiceId}.mp3`)
}

export function episodePath(podcastSlug: string, episodeKey: string) {
	return join(podcastDirectory(podcastSlug), `${episodeKey}.mp3`)
}

export function podcastDirectory(podcastSlug: string) {
	return join(episodesDirectory, podcastSlug)
}