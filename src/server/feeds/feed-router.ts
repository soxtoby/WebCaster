import { router } from "../trpc/trpc"
import { addArticle, create, deleteFeed, episodeTranscript, episodes, list, regenerateEpisodeTranscript, setEpisodeVoice, update, updateEpisodeTranscript } from "./feed-procedures"

export let feeds = router({
    feeds: {
        list,
        episodes,
        episodeTranscript,
        regenerateEpisodeTranscript,
        updateEpisodeTranscript,
        setEpisodeVoice,
        addArticle,
        create,
        update,
        delete: deleteFeed
    }
})

