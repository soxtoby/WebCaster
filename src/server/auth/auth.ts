import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "crypto"
import { eq, sql } from "drizzle-orm"
import { database } from "../db"
import { appSettingsTable } from "../db/schema"

let passwordHashCache: string | null
let sessionSecretCache: string | null

let passwordHashKey = 'auth.passwordHash'
let sessionSecretKey = 'auth.sessionSecret'
let sessionCookieName = 'webcaster_session'
let sessionTtlMs = 1000 * 60 * 60 * 24 * 7

export function isPasswordRequired() {
    let hash = getPasswordHash()
    return !!hash
}

export function updatePassword(password: string) {
    let value = password.trim()
    if (!value)
        return

    let hash = hashPassword(value)
    setAppSetting(passwordHashKey, hash)
    passwordHashCache = hash
}

export function verifyPassword(password: string) {
    let hash = getPasswordHash()
    if (!hash)
        return true

    let parsed = parsePasswordHash(hash)
    if (!parsed)
        return false

    let derived = scryptSync(password, parsed.salt, 64)
    return timingSafeEqual(derived, parsed.hash)
}

export function isApiAuthenticated(request: Request) {
    if (!isPasswordRequired())
        return true

    let token = getCookie(request, sessionCookieName)
    if (!token)
        return false

    let [expiresAtRaw, nonce, signature] = token.split('.')
    if (!expiresAtRaw || !nonce || !signature)
        return false

    let expectedPayload = `${expiresAtRaw}.${nonce}`
    let expectedSignature = sign(expectedPayload)
    let left = Buffer.from(signature)
    let right = Buffer.from(expectedSignature)
    if (left.length != right.length)
        return false

    if (!timingSafeEqual(left, right))
        return false

    let expiresAt = Number(expiresAtRaw)
    if (!Number.isFinite(expiresAt))
        return false

    return expiresAt > Date.now()
}

export function createSessionCookie() {
    let expiresAt = Date.now() + sessionTtlMs
    let nonce = randomBytes(16).toString('base64url')
    let payload = `${expiresAt}.${nonce}`
    let signature = sign(payload)
    let token = `${payload}.${signature}`
    return buildCookie(token, Math.floor(sessionTtlMs / 1000))
}

export function clearSessionCookie() {
    return `${sessionCookieName}=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0`
}

function buildCookie(token: string, maxAgeSeconds: number) {
    let secure = process.env.NODE_ENV == 'production' ? '; Secure' : ''
    return `${sessionCookieName}=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${maxAgeSeconds}${secure}`
}

function sign(payload: string) {
    let secret = getOrCreateSessionSecret()
    return createHmac('sha256', secret).update(payload).digest('base64url')
}

function getOrCreateSessionSecret() {
    if (sessionSecretCache)
        return sessionSecretCache

    let existing = getAppSetting(sessionSecretKey)
    if (existing) {
        sessionSecretCache = existing
        return existing
    }

    let generated = randomBytes(32).toString('base64url')
    setAppSetting(sessionSecretKey, generated)
    sessionSecretCache = generated
    return generated
}

function getPasswordHash() {
    if (passwordHashCache)
        return passwordHashCache

    passwordHashCache = getAppSetting(passwordHashKey)
    return passwordHashCache
}

function getCookie(request: Request, name: string) {
    let header = request.headers.get('cookie') || ''
    let encodedName = `${name}=`

    for (let part of header.split(';')) {
        let item = part.trim()
        if (item.startsWith(encodedName))
            return item.slice(encodedName.length)
    }

    return ''
}

function hashPassword(password: string) {
    let salt = randomBytes(16).toString('base64url')
    let hash = scryptSync(password, salt, 64).toString('base64url')
    return `${salt}:${hash}`
}

function parsePasswordHash(value: string) {
    let [salt, hash] = value.split(':')
    if (!salt || !hash)
        return null

    return {
        salt,
        hash: Buffer.from(hash, 'base64url')
    }
}

function getAppSetting(key: string) {
    let row = database
        .select({ value: appSettingsTable.value })
        .from(appSettingsTable)
        .where(eq(appSettingsTable.key, key))
        .get()

    return row?.value || null
}

function setAppSetting(key: string, value: string) {
    database
        .insert(appSettingsTable)
        .values({ key, value })
        .onConflictDoUpdate({
            target: appSettingsTable.key,
            set: {
                value,
                updatedAt: sql`CURRENT_TIMESTAMP`
            }
        })
        .run()
}