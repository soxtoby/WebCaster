import { createTRPCClient, httpBatchLink } from "@trpc/client"
import type { AppRouter } from "../server/trpc/router"

export let api = createTRPCClient<AppRouter>({
    links: [
        httpBatchLink({ url: '/api' })
    ]
})