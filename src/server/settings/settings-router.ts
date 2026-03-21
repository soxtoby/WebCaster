import { router } from "../trpc/trpc"
import { checkForUpdate, get, save } from "./settings-procedures"

export let settings = router({
    settings: {
        checkForUpdate,
        get,
        save
    }
})
