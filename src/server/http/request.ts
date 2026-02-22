import { parse, type BaseIssue, type BaseSchema, type InferOutput } from "valibot"

export async function fetchJson<const TSchema extends BaseSchema<unknown, unknown, BaseIssue<unknown>>>(
    description: string,
    schema: TSchema,
    baseUrl: string,
    endpoint: string,
    requestInit?: RequestInit
): Promise<InferOutput<TSchema>> {
    let response = await fetchResponse(description, baseUrl, endpoint, requestInit)
    return parse(schema, await response.json())
}

export async function fetchStream(
    description: string,
    baseUrl: string,
    endpoint: string,
    requestInit?: RequestInit
): Promise<ReadableStream<Uint8Array>> {
    let response = await fetchResponse(description, baseUrl, endpoint, requestInit)
    if (!response.body)
        throw new Error(`${description} request failed: no response body`)

    return response.body
}

export async function fetchResponse(
    description: string,
    baseUrl: string,
    endpoint: string,
    requestInit?: RequestInit
): Promise<Response> {
    let response = await fetch(buildRequestUrl(baseUrl, endpoint), requestInit)
    if (!response.ok)
        throw new Error(`${description} request failed: ${response.status} ${response.statusText}`)

    return response
}

function buildRequestUrl(baseUrl: string, endpoint: string) {
    let normalizedBase = baseUrl.trim().replace(/\/+$/, '')
    let normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    return normalizedBase + normalizedEndpoint
}