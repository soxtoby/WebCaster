import { procedure } from "../trpc/trpc"
import { listProviderSettings, saveProviderSettings } from "./settings-repository"
import { SettingsInput } from "./settings-types"

export const get = procedure
    .query(() => ({ settings: listProviderSettings() }))

export const save = procedure
    .input(SettingsInput)
    .mutation(({ input }) => {
        saveProviderSettings(input.settings)
        return { settings: listProviderSettings() }
    })