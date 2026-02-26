import { writeFileSync } from "node:fs"
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { spawn } from "child_process"
import { CURRENT_VERSION } from "./version"
import { setUpdateAvailable } from "./notification-icon"
import { updateDir, updateExePath } from "./paths"

let GITHUB_REPO = 'soxtoby/WebCaster'

let CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000

export function startUpdateChecker() {
    if (!process.execPath.toLowerCase().endsWith('webcaster.exe'))
        return

    setTimeout(async () => {
        await checkForUpdate()
        setInterval(checkForUpdate, CHECK_INTERVAL_MS)
    }, 60_000)
}

async function checkForUpdate() {
    try {
        let res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
            headers: { 'User-Agent': 'WebCaster' }
        })
        if (!res.ok) return

        let release = await res.json() as { tag_name: string; assets: { name: string; browser_download_url: string }[] }
        let latestVersion = release.tag_name.replace(/^v/, '')

        if (!isNewerVersion(latestVersion, CURRENT_VERSION)) return

        let asset = release.assets.find(a => a.name === 'WebCaster.exe')
        if (!asset) return

        let downloaded = await downloadUpdate(asset.browser_download_url)
        if (downloaded)
            setUpdateAvailable(latestVersion, applyUpdate)
    } catch {
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
    let tempDir = process.env.TEMP || process.env.TMP || 'C:/Temp'
    let scriptPath = join(tempDir, 'webcaster-update.ps1')

    let newExePs = newExePath.replace(/\\/g, '/')
    let currentExePs = currentExePath.replace(/\\/g, '/')

    let script = `
        $pidToWait = ${process.pid}
        $newExe = '${newExePs}'
        $currentExe = '${currentExePs}'

        while (Get-Process -Id $pidToWait -ErrorAction SilentlyContinue) {
            Start-Sleep -Milliseconds 500
        }

        Start-Sleep -Milliseconds 500
        Copy-Item -Path $newExe -Destination $currentExe -Force
        Start-Process $currentExe
    `

    writeFileSync(scriptPath, script, 'utf8')

    let child = spawn('powershell.exe', [
        '-WindowStyle', 'Hidden',
        '-ExecutionPolicy', 'Bypass',
        '-File', scriptPath
    ], {
        detached: true,
        stdio: 'ignore'
    })
    child.unref()

    process.exit(0)
}

function isNewerVersion(latest: string, current: string): boolean {
    let parse = (v: string) => v.split('.').map(n => parseInt(n, 10))
    let [lMaj = 0, lMin = 0, lPatch = 0] = parse(latest)
    let [cMaj = 0, cMin = 0, cPatch = 0] = parse(current)
    if (lMaj !== cMaj) return lMaj > cMaj
    if (lMin !== cMin) return lMin > cMin
    return lPatch > cPatch
}
