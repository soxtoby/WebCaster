import { getGender } from "gender-detection-from-name"
import { type VoiceGender } from "../settings/settings-types"

export function detectGenderFromName(name: string): VoiceGender {
    let token = name.trim().split(/\s+/).filter(Boolean)[0]
    if (!token)
        return 'unknown'

    return getGender(token)
}
