import { router } from "../trpc/trpc"
import { get, save, voiceboxStart, voiceboxStatus } from "./settings-procedures"

export let settings = router({
    settings: {
        get,
        save,
        voiceboxStatus,
        voiceboxStart
    }
})
