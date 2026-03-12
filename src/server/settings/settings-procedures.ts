import { updatePassword } from "../auth/auth"
import { restartServer } from "../serve"
import { procedure } from "../trpc/trpc"
import { getServerBaseUrl, getServerSettings, listImageDescriptionSettings, listProviderSettings, saveImageDescriptionSettings, saveProviderSettings, saveServerSettings } from "./settings-repository"
import { SettingsInput } from "./settings-types"

export const get = procedure
    .query(() => ({
        settings: listProviderSettings(),
        imageDescription: listImageDescriptionSettings(),
        server: getServerSettings()
    }))

export const save = procedure
    .input(SettingsInput)
    .mutation(({ input }) => {
        saveProviderSettings(input.settings)
        saveImageDescriptionSettings(input.imageDescription)

        if (input.server.password)
            updatePassword(input.server.password)

        let previous = getServerSettings()
        saveServerSettings({
            protocol: input.server.protocol,
            hostname: input.server.hostname,
            port: input.server.port,
            listenOnAllInterfaces: input.server.listenOnAllInterfaces,
            passwordConfigured: previous.passwordConfigured
        })

        let changed = previous.protocol != input.server.protocol
            || previous.hostname != input.server.hostname
            || previous.port != input.server.port
            || previous.listenOnAllInterfaces != input.server.listenOnAllInterfaces
        let redirectUrl: string | null = null

        if (changed) {
            redirectUrl = getServerBaseUrl()
            let listenAddress = input.server.listenOnAllInterfaces ? '0.0.0.0' : input.server.hostname

            setTimeout(() => restartServer(listenAddress, input.server.port), 500)
        }

        return {
            settings: listProviderSettings(),
            imageDescription: listImageDescriptionSettings(),
            server: getServerSettings(),
            redirectUrl
        }
    })