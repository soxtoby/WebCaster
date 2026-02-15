import { Icon, Menu, NotifyIcon } from "not-the-systray"
import open from "open"

export async function setupNotificationIcon(serverUrl: string) {
    if (process.platform == 'win32') {
        let menu = new Menu([
            {
                id: 1,
                text: "Open in browser"
            },
            {
                separator: true
            },
            {
                id: 2,
                text: "Quit"
            }
        ])

        let icon = new NotifyIcon({
            icon: Icon.loadBuiltin(Icon.ids.app, Icon.small),
            tooltip: "WebCaster",
            async onSelect(event) {
                if (event.rightButton) {
                    let selectedId = await menu.show(event.mouseX, event.mouseY)

                    if (selectedId == 1)
                        open(serverUrl)

                    if (selectedId == 2)
                        quitApp()
                } else {
                    open(serverUrl)
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
            icon.remove()
        }
    }
}