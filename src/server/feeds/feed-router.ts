import { router } from "../trpc/trpc"
import { create, deleteFeed, episodeTranscript, episodes, list, regenerateEpisodeTranscript, setEpisodeVoice, update } from "./feed-procedures"

export let feeds = router({
    feeds: {
        list,
        episodes,
        episodeTranscript,
        regenerateEpisodeTranscript,
        setEpisodeVoice,
        create,
        update,
        delete: deleteFeed
    }
})

