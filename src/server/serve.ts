import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import { serve, type Server } from "bun"
import index from "../client/index.html"
import { buildPodcastFeedXml, getFeedByPodcastSlug, streamEpisodeAudio } from "./feeds/feed-podcast"
import { getServerBaseUrl } from "./settings/settings-repository"
import { appRouter } from "./trpc/app-router"
import { buildTrpcContext } from "./trpc/trpc"
import { streamVoicePreviewAudio } from "./tts/voice-preview"

let server: Server<undefined> | null = null

export function restartServer(hostname: string, port: number) {
    server?.stop()
    server = null
    let url = startServer(hostname, port)
    console.log(`🔄 Server restarted at ${url} (${getServerBaseUrl()})`)
}

export function startServer(hostname: string, port: number) {
    server ??= serve({
        development: process.env.NODE_ENV !== 'production',
        hostname,
        port,
        fetch(request) {
            let response = new Response('Not Found', { status: 404 })
            logRequest(request.method, request.url, response.status)
            return response
        },
        routes: {
            '/': index,
            '/feed/:slug': withRequestLogging(async (request) => {
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
            }),
            '/feed/:slug/:episodeKey': withRequestLogging(async (request) => {
                let slug = request.params.slug
                let episodeKey = request.params.episodeKey.trim().replace(/\.mp3$/i, '')
                if (!episodeKey)
                    return new Response('Episode not found', { status: 404 })

                let feed = await getFeedByPodcastSlug(slug)
                if (!feed)
                    return new Response('Feed not found', { status: 404 })

                return await streamEpisodeAudio(feed, episodeKey, { requestMethod: request.method })
            }),
            '/preview/:voiceId': withRequestLogging(async (request) => {
                return await streamVoicePreviewAudio(request.params.voiceId)
            }),
            '/api/:procedure': withRequestLogging((request) => {
                return fetchRequestHandler({
                    endpoint: '/api',
                    req: request,
                    router: appRouter,
                    createContext: (opts) => buildTrpcContext(opts.req, opts.resHeaders)
                })
            })
        }
    })

    return server.url
}

function withRequestLogging<TRequest extends Request>(handler: (request: TRequest) => Response | Promise<Response>) {
    return async (request: TRequest) => {
        try {
            let response = await handler(request)
            logRequest(request.method, request.url, response.status)
            return response
        } catch (error) {
            logRequest(request.method, request.url, 500)
            throw error
        }
    }
}

function logRequest(method: string, url: string, status: number) {
    console.log(`${method} ${url} ${status}`)
}