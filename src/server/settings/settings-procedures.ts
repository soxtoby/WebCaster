import { updatePassword } from "../auth/auth"
import { object, pipe, string, trim } from "valibot"
import { resumeQueuedEpisodeGeneration } from "../feeds/feed-podcast"
import { restartServer } from "../serve"
import { getVoiceboxStatus, startVoicebox } from "../tts/voicebox-runtime"
import { procedure } from "../trpc/trpc"
import { getEpisodeGenerationSettings, getServerBaseUrl, getServerSettings, getVoiceboxSettings, listImageDescriptionSettings, listProviderSettings, saveEpisodeGenerationSettings, saveImageDescriptionSettings, saveProviderSettings, saveServerSettings, saveVoiceboxSettings } from "./settings-repository"
import { SettingsInput } from "./settings-types"

let VoiceboxRuntimeInput = object({
    baseUrl: pipe(string(), trim()),
    location: pipe(string(), trim())
})

export const get = procedure
    .query(() => ({
        settings: listProviderSettings(),
        imageDescription: listImageDescriptionSettings(),
        episodeGeneration: getEpisodeGenerationSettings(),
        voicebox: getVoiceboxSettings(),
        server: getServerSettings()
    }))

export const save = procedure
    .input(SettingsInput)
    .mutation(({ input }) => {
        saveProviderSettings(input.settings)
        saveImageDescriptionSettings(input.imageDescription)
        saveEpisodeGenerationSettings(input.episodeGeneration)
        saveVoiceboxSettings(input.voicebox)
        resumeQueuedEpisodeGeneration()

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
            episodeGeneration: getEpisodeGenerationSettings(),
            voicebox: getVoiceboxSettings(),
            server: getServerSettings(),
            redirectUrl
        }
    })

export const voiceboxStatus = procedure
    .input(VoiceboxRuntimeInput)
    .query(async ({ input }) => {
        return await getVoiceboxStatus(input.baseUrl, input.location)
    })

export const voiceboxStart = procedure
    .input(VoiceboxRuntimeInput)
    .mutation(async ({ input }) => {
        return await startVoicebox(input.baseUrl, input.location)
    })

