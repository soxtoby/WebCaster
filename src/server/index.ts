import { createServer } from "net"
import { resetInterruptedEpisodeGeneration, startFeedPolling } from "./feeds/feed-podcast"
import { setupNotificationIcon } from "./notification-icon"
import { startServer } from "./serve"
import { getServerBaseUrl, getServerSettings, saveServerSettings } from "./settings/settings-repository"
import { defaultServerSettings } from "./settings/settings-types"
import { startUpdateChecker } from "./updater"

let settings = getServerSettings()

if (settings.port == null) {
    settings.port = await findFreePort()
    saveServerSettings(settings)
}

let url = startServer(settings.listenOnAllInterfaces ? '0.0.0.0' : settings.hostname, settings.port)

console.log(`🚀 Server running at ${url} (${getServerBaseUrl()})`)

await resetInterruptedEpisodeGeneration()

startFeedPolling()

await setupNotificationIcon()

startUpdateChecker()

async function findFreePort(): Promise<number> {
    if (await isPortAvailable(defaultServerSettings.port))
        return defaultServerSettings.port

    for (let port = 1100; port <= 65535; port++) {
        if (await isPortAvailable(port))
            return port
    }

    throw new Error('No free port found')
}

function isPortAvailable(port: number): Promise<boolean> {
    return new Promise(resolve => {
        let srv = createServer()
        srv.once('error', () => resolve(false))
        srv.listen(port, '0.0.0.0', () => {
            srv.close(() => resolve(true))
        })
    })
}
