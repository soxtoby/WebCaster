import { writeFileSync } from "node:fs"
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { spawn } from "child_process"
import { CURRENT_VERSION } from "./version"
import { setUpdateAvailable } from "./notification-icon"
import { updateDir, updateExePath } from "./paths"

let GITHUB_REPO = 'soxtoby/WebCaster'

let CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000
let pendingUpdateVersion: string | null = null

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

function canCheckForUpdates() {
    return process.execPath.toLowerCase().endsWith('webcaster.exe')
}

async function checkForUpdate(): Promise<UpdateCheckResult> {
    if (!canCheckForUpdates()) {
        return {
            status: 'unsupported',
            currentVersion: CURRENT_VERSION
        }
    }

    if (pendingUpdateVersion && isNewerVersion(pendingUpdateVersion, CURRENT_VERSION)) {
        return {
            status: 'update-ready',
            currentVersion: CURRENT_VERSION,
            latestVersion: pendingUpdateVersion
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

        let asset = release.assets.find(a => a.name === 'WebCaster.exe')
        if (!asset) {
            return {
                status: 'failed',
                currentVersion: CURRENT_VERSION,
                latestVersion
            }
        }

        let downloaded = await downloadUpdate(asset.browser_download_url)
        if (downloaded) {
            pendingUpdateVersion = latestVersion
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

async function downloadUpdate(url: string): Promise<boolean> {
    try {
        let res = await fetch(url)
        if (!res.ok) return false

        await mkdir(updateDir, { recursive: true })
        let buffer = await res.arrayBuffer()
        await writeFile(updateExePath, Buffer.from(buffer))
        return true
    } catch {
        return false
    }
}

function applyUpdate() {
    let newExePath = updateExePath
    let currentExePath = process.execPath
    let tempDir = process.env.TEMP || process.env.TMP || updateDir
    let scriptPath = join(tempDir, 'webcaster-update.ps1')
    let logPath = join(updateDir, 'update.log')
    let powershellPath = join(process.env.SystemRoot || 'C:/Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    let commandShell = process.env.ComSpec || join(process.env.SystemRoot || 'C:/Windows', 'System32', 'cmd.exe')

    let script = `
        $ErrorActionPreference = 'Stop'
        $pidToWait = ${process.pid}
        $newExe = '${escapeForPowerShellLiteral(newExePath)}'
        $currentExe = '${escapeForPowerShellLiteral(currentExePath)}'
        $logPath = '${escapeForPowerShellLiteral(logPath)}'

        function Write-Log([string] $message) {
            Add-Content -Path $logPath -Value "$(Get-Date -Format o) $message"
        }

        Write-Log 'Update helper started'

        while (Get-Process -Id $pidToWait -ErrorAction SilentlyContinue) {
            Start-Sleep -Milliseconds 500
        }

        Start-Sleep -Seconds 1

        $copied = $false
        for ($attempt = 1; $attempt -le 20 -and -not $copied; $attempt++) {
            try {
                Copy-Item -Path $newExe -Destination $currentExe -Force
                $copied = $true
                Write-Log "Copied update on attempt $attempt"
            } catch {
                Write-Log "Copy failed on attempt $($attempt): $($_.Exception.Message)"
                Start-Sleep -Seconds 1
            }
        }

        if (-not $copied) {
            Write-Log 'Failed to replace executable'
            exit 1
        }

        try {
            Start-Process -FilePath $currentExe -WorkingDirectory (Split-Path -Parent $currentExe)
            Write-Log 'Restarted app'
        } catch {
            Write-Log "Restart failed: $($_.Exception.Message)"
            exit 1
        }
    `

    writeFileSync(scriptPath, script, 'utf8')

    let startCommand = `start "" /min "${powershellPath}" -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "${scriptPath}"`

    try {
        let child = spawn(commandShell, ['/d', '/s', '/c', startCommand], {
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

function isNewerVersion(latest: string, current: string): boolean {
    let parse = (v: string) => v.split('.').map(n => parseInt(n, 10))
    let [lMaj = 0, lMin = 0, lPatch = 0] = parse(latest)
    let [cMaj = 0, cMin = 0, cPatch = 0] = parse(current)
    if (lMaj !== cMaj) return lMaj > cMaj
    if (lMin !== cMin) return lMin > cMin
    return lPatch > cPatch
}

function escapeForPowerShellLiteral(value: string) {
    return value.replace(/'/g, "''")
}
