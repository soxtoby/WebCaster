import { TRPCError } from "@trpc/server"
import { object, pipe, string, trim } from "valibot"
import { clearSessionCookie, createSessionCookie, verifyPassword } from "./auth"
import { publicProcedure } from "../trpc/trpc"

let LoginInput = object({
    password: pipe(string(), trim())
})

export let status = publicProcedure
    .query(({ ctx }) => ({
        authenticated: ctx.authenticated,
        passwordRequired: ctx.passwordRequired
    }))

export let login = publicProcedure
    .input(LoginInput)
    .mutation(({ ctx, input }) => {
        if (!verifyPassword(input.password))
            throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid password' })

        ctx.resHeaders.append('set-cookie', createSessionCookie())
        return { ok: true }
    })

export let logout = publicProcedure
    .mutation(({ ctx }) => {
        ctx.resHeaders.append('set-cookie', clearSessionCookie())
        return { ok: true }
    })