import { join } from "node:path"

let appDataDirectory = join(process.env.APPDATA || process.env.LOCALAPPDATA || 'data', 'WebCaster')
export let iconPath = join(appDataDirectory, 'icon.ico')
export let dbPath = join(appDataDirectory, 'webcaster.sqlite')
export let voicePreviewsDirectory = join(appDataDirectory, 'voices')
export let episodesDirectory = join(appDataDirectory, 'episodes')

export let updateDir = join(appDataDirectory, 'update')
export let updateExePath = join(updateDir, 'WebCaster.exe')

export let audioContentTypes = {
	mp3: 'audio/mpeg',
	wav: 'audio/wav'
} as const

export type AudioFileExtension = keyof typeof audioContentTypes
export let supportedAudioFileExtensions = Object.keys(audioContentTypes) as AudioFileExtension[]

export function voicePreviewPath(voiceId: string, extension: AudioFileExtension = 'mp3') {
	return join(voicePreviewsDirectory, `${sanitizeFileName(voiceId)}.${extension}`)
}

export function episodePath(podcastSlug: string, episodeKey: string, extension: AudioFileExtension = 'mp3') {
	return join(podcastDirectory(podcastSlug), `${episodeKey}.${extension}`)
}

export function podcastDirectory(podcastSlug: string) {
	return join(episodesDirectory, podcastSlug)
}

function sanitizeFileName(name: string) {
	return name.replace(/[<>:"/\\|?*]/g, '_')
}