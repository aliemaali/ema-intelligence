import { cookies } from 'next/headers'
import {
  MICROSOFT_REFRESH_COOKIE,
  refreshMicrosoftToken,
  sealRefreshToken,
  unsealRefreshToken,
} from './graph'

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 90,
}

export function clearMicrosoftSession() {
  cookies().set(MICROSOFT_REFRESH_COOKIE, '', { ...COOKIE_OPTIONS, maxAge: 0 })
}

export function saveMicrosoftRefreshToken(refreshToken: string) {
  cookies().set(MICROSOFT_REFRESH_COOKIE, sealRefreshToken(refreshToken), COOKIE_OPTIONS)
}

export async function getMicrosoftAccessToken() {
  const sealed = cookies().get(MICROSOFT_REFRESH_COOKIE)?.value
  if (!sealed) return null

  try {
    const refreshToken = unsealRefreshToken(sealed)
    const token = await refreshMicrosoftToken(refreshToken)
    if (token.refresh_token) saveMicrosoftRefreshToken(token.refresh_token)
    return token.access_token
  } catch {
    clearMicrosoftSession()
    return null
  }
}
