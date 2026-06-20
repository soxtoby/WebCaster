import { existsSync } from "fs"
import { join } from "path"
import { voiceboxDefaults } from "./voicebox"

export type VoiceboxStatus = {
    running: boolean
    location: string
    error: string
}

export async function getVoiceboxStatus(baseUrl: string, location: string): Promise<VoiceboxStatus> {
    let resolvedLocation = resolveVoiceboxLocation(location)
    let error = ''
    let running = false

    try {
        let response = await fetch(buildVoiceboxRequestUrl(baseUrl, '/profiles'), {
            headers: {
                Accept: 'application/json'
            },
            signal: AbortSignal.timeout(1000)
        })
        running = response.ok
        if (!running)
            error = `Voicebox returned ${response.status} ${response.statusText}`
    } catch {
        error = 'Voicebox is not responding'
    }

    return {
        running,
        location: resolvedLocation,
        error
    }
}

export async function startVoicebox(baseUrl: string, location: string): Promise<VoiceboxStatus> {
    let current = await getVoiceboxStatus(baseUrl, location)
    if (current.running)
        return current

    if (!current.location || !existsSync(current.location))
        return {
            ...current,
            error: current.location
                ? `Voicebox was not found at ${current.location}`
                : 'Voicebox location is not configured'
        }

    try {
        let process = Bun.spawn([current.location], {
            stdin: 'ignore',
            stdout: 'ignore',
            stderr: 'ignore'
        })
        process.unref()
    } catch (error) {
        let message = error instanceof Error ? error.message : 'Could not start Voicebox'
        return {
            ...current,
            error: message
        }
    }

    return await waitForVoicebox(baseUrl, current.location)
}

export function resolveVoiceboxLocation(location: string) {
    let trimmed = location.trim()
    if (trimmed)
        return trimmed

    let candidates = getDefaultVoiceboxLocations()
    return candidates.find(candidate => existsSync(candidate)) || candidates[0] || ''
}

async function waitForVoicebox(baseUrl: string, location: string) {
    for (let attempt = 0; attempt < 20; attempt++) {
        let status = await getVoiceboxStatus(baseUrl, location)
        if (status.running)
            return status

        await Bun.sleep(500)
    }

    return await getVoiceboxStatus(baseUrl, location)
}

function getDefaultVoiceboxLocations() {
    let localAppData = process.env.LOCALAPPDATA || ''
    let programFiles = process.env.ProgramFiles || ''
    let programFilesX86 = process.env['ProgramFiles(x86)'] || ''

    return [
        localAppData ? join(localAppData, 'Programs', 'Voicebox', 'Voicebox.exe') : '',
        localAppData ? join(localAppData, 'Programs', 'voicebox', 'Voicebox.exe') : '',
        programFiles ? join(programFiles, 'Voicebox', 'Voicebox.exe') : '',
        programFilesX86 ? join(programFilesX86, 'Voicebox', 'Voicebox.exe') : ''
    ].filter(Boolean)
}

function buildVoiceboxRequestUrl(baseUrl: string, endpoint: string) {
    let normalizedBase = (baseUrl.trim() || voiceboxDefaults.baseUrl).replace(/\/+$/, '')
    let normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    return normalizedBase + normalizedEndpoint
}
