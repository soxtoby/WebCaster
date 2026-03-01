import { procedure } from "../trpc/trpc"
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

        let previous = getServerSettings()
        saveServerSettings(input.server)

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