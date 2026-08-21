import { createHash, randomBytes } from 'crypto'

export const PLAUD_STATE_COOKIE = 'ema_plaud_oauth_state'
export const PLAUD_VERIFIER_COOKIE = 'ema_plaud_oauth_verifier'
export const PLAUD_CLIENT_COOKIE = 'ema_plaud_oauth_client'

const PLAUD_MCP_BASE = 'https://mcp.plaud.ai'
const PLAUD_RESOURCE = `${PLAUD_MCP_BASE}/mcp`

type RegisteredClient = {
  client_id?: string
  client_secret?: string
  token_endpoint_auth_method?: string
}

export function createPkce() {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge, state: randomBytes(24).toString('base64url') }
}

async function jsonResponse<T>(response: Response, fallback: string): Promise<T> {
  const text = await response.text()
  let payload: any = {}
  try { payload = text ? JSON.parse(text) : {} } catch { payload = {} }
  if (!response.ok) throw new Error(payload.error_description || payload.error || fallback)
  return payload as T
}

export async function registerPlaudClient(redirectUri: string) {
  const response = await fetch(`${PLAUD_MCP_BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_name: 'EMA Intelligence',
      redirect_uris: [redirectUri],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    }),
    cache: 'no-store',
  })
  const client = await jsonResponse<RegisteredClient>(response, 'PLAUD-Verbindung konnte nicht vorbereitet werden.')
  if (!client.client_id) throw new Error('PLAUD hat keine gültige App-Kennung geliefert.')
  return client.client_id
}

export function plaudAuthorizationUrl(input: { clientId: string; redirectUri: string; challenge: string; state: string }) {
  const url = new URL(`${PLAUD_MCP_BASE}/authorize`)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', input.clientId)
  url.searchParams.set('redirect_uri', input.redirectUri)
  url.searchParams.set('code_challenge', input.challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('state', input.state)
  url.searchParams.set('resource', PLAUD_RESOURCE)
  return url
}

export type PlaudTokenResponse = {
  access_token: string
  refresh_token?: string
  token_type?: string
  expires_in?: number
}

async function tokenRequest(params: URLSearchParams) {
  const response = await fetch(`${PLAUD_MCP_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: params,
    cache: 'no-store',
  })
  const token = await jsonResponse<PlaudTokenResponse>(response, 'PLAUD-Anmeldung fehlgeschlagen.')
  if (!token.access_token) throw new Error('PLAUD hat kein Zugriffstoken geliefert.')
  return token
}

export function exchangePlaudCode(input: { code: string; clientId: string; redirectUri: string; verifier: string }) {
  return tokenRequest(new URLSearchParams({
    grant_type: 'authorization_code',
    code: input.code,
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    code_verifier: input.verifier,
    resource: PLAUD_RESOURCE,
  }))
}

export function refreshPlaudToken(refreshToken: string, clientId: string) {
  return tokenRequest(new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    resource: PLAUD_RESOURCE,
  }))
}
