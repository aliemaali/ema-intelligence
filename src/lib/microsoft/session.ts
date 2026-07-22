import { createClient as createAdminClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import {
  MICROSOFT_REFRESH_COOKIE,
  refreshMicrosoftToken,
  sealRefreshToken,
  unsealRefreshToken,
} from './graph'

type MicrosoftProfile = {
  name?: string
  email?: string
}

type MicrosoftTokenCache = {
  accessToken?: string
  expiresIn?: number
}

type MicrosoftConnection = {
  user_id: string
  encrypted_refresh_token: string
  encrypted_access_token: string | null
  access_token_expires_at: string | null
  microsoft_name: string | null
  microsoft_email: string | null
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error('Die serverseitige Supabase-Konfiguration für Microsoft 365 fehlt.')
  }

  return createAdminClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function clearLegacyCookie() {
  try {
    cookies().set(MICROSOFT_REFRESH_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })
  } catch {
    // Cookie cleanup is best-effort. The persistent database connection is authoritative.
  }
}

function accessTokenExpiry(expiresIn = 3600) {
  return new Date(Date.now() + Math.max(60, expiresIn) * 1000).toISOString()
}

async function loadConnection(userId: string) {
  const { data, error } = await adminClient()
    .from('microsoft_connections')
    .select('user_id, encrypted_refresh_token, encrypted_access_token, access_token_expires_at, microsoft_name, microsoft_email')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new Error(`Microsoft-Verbindung konnte nicht geladen werden: ${error.message}`)
  return data as MicrosoftConnection | null
}

async function migrateLegacyCookie(userId: string) {
  const legacyToken = cookies().get(MICROSOFT_REFRESH_COOKIE)?.value
  if (!legacyToken) return null

  try {
    const refreshToken = unsealRefreshToken(legacyToken)
    await saveMicrosoftConnection(userId, refreshToken)
    return loadConnection(userId)
  } catch {
    clearLegacyCookie()
    return null
  }
}

export async function saveMicrosoftConnection(
  userId: string,
  refreshToken: string,
  profile: MicrosoftProfile = {},
  tokenCache: MicrosoftTokenCache = {},
) {
  const now = new Date().toISOString()
  const payload = {
    user_id: userId,
    encrypted_refresh_token: sealRefreshToken(refreshToken),
    encrypted_access_token: tokenCache.accessToken ? sealRefreshToken(tokenCache.accessToken) : null,
    access_token_expires_at: tokenCache.accessToken ? accessTokenExpiry(tokenCache.expiresIn) : null,
    microsoft_name: profile.name || null,
    microsoft_email: profile.email || null,
    updated_at: now,
    connected_at: now,
  }

  const { error } = await adminClient()
    .from('microsoft_connections')
    .upsert(payload, { onConflict: 'user_id' })

  if (error) throw new Error(`Microsoft-Verbindung konnte nicht gespeichert werden: ${error.message}`)
  clearLegacyCookie()
}

export async function updateMicrosoftProfile(userId: string, profile: MicrosoftProfile) {
  const { error } = await adminClient()
    .from('microsoft_connections')
    .update({
      microsoft_name: profile.name || null,
      microsoft_email: profile.email || null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  if (error) throw new Error(`Microsoft-Profil konnte nicht aktualisiert werden: ${error.message}`)
}

export async function disconnectMicrosoftConnection(userId: string) {
  const { error } = await adminClient()
    .from('microsoft_connections')
    .delete()
    .eq('user_id', userId)

  if (error) throw new Error(`Microsoft-Verbindung konnte nicht getrennt werden: ${error.message}`)
  clearLegacyCookie()
}

export async function getMicrosoftAccessToken(userId: string) {
  let connection = await loadConnection(userId)
  if (!connection) connection = await migrateLegacyCookie(userId)
  if (!connection) return null

  const cachedExpiry = connection.access_token_expires_at
    ? new Date(connection.access_token_expires_at).getTime()
    : 0

  // Keep a two-minute safety margin so a token cannot expire during a Graph request.
  if (connection.encrypted_access_token && cachedExpiry > Date.now() + 2 * 60 * 1000) {
    try {
      return unsealRefreshToken(connection.encrypted_access_token)
    } catch {
      // Fall through and rebuild the cache from the refresh token.
    }
  }

  try {
    const refreshToken = unsealRefreshToken(connection.encrypted_refresh_token)
    const token = await refreshMicrosoftToken(refreshToken)
    const now = new Date().toISOString()

    const update = {
      encrypted_refresh_token: sealRefreshToken(token.refresh_token || refreshToken),
      encrypted_access_token: sealRefreshToken(token.access_token),
      access_token_expires_at: accessTokenExpiry(token.expires_in),
      last_refreshed_at: now,
      updated_at: now,
    }

    const { error } = await adminClient()
      .from('microsoft_connections')
      .update(update)
      .eq('user_id', userId)

    if (error) throw new Error(`Microsoft-Sitzung konnte nicht aktualisiert werden: ${error.message}`)
    return token.access_token
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Microsoft-Sitzung konnte nicht erneuert werden.'

    if (/invalid_grant|AADSTS700082|AADSTS50173|revoked/i.test(message)) {
      await disconnectMicrosoftConnection(userId).catch(() => undefined)
    }

    throw error
  }
}
