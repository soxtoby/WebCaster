import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { spawn } from "node:child_process"
import { CURRENT_VERSION } from "./version"
import { setUpdateAvailable, showUpdateStatusNotification } from "./notification-icon"
import { updateBackupPath, updateDir, updateExePath, updateHelperPath, updateLogPath, updateShaPath, updateStatusPath } from "./paths"

let GITHUB_REPO = 'soxtoby/WebCaster'

let CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000
let MIN_EXE_BYTES = 10 * 1024 * 1024
let pendingUpdate: { version: string, sha256: string } | null = null

export type UpdateCheckResult = {
    status: 'unsupported' | 'up-to-date' | 'update-ready' | 'failed'
    currentVersion: string
    latestVersion?: string
}

export function startUpdateChecker() {
    if (!canCheckForUpdates())
        return

    setTimeout(async () => {
        await checkForUpdate()
        setInterval(() => {
            void checkForUpdate()
        }, CHECK_INTERVAL_MS)
    }, 60_000)
}

export async function checkForUpdateNow(): Promise<UpdateCheckResult> {
    return await checkForUpdate()
}

export async function showLastUpdateStatus() {
    if (!existsSync(updateStatusPath))
        return

    try {
        let raw = await readFile(updateStatusPath, 'utf8')
        let status = JSON.parse(raw) as { ok: boolean, version?: string, message?: string }
        let archivePath = `${updateStatusPath}.${Date.now()}`
        await rename(updateStatusPath, archivePath)

        if (status.ok) {
            showUpdateStatusNotification(
                'WebCaster updated',
                status.version ? `Version ${status.version} installed.` : 'Update installed.'
            )
        } else {
            showUpdateStatusNotification(
                'WebCaster update failed',
                status.message || 'Old version restored. See update.log for details.'
            )
        }
    } catch {
    }
}

export function canCheckForUpdates() {
    return process.execPath.toLowerCase().endsWith('webcaster.exe')
}

async function checkForUpdate(): Promise<UpdateCheckResult> {
    if (!canCheckForUpdates()) {
        return {
            status: 'unsupported',
            currentVersion: CURRENT_VERSION
        }
    }

    if (pendingUpdate && isNewerVersion(pendingUpdate.version, CURRENT_VERSION)) {
        return {
            status: 'update-ready',
            currentVersion: CURRENT_VERSION,
            latestVersion: pendingUpdate.version
        }
    }

    try {
        let res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
            headers: { 'User-Agent': 'WebCaster' }
        })
        if (!res.ok) {
            return {
                status: 'failed',
                currentVersion: CURRENT_VERSION
            }
        }

        let release = await res.json() as { tag_name: string; assets: { name: string; browser_download_url: string }[] }
        let latestVersion = release.tag_name.replace(/^v/, '')

        if (!isNewerVersion(latestVersion, CURRENT_VERSION)) {
            return {
                status: 'up-to-date',
                currentVersion: CURRENT_VERSION,
                latestVersion
            }
        }

        let asset = release.assets.find(a => a.name == 'WebCaster.exe')
        let shaAsset = release.assets.find(a => a.name == 'WebCaster.exe.sha256')
        if (!asset || !shaAsset) {
            return {
                status: 'failed',
                currentVersion: CURRENT_VERSION,
                latestVersion
            }
        }

        let downloaded = await downloadUpdate(asset.browser_download_url, shaAsset.browser_download_url)
        if (downloaded) {
            pendingUpdate = {
                version: latestVersion,
                sha256: downloaded
            }
            setUpdateAvailable(latestVersion, applyUpdate)
            return {
                status: 'update-ready',
                currentVersion: CURRENT_VERSION,
                latestVersion
            }
        }

        return {
            status: 'failed',
            currentVersion: CURRENT_VERSION,
            latestVersion
        }
    } catch {
        return {
            status: 'failed',
            currentVersion: CURRENT_VERSION
        }
    }
}

async function downloadUpdate(url: string, shaUrl: string): Promise<string | null> {
    try {
        let shaRes = await fetch(shaUrl)
        if (!shaRes.ok)
            return null

        let expectedSha256 = parseSha256(await shaRes.text())
        if (!expectedSha256)
            return null

        let res = await fetch(url)
        if (!res.ok)
            return null

        await mkdir(updateDir, { recursive: true })
        let buffer = await res.arrayBuffer()
        let bytes = Buffer.from(buffer)
        if (!isValidExe(bytes))
            return null

        let actualSha256 = createHash('sha256').update(bytes).digest('hex')
        if (actualSha256 != expectedSha256)
            return null

        await writeFile(updateExePath, bytes)
        await writeFile(updateShaPath, `${expectedSha256}  WebCaster.exe\n`)
        return expectedSha256
    } catch {
        return null
    }
}

function applyUpdate() {
    void launchUpdateHelper()
}

async function launchUpdateHelper() {
    if (!pendingUpdate)
        return

    try {
        await prepareUpdateHelper()
        let child = spawn(updateHelperPath, [
            '--update',
            '--pid', String(process.pid),
            '--current', process.execPath,
            '--new', updateExePath,
            '--backup', updateBackupPath,
            '--expected-sha256', pendingUpdate.sha256,
            '--log', updateLogPath,
            '--status', updateStatusPath,
            '--version', pendingUpdate.version
        ], {
            detached: true,
            stdio: 'ignore',
            windowsHide: true
        })
        child.unref()
        process.exit(0)
    } catch (error) {
        console.error('Failed to launch update helper', error)
    }
}

async function prepareUpdateHelper() {
    await mkdir(updateDir, { recursive: true })
    await copyFile(process.execPath, updateHelperPath)
}

function parseSha256(text: string) {
    let match = text.match(/\b[a-f0-9]{64}\b/i)
    return match ? match[0].toLowerCase() : null
}

function isValidExe(bytes: Buffer) {
    return bytes.length > MIN_EXE_BYTES
        && bytes[0] == 0x4d
        && bytes[1] == 0x5a
}

function isNewerVersion(latest: string, current: string): boolean {
    let parse = (v: string) => v.split('.').map(n => parseInt(n, 10))
    let [lMaj = 0, lMin = 0, lPatch = 0] = parse(latest)
    let [cMaj = 0, cMin = 0, cPatch = 0] = parse(current)
    if (lMaj != cMaj) return lMaj > cMaj
    if (lMin != cMin) return lMin > cMin
    return lPatch > cPatch
}
