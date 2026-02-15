import { serve } from "bun";
import index from "../client/index.html";
import { setupNotificationIcon } from "./notification-icon";

let server = serve({
    development: true,
    port: 3000,
    routes: {
        '/': index
    }
})

console.log(`🚀 Server running at ${server.url}`)

await setupNotificationIcon(server.url.href)