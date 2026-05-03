import { createServer } from "net"
import { resetInterruptedEpisodeGeneration, startFeedPolling } from "./feeds/feed-podcast"
import { setupNotificationIcon } from "./notification-icon"
import { startServer } from "./serve"
import { getServerBaseUrl, getServerSettings, saveServerSettings } from "./settings/settings-repository"
import { defaultServerSettings } from "./settings/settings-types"
import { ensureSingleInstance } from "./single-instance"
import { showLastUpdateStatus, startUpdateChecker } from "./update-check"

export async function startApp() {
    await ensureSingleInstance()

    let settings = getServerSettings()

    if (settings.port == null) {
        settings.port = await findFreePort(defaultServerSettings.port)
        saveServerSettings(settings)
    }

    let url = startServer(settings.listenOnAllInterfaces ? '0.0.0.0' : settings.hostname, settings.port)

    console.log(`🚀 Server running at ${url} (${getServerBaseUrl()})`)

    await resetInterruptedEpisodeGeneration()

    startFeedPolling()

    await setupNotificationIcon()

    await showLastUpdateStatus()

    startUpdateChecker()
}

async function findFreePort(defaultPort: number): Promise<number> {
    if (await isPortAvailable(defaultPort))
        return defaultPort

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
