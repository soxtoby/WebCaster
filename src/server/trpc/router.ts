import { feeds } from "../feeds/feed-router"
import { mergeRouters } from "./trpc"

export let appRouter = mergeRouters(feeds)
export type AppRouter = typeof appRouter