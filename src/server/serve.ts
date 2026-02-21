import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import { serve } from "bun"
import index from "../client/index.html"
import { buildPodcastFeedXml, getFeedByPodcastSlug, startFeedPolling, streamEpisodeAudio } from "./feeds/feed-podcast"
import { setupNotificationIcon } from "./notification-icon"
import { appRouter } from "./trpc/app-router"

let server = serve({
    development: true,
    port: 3000,
    routes: {
        '/': index,
        '/podcast/:slug': async (request) => {
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
        '/audio/:slug/:episodeId': async (request) => {
            let slug = request.params.slug.replace(/\.xml$/, '')
            let episodeIdRaw = request.params.episodeId || ''
            let episodeId = Number(episodeIdRaw)
            if (!Number.isInteger(episodeId) || episodeId <= 0)
                return new Response('Episode not found', { status: 404 })

            let feed = await getFeedByPodcastSlug(slug)
            if (!feed)
                return new Response('Feed not found', { status: 404 })

            let baseUrl = new URL(request.url).origin
            return await streamEpisodeAudio(feed, episodeId, baseUrl)
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