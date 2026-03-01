import { TRPCError, initTRPC } from "@trpc/server"
import { isApiAuthenticated, isPasswordRequired } from "../auth/auth"

export type TrpcContext = {
    req: Request
    resHeaders: Headers
    authenticated: boolean
    passwordRequired: boolean
}

let t = initTRPC.context<TrpcContext>().create()

export let router = t.router
export let publicProcedure = t.procedure
export let procedure = t.procedure.use(({ ctx, next }) => {
    if (ctx.passwordRequired && !ctx.authenticated)
        throw new TRPCError({ code: 'UNAUTHORIZED' })

    return next()
})
export let mergeRouters = t.mergeRouters

export function buildTrpcContext(req: Request, resHeaders: Headers): TrpcContext {
    return {
        req,
        resHeaders,
        authenticated: isApiAuthenticated(req),
        passwordRequired: isPasswordRequired()
    }
}