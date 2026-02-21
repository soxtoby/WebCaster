import { router } from "../trpc/trpc"
import { create, deleteFeed, list, update } from "./feed-procedures"

export let feeds = router({
    feeds: {
        list,
        create,
        update,
        delete: deleteFeed
    }
})