import { procedure } from "../trpc/trpc"
import { updatePassword } from "../auth/auth"
import { getServerBaseUrl, getServerSettings, listProviderSettings, saveProviderSettings, saveServerSettings } from "./settings-repository"
import { SettingsInput } from "./settings-types"

export const get = procedure
    .query(() => ({
        settings: listProviderSettings(),
        server: getServerSettings()
    }))

export const save = procedure
    .input(SettingsInput)
    .mutation(({ input }) => {
        saveProviderSettings(input.settings)

        if (input.server.password)
            updatePassword(input.server.password)

        let previous = getServerSettings()
        saveServerSettings({
            hostname: input.server.hostname,
            port: input.server.port,
            listenOnAllInterfaces: input.server.listenOnAllInterfaces,
            passwordConfigured: previous.passwordConfigured
        })

        let changed = previous.hostname != input.server.hostname
            || previous.port != input.server.port
            || previous.listenOnAllInterfaces != input.server.listenOnAllInterfaces
        let redirectUrl: string | null = null

        if (changed) {
            redirectUrl = getServerBaseUrl()
            let listenAddress = input.server.listenOnAllInterfaces ? '0.0.0.0' : input.server.hostname

            let { restartServer } = require("../serve") as typeof import("../serve")
            setTimeout(() => restartServer(listenAddress, input.server.port), 500)
        }

        return {
            settings: listProviderSettings(),
            server: getServerSettings(),
            redirectUrl
        }
    })