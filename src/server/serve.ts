import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import { serve } from "bun"
import index from "../client/index.html"
import { buildPodcastFeedXml, getFeedByPodcastSlug, startFeedPolling, streamEpisodeAudio } from "./feeds/feed-podcast"
import { setupNotificationIcon } from "./notification-icon"
import { appRouter } from "./trpc/app-router"
import { streamVoicePreviewAudio } from "./tts/voice-preview"
import { startUpdateChecker } from "./updater"

let server = serve({
    development: true,
    port: 3000,
    routes: {
        '/': index,
        '/feed/:slug': async (request) => {
            let slug = request.params.slug.replace(/\.xml$/, '')
            let feed = await getFeedByPodcastSlug(slug)
            if (!feed)
                return new Response('Feed not found', { status: 404 })

            let baseUrl = new URL(request.url).origin
            let xml = await buildPodcastFeedXml(feed, baseUrl)
            return new Response(xml, {
                headers: {
                    'content-type': 'application/rss+xml; charset=utf-8'
                }
            })
        },
        '/feed/:slug/:episodeKey': async (request) => {
            let slug = request.params.slug
            let episodeKey = request.params.episodeKey.trim().replace(/\.mp3$/i, '')
            if (!episodeKey)
                return new Response('Episode not found', { status: 404 })

            let feed = await getFeedByPodcastSlug(slug)
            if (!feed)
                return new Response('Feed not found', { status: 404 })

            let baseUrl = new URL(request.url).origin
            return await streamEpisodeAudio(feed, episodeKey, baseUrl)
        },
        '/preview/:voiceId': async (request) => {
            return await streamVoicePreviewAudio(request.params.voiceId)
        },
        '/api/:procedure': (request) => {
            return fetchRequestHandler({
                endpoint: '/api',
                req: request,
                router: appRouter,
                createContext: () => ({})
            })
        }
    }
})

console.log(`🚀 Server running at ${server.url}`)

startFeedPolling(server.url.href)

await setupNotificationIcon(server.url.href)

startUpdateChecker()