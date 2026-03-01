import { auth } from "../auth/auth-router"
import { feeds } from "../feeds/feed-router"
import { settings } from "../settings/settings-router"
import { tts } from "../tts/tts-router"
import { mergeRouters } from "./trpc"

export let appRouter = mergeRouters(auth, feeds, settings, tts)
export type AppRouter = typeof appRouter