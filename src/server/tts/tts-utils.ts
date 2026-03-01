import { getGender } from "gender-detection-from-name"
import { type VoiceGender } from "../settings/settings-types"

export function detectGenderFromName(name: string, description = ''): VoiceGender {
    let normalizedDescription = description.toLowerCase()
    if (/\bfemale\b/.test(normalizedDescription) && !/\bmale\b/.test(normalizedDescription))
        return 'female'

    if (/\bmale\b/.test(normalizedDescription) && !/\bfemale\b/.test(normalizedDescription))
        return 'male'

    let token = name.trim().split(/\s+/).filter(Boolean)[0]
    if (!token)
        return 'unknown'

    return getGender(token)
}
