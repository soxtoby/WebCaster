import { initTRPC } from "@trpc/server"

let t = initTRPC.create()

export let router = t.router
export let procedure = t.procedure
export let mergeRouters = t.mergeRouters