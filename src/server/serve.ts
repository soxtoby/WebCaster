import { serve } from "bun";
import index from "../client/index.html";

let server = serve({
    development: true,
    port: 3000,
    routes: {
        '/': index
    }
})

console.log(`🚀 Server running at ${server.url}`)