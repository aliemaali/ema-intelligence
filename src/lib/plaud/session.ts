import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { refreshPlaudToken } from './oauth'

type PlaudConnection = {
  user_id: string
  oauth_client_id: string
  encrypted_refresh_token: string
  encrypted_access_token: string | null
  access_token_expires_at: string | null
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) throw new Error('Die serverseitige Supabase-Konfiguration für PLAUD fehlt.')
  return createAdminClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

function encryptionKey() {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 32) throw new Error('AUTH_SECRET muss für die sichere PLAUD-Verbindung mindestens 32 Zeichen lang sein.')
  return createHash('sha256').update(`ema-plaud:${secret}`).digest()
}

function seal(value: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.')
}

function unseal(value: string) {
  const [ivRaw, tagRaw, encryptedRaw] = value.split('.')
  if (!ivRaw || !tagRaw || !encryptedRaw) throw new Error('Ungültige PLAUD-Sitzung.')
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivRaw, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(encryptedRaw, 'base64url')), decipher.final()]).toString('utf8')
}

function expiry(expiresIn = 3600) {
  return new Date(Date.now() + Math.max(60, expiresIn) * 1000).toISOString()
}

async function loadConnection(userId: string) {
  const { data, error } = await adminClient()
    .from('plaud_connections')
    .select('user_id,oauth_client_id,encrypted_refresh_token,encrypted_access_token,access_token_expires_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error(`PLAUD-Verbindung konnte nicht geladen werden: ${error.message}`)
  return data as PlaudConnection | null
}

export async function savePlaudConnection(userId: string, clientId: string, token: { access_token: string; refresh_token?: string; expires_in?: number }) {
  if (!token.refresh_token) throw new Error('PLAUD hat kein Aktualisierungstoken geliefert.')
  const now = new Date().toISOString()
  const { error } = await adminClient().from('plaud_connections').upsert({
    user_id: userId,
    oauth_client_id: clientId,
    encrypted_refresh_token: seal(token.refresh_token),
    encrypted_access_token: seal(token.access_token),
    access_token_expires_at: expiry(token.expires_in),
    connected_at: now,
    updated_at: now,
  }, { onConflict: 'user_id' })
  if (error) throw new Error(`PLAUD-Verbindung konnte nicht gespeichert werden: ${error.message}`)
}

export async function hasPlaudConnection(userId: string) {
  return Boolean(await loadConnection(userId))
}

export async function disconnectPlaudConnection(userId: string) {
  const { error } = await adminClient().from('plaud_connections').delete().eq('user_id', userId)
  if (error) throw new Error(`PLAUD-Verbindung konnte nicht getrennt werden: ${error.message}`)
}

export async function getPlaudAccessToken(userId: string) {
  const connection = await loadConnection(userId)
  if (!connection) return null
  const cachedExpiry = connection.access_token_expires_at ? new Date(connection.access_token_expires_at).getTime() : 0
  if (connection.encrypted_access_token && cachedExpiry > Date.now() + 2 * 60 * 1000) {
    try { return unseal(connection.encrypted_access_token) } catch { /* refresh below */ }
  }
  try {
    const refreshToken = unseal(connection.encrypted_refresh_token)
    const token = await refreshPlaudToken(refreshToken, connection.oauth_client_id)
    const now = new Date().toISOString()
    const { error } = await adminClient().from('plaud_connections').update({
      encrypted_refresh_token: seal(token.refresh_token || refreshToken),
      encrypted_access_token: seal(token.access_token),
      access_token_expires_at: expiry(token.expires_in),
      last_refreshed_at: now,
      updated_at: now,
    }).eq('user_id', userId)
    if (error) throw new Error(`PLAUD-Sitzung konnte nicht aktualisiert werden: ${error.message}`)
    return token.access_token
  } catch (error) {
    if (/invalid_grant|revoked|unauthorized|401/i.test(error instanceof Error ? error.message : '')) {
      await disconnectPlaudConnection(userId).catch(() => undefined)
    }
    throw error
  }
}
