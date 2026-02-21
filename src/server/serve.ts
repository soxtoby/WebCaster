import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import { serve } from "bun"
import index from "../client/index.html"
import { setupNotificationIcon } from "./notification-icon"
import { appRouter } from "./trpc/router"

let server = serve({
    development: true,
    port: 3000,
    routes: {
        '/': index,
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

await setupNotificationIcon(server.url.href)