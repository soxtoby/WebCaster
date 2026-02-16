import { serve } from "bun"
import index from "../client/index.html"
import { createFeed, deleteFeed, listFeeds, updateFeed } from "./feeds/handlers"
import { setupNotificationIcon } from "./notification-icon"

let server = serve({
    development: true,
    port: 3000,
    routes: {
        '/': index,
        '/api/feeds': {
            GET: listFeeds,
            POST: createFeed
        },
        '/api/feeds/:id': {
            PUT: updateFeed,
            DELETE: deleteFeed
        }
    }
})

console.log(`🚀 Server running at ${server.url}`)

await setupNotificationIcon(server.url.href)