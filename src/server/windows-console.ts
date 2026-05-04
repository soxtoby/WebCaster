import { dlopen, ptr } from "bun:ffi"

/**
 * Workaround for Bun ignoring `hideConsole`: keep the executable as a console
 * app so terminal runs still block and show logs, but replace the Explorer-created
 * console process with a hidden detached child.
 * https://github.com/oven-sh/bun/issues/19916
 */
export function launchDetachedFromOwnWindowsConsole() {
    if (process.platform == 'win32') {
        let consoleWindow = kernel32.symbols.GetConsoleWindow()

        if (consoleWindow) {
            let count = getConsoleProcessCount()

            if (count == ownConsoleProcessCount) {
                Bun.spawn({
                    cmd: [process.execPath, backgroundArgument],
                    detached: true,
                    stdin: 'ignore',
                    stdout: 'ignore',
                    stderr: 'ignore',
                    windowsHide: true,
                })
                return true
            }
        }
    }

    return false
}

function getConsoleProcessCount() {
    let processIds = new Uint32Array(2)
    return kernel32.symbols.GetConsoleProcessList(ptr(processIds), processIds.length)
}

let ownConsoleProcessCount = 1
let backgroundArgument = '--background'

let kernel32 = dlopen('kernel32.dll', {
    GetConsoleWindow: {
        args: [],
        returns: 'ptr',
    },
    GetConsoleProcessList: {
        args: ['ptr', 'u32'],
        returns: 'u32',
    },
})
