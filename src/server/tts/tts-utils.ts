import { getGender } from "gender-detection-from-name"
import { type VoiceGender } from "../settings/settings-types"

export function buildUrl(baseUrl: string, path: string) {
    let normalizedBase = baseUrl.trim().replace(/\/+$/, '')
    let normalizedPath = path.startsWith('/') ? path : `/${path}`
    return normalizedBase + normalizedPath
}

export function normalizeReportedGender(value: string | null): VoiceGender {
    if (!value)
        return 'unknown'

    let normalized = value.toLowerCase().trim()
    if (normalized == 'male' || normalized == 'man' || normalized == 'm')
        return 'male'

    if (normalized == 'female' || normalized == 'woman' || normalized == 'f')
        return 'female'

    return 'unknown'
}

export function detectGenderFromName(name: string): VoiceGender {
    let token = name.trim().split(/\s+/).filter(Boolean)[0]
    if (!token)
        return 'unknown'

    return getGender(token)
}
