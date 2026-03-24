import { router } from "../trpc/trpc"
import { addArticle, cancelEpisode, create, deleteFeed, episodeTranscript, episodes, generateEpisode, list, regenerateEpisodeTranscript, removeArticle, setEpisodeVoice, update, updateEpisodeTranscript } from "./feed-procedures"

export let feeds = router({
    feeds: {
        list,
        episodes,
        episodeTranscript,
        regenerateEpisodeTranscript,
        updateEpisodeTranscript,
        setEpisodeVoice,
        generateEpisode,
        cancelEpisode,
        addArticle,
        removeArticle,
        create,
        update,
        delete: deleteFeed
    }
})

