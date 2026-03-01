import { router } from "../trpc/trpc"
import { login, logout, status } from "./auth-procedures"

export let auth = router({
    auth: {
        status,
        login,
        logout
    }
})