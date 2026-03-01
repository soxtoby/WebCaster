import { Icon, Menu, NotifyIcon } from "not-the-systray"
import open from "open"
import embeddedIcon from "./icon.ico" with { type: "file" }
import { file } from "bun"
import { iconPath } from "./paths"
import { getServerBaseUrl } from "./settings/settings-repository"

let notifyIcon: NotifyIcon | null = null
let pendingUpdate: { version: string; restart: () => void } | null = null

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

                    if (pendingUpdate) {
                        items.push({ id: 3, text: `Restart to update (v${pendingUpdate.version})` })
                        items.push({ separator: true })
                    }

                    items.push({ id: 2, text: "Quit" })

                    let selectedId = await new Menu(items).show(event.mouseX, event.mouseY)

                    if (selectedId == 1)
                        open(getServerBaseUrl())

                    if (selectedId == 2)
                        quitApp()

                    if (selectedId == 3 && pendingUpdate)
                        pendingUpdate.restart()
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