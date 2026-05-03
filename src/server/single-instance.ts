import { closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync, type PathLike } from "node:fs"
import { dirname } from "node:path"
import open from "open"
import { instanceLockPath } from "./paths"

let lockFd: number | null = null

export async function ensureSingleInstance() {
    if (tryAcquireLock())
        return

    let { getServerBaseUrl } = await import("./settings/settings-repository")
    await open(getServerBaseUrl())
    process.exit(0)
}

function tryAcquireLock() {
    mkdirSync(dirname(instanceLockPath), { recursive: true })

    if (existsSync(instanceLockPath)) {
        let pid = readLockPid(instanceLockPath)
        if (pid && isProcessRunning(pid))
            return false

        try {
            unlinkSync(instanceLockPath)
        } catch {
            return false
        }
    }

    try {
        lockFd = openSync(instanceLockPath, 'wx')
        writeFileSync(lockFd, String(process.pid))
        process.on('exit', releaseInstanceLock)
        process.on('SIGINT', () => {
            releaseInstanceLock()
            process.exit(0)
        })
        process.on('SIGTERM', () => {
            releaseInstanceLock()
            process.exit(0)
        })
        return true
    } catch {
        return false
    }
}

function readLockPid(path: PathLike) {
    try {
        let raw = readFileSync(path, 'utf8').trim()
        let pid = parseInt(raw, 10)
        return Number.isInteger(pid) ? pid : null
    } catch {
        return null
    }
}

function isProcessRunning(pid: number) {
    try {
        process.kill(pid, 0)
        return true
    } catch (error) {
        let err = error as NodeJS.ErrnoException
        return err.code == 'EPERM'
    }
}

function releaseInstanceLock() {
    if (lockFd != null) {
        try {
            closeSync(lockFd)
            unlinkSync(instanceLockPath)
        } catch {
        }
        lockFd = null
    }
}
