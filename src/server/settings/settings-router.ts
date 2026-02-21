import { router } from "../trpc/trpc"
import { get, save } from "./settings-procedures"

export let settings = router({
    settings: {
        get,
        save
    }
})
