import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import { serve, type Server } from "bun"
import index from "../client/index.html"
import { buildPodcastFeedXml, getFeedByPodcastSlug, streamEpisodeAudio } from "./feeds/feed-podcast"
import { getServerBaseUrl } from "./settings/settings-repository"
import { appRouter } from "./trpc/app-router"
import { buildTrpcContext } from "./trpc/trpc"
import { streamVoicePreviewAudio } from "./tts/voice-preview"

let server: Server<undefined>

export function restartServer(hostname: string, port: number) {
    server?.stop()
    let url = startServer(hostname, port)
    console.log(`🔄 Server restarted at ${url} (${getServerBaseUrl()})`)
}

export function startServer(hostname: string, port: number) {
    server ??= serve({
        development: true,
        hostname,
        port,
        routes: {
            '/': index,
            '/feed/:slug': async (request) => {
                let slug = request.params.slug.replace(/\.xml$/, '')
                let feed = await getFeedByPodcastSlug(slug)
                if (!feed)
                    return new Response('Feed not found', { status: 404 })

                let xml = await buildPodcastFeedXml(feed)
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

                return await streamEpisodeAudio(feed, episodeKey)
            },
            '/preview/:voiceId': async (request) => {
                return await streamVoicePreviewAudio(request.params.voiceId)
            },
            '/api/:procedure': (request) => {
                return fetchRequestHandler({
                    endpoint: '/api',
                    req: request,
                    router: appRouter,
                    createContext: (opts) => buildTrpcContext(opts.req, opts.resHeaders)
                })
            }
        }
    })

    return server.url
}