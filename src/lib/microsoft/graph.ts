import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

export const MICROSOFT_SCOPES = [
  'openid',
  'profile',
  'offline_access',
  'User.Read',
  'Contacts.Read',
  'Calendars.ReadWrite',
].join(' ')

export const MICROSOFT_REFRESH_COOKIE = 'ema_ms_refresh'
export const MICROSOFT_STATE_COOKIE = 'ema_ms_oauth_state'

function required(name: 'MICROSOFT_TENANT_ID' | 'MICROSOFT_CLIENT_ID' | 'MICROSOFT_CLIENT_SECRET') {
  const value = process.env[name]
  if (!value) throw new Error(`${name} ist nicht konfiguriert.`)
  return value
}

export function microsoftConfig() {
  return {
    tenantId: required('MICROSOFT_TENANT_ID'),
    clientId: required('MICROSOFT_CLIENT_ID'),
    clientSecret: required('MICROSOFT_CLIENT_SECRET'),
    redirectUri: process.env.MICROSOFT_REDIRECT_URI || 'https://app.ema-enterprise.de/api/microsoft/callback',
  }
}

function encryptionKey() {
  return createHash('sha256').update(microsoftConfig().clientSecret).digest()
}

export function sealRefreshToken(value: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv, tag, encrypted].map((part) => part.toString('base64url')).join('.')
}

export function unsealRefreshToken(value: string) {
  const [ivRaw, tagRaw, encryptedRaw] = value.split('.')
  if (!ivRaw || !tagRaw || !encryptedRaw) throw new Error('Ungültige Microsoft-Sitzung.')
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivRaw, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

type TokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope?: string
  token_type: string
  error?: string
  error_description?: string
}

async function tokenRequest(params: URLSearchParams): Promise<TokenResponse> {
  const { tenantId } = microsoftConfig()
  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
    cache: 'no-store',
  })
  const payload = await response.json() as TokenResponse
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || 'Microsoft-Anmeldung fehlgeschlagen.')
  }
  return payload
}

export async function exchangeAuthorizationCode(code: string) {
  const { clientId, clientSecret, redirectUri } = microsoftConfig()
  return tokenRequest(new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    scope: MICROSOFT_SCOPES,
  }))
}

export async function refreshMicrosoftToken(refreshToken: string) {
  const { clientId, clientSecret } = microsoftConfig()
  return tokenRequest(new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: MICROSOFT_SCOPES,
  }))
}

export async function graphFetch<T>(accessToken: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path.startsWith('https://') ? path : `https://graph.microsoft.com/v1.0${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  })

  if (response.status === 204) return undefined as T
  const payload = await response.json().catch(() => ({})) as any
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Microsoft Graph Fehler (${response.status})`)
  }
  return payload as T
}
