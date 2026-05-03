import { createHash } from "crypto"
import { appendFile, copyFile, mkdir, readFile, rm, writeFile } from "fs/promises"
import { dirname } from "path"
import { spawn } from "child_process"
import { parseArgs } from "util"

let RETRY_MS = 20_000
let RETRY_DELAY_MS = 500
let RELAUNCH_SURVIVAL_MS = 3_000

export async function updateApp() {
    let options = readOptions()

    await mkdir(dirname(options.log), { recursive: true })
    await log(options, 'Update helper started')

    try {
        await waitForExit(options, options.pid)
        await backupCurrentExe(options)
        await replaceCurrentExe(options)
        await verifyInstalledExe(options)
        await writeStatus(options, true, `Version ${options.version} installed.`)
        let relaunched = await relaunchAndVerify(options)

        if (relaunched) {
            await cleanupSuccessfulUpdate(options)
            await log(options, 'Update completed')
        } else {
            await rollback(options, 'Relaunched app did not stay running')
        }
    } catch (error) {
        await rollback(options, error instanceof Error ? error.message : String(error))
    }
}

type UpdateOptions = {
    pid: number
    current: string
    new: string
    backup: string
    expectedSha256: string
    log: string
    status: string
    version: string
}

function readOptions(): UpdateOptions {
    let { values } = parseArgs({
        options: {
            'update': { type: 'boolean' },
            pid: { type: 'string' },
            current: { type: 'string' },
            new: { type: 'string' },
            backup: { type: 'string' },
            'expected-sha256': { type: 'string' },
            log: { type: 'string' },
            status: { type: 'string' },
            version: { type: 'string' }
        }
    })

    let pid = parseInt(required(values.pid, 'pid'), 10)
    if (!Number.isInteger(pid))
        throw new Error('Invalid pid')

    return {
        pid,
        current: required(values.current, 'current'),
        new: required(values.new, 'new'),
        backup: required(values.backup, 'backup'),
        expectedSha256: required(values['expected-sha256'], 'expected-sha256').toLowerCase(),
        log: required(values.log, 'log'),
        status: required(values.status, 'status'),
        version: required(values.version, 'version')
    }
}

function required(value: string | boolean | undefined, key: string) {
    if (!value)
        throw new Error(`Missing --${key}`)

    if (typeof value != 'string')
        throw new Error(`Invalid --${key}`)

    return value
}

async function waitForExit(options: UpdateOptions, pid: number) {
    await log(options, `Waiting for pid ${pid}`)

    while (isProcessRunning(pid))
        await sleep(RETRY_DELAY_MS)

    await sleep(1_000)
}

async function backupCurrentExe(options: UpdateOptions) {
    await copyFile(options.current, options.backup)
    await log(options, 'Backed up current executable')
}

async function replaceCurrentExe(options: UpdateOptions) {
    let started = Date.now()
    let lastError = ''

    while (Date.now() - started < RETRY_MS) {
        try {
            await copyFile(options.new, options.current)
            await log(options, 'Copied update executable')
            return
        } catch (error) {
            lastError = error instanceof Error ? error.message : String(error)
            await sleep(RETRY_DELAY_MS)
        }
    }

    throw new Error(`Failed to replace executable after 20 seconds: ${lastError}`)
}

async function verifyInstalledExe(options: UpdateOptions) {
    let actualSha256 = await sha256(options.current)
    if (actualSha256 != options.expectedSha256)
        throw new Error('Installed executable hash mismatch')

    await log(options, 'Verified installed executable hash')
}

async function relaunchAndVerify(options: UpdateOptions) {
    await log(options, 'Relaunching app')
    let child = spawn(options.current, [], {
        cwd: dirname(options.current),
        detached: true,
        stdio: 'ignore',
        windowsHide: true
    })

    if (!child.pid)
        return false

    child.unref()
    await sleep(RELAUNCH_SURVIVAL_MS)
    return isProcessRunning(child.pid)
}

async function rollback(options: UpdateOptions, reason: string) {
    await log(options, `Update failed: ${reason}`)

    try {
        await copyFile(options.backup, options.current)
        await log(options, 'Restored backup executable')
    } catch (error) {
        await log(options, `Rollback copy failed: ${error instanceof Error ? error.message : String(error)}`)
    }

    await writeStatus(options, false, 'Update failed; old version restored.')

    try {
        let child = spawn(options.current, [], {
            cwd: dirname(options.current),
            detached: true,
            stdio: 'ignore',
            windowsHide: true
        })
        child.unref()
        await log(options, 'Relaunched old version')
    } catch (error) {
        await log(options, `Failed to relaunch old version: ${error instanceof Error ? error.message : String(error)}`)
    }
}

async function cleanupSuccessfulUpdate(options: UpdateOptions) {
    await rm(options.new, { force: true })
    await rm(`${options.new}.sha256`, { force: true })
    await rm(options.backup, { force: true })
}

async function sha256(path: string) {
    let bytes = await readFile(path)
    return createHash('sha256').update(bytes).digest('hex')
}

async function writeStatus(options: UpdateOptions, ok: boolean, message: string) {
    await writeFile(options.status, JSON.stringify({
        ok,
        version: options.version,
        message,
        time: new Date().toISOString()
    }, null, 4))
}

async function log(options: UpdateOptions, message: string) {
    await appendFile(options.log, `${new Date().toISOString()} ${message}\n`)
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

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}
