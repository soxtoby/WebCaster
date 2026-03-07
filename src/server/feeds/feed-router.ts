import { router } from "../trpc/trpc"
import { create, deleteFeed, episodes, list, setEpisodeVoice, update } from "./feed-procedures"

export let feeds = router({
    feeds: {
        list,
        episodes,
        setEpisodeVoice,
        create,
        update,
        delete: deleteFeed
    }
})

