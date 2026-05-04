import { Icon, Menu, NotifyIcon } from "not-the-systray"
import open from "open"
import embeddedIcon from "./icon.ico" with { type: "file" }
import { file } from "bun"
import { iconPath } from "./paths"
import { getServerBaseUrl } from "./settings/settings-repository"
import { canCheckForUpdates, checkForUpdateNow } from "./update-check"

let notifyIcon: NotifyIcon | null = null
let pendingUpdate: { version: string; restart: () => void } | null = null
let isCheckingForUpdate = false

export async function setupNotificationIcon() {
    if (process.platform == 'win32') {
        let iconFile = file(iconPath)
        await iconFile.write(file(embeddedIcon))

        notifyIcon = new NotifyIcon({
            icon: Icon.load(iconPath, Icon.large),
            tooltip: "WebCaster",
            async onSelect(event) {
                if (event.rightButton) {
                    let items: Menu.ItemInput[] = [
                        { id: 1, text: "Open in browser" },
                        { separator: true }
                    ]

                    if (canCheckForUpdates())
                        items.push({ id: 4, text: isCheckingForUpdate ? "Checking for updates..." : "Check for updates", disabled: isCheckingForUpdate })

                    if (pendingUpdate)
                        items.push({ id: 3, text: `Restart to update (v${pendingUpdate.version})` })

                    if (canCheckForUpdates() || pendingUpdate)
                        items.push({ separator: true })

                    items.push({ id: 2, text: "Quit" })

                    let selectedId = await new Menu(items).show(event.mouseX, event.mouseY)

                    if (selectedId == 1)
                        open(getServerBaseUrl())

                    if (selectedId == 2)
                        quitApp()

                    if (selectedId == 3 && pendingUpdate)
                        pendingUpdate.restart()

                    if (selectedId == 4)
                        void checkForUpdateFromMenu()
                } else {
                    open(getServerBaseUrl())
                }
            }
        })

        process.on('exit', cleanup)
        process.on('SIGINT', quitApp)
        process.on('SIGTERM', quitApp)

        function quitApp() {
            cleanup()
            process.exit(0)
        }

        function cleanup() {
            notifyIcon?.remove()
        }
    }
}

export function setUpdateAvailable(version: string, restart: () => void) {
    pendingUpdate = { version, restart }
    notifyIcon?.update({
        notification: {
            title: 'WebCaster update ready',
            text: `Version ${version} downloaded. Right-click the tray icon to restart.`,
            sound: true
        }
    })
}

export function showUpdateStatusNotification(title: string, text: string) {
    notifyIcon?.update({
        notification: {
            title,
            text,
            sound: true
        }
    })
}

async function checkForUpdateFromMenu() {
    if (isCheckingForUpdate)
        return

    try {
        isCheckingForUpdate = true
        let readyVersion = pendingUpdate?.version
        let result = await checkForUpdateNow()

        if (result.status == 'update-ready') {
            if (readyVersion) {
                showUpdateStatusNotification(
                    'WebCaster update ready',
                    `Version ${readyVersion} is ready to install. Right-click the tray icon to restart.`
                )
            }
        } else if (result.status == 'up-to-date') {
            showUpdateStatusNotification(
                'WebCaster is up to date',
                `Version ${result.currentVersion} is installed.`
            )
        } else {
            showUpdateStatusNotification(
                'Could not check for updates',
                'Try again later.'
            )
        }
    } catch {
        showUpdateStatusNotification(
            'Could not check for updates',
            'Try again later.'
        )
    } finally {
        isCheckingForUpdate = false
    }
}
