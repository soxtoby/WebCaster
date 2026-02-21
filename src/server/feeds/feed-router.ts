import { router } from "../trpc/trpc"
import { create, deleteFeed, episodes, list, update } from "./feed-procedures"

export let feeds = router({
    feeds: {
        list,
        episodes,
        create,
        update,
        delete: deleteFeed
    }
})