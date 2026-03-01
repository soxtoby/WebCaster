import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import { serve } from "bun"
import { createServer } from "net"
import index from "../client/index.html"
import { buildPodcastFeedXml, getFeedByPodcastSlug, startFeedPolling, streamEpisodeAudio } from "./feeds/feed-podcast"
import { setupNotificationIcon } from "./notification-icon"
import { getServerBaseUrl, getServerSettings, saveServerSettings } from "./settings/settings-repository"
import { defaultServerSettings } from "./settings/settings-types"
import { appRouter } from "./trpc/app-router"
import { buildTrpcContext } from "./trpc/trpc"
import { streamVoicePreviewAudio } from "./tts/voice-preview"
import { startUpdateChecker } from "./updater"

let settings = getServerSettings()

if (settings.port == null) {
    settings.port = await findFreePort()
    saveServerSettings(settings)
}

let server = startServer(
    settings.listenOnAllInterfaces ? '0.0.0.0' : settings.hostname,
    settings.port
)

console.log(`🚀 Server running at ${server.url} (${getServerBaseUrl()})`)

startFeedPolling()

await setupNotificationIcon()

startUpdateChecker()

export function restartServer(listenAddr: string, port: number) {
    server.stop()
    server = startServer(listenAddr, port)
    console.log(`🔄 Server restarted at ${server.url} (${getServerBaseUrl()})`)
}

function startServer(hostname: string, port: number) {
    return serve({
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
}

async function findFreePort(): Promise<number> {
    if (await isPortAvailable(defaultServerSettings.port))
        return defaultServerSettings.port

    for (let port = 1100; port <= 65535; port++) {
        if (await isPortAvailable(port))
            return port
    }

    throw new Error('No free port found')
}

function isPortAvailable(port: number): Promise<boolean> {
    return new Promise(resolve => {
        let srv = createServer()
        srv.once('error', () => resolve(false))
        srv.listen(port, '0.0.0.0', () => {
            srv.close(() => resolve(true))
        })
    })
}
