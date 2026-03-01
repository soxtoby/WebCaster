import { createTRPCClient, httpBatchLink } from "@trpc/client"
import type { AppRouter } from "../server/trpc/app-router"

export let api = createTRPCClient<AppRouter>({
    links: [
        httpBatchLink({
            url: '/api',
            fetch(url, options) {
                return fetch(url, {
                    ...options,
                    credentials: 'same-origin'
                })
            }
        })
    ]
})