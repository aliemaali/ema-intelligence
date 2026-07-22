import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  exchangeAuthorizationCode,
  MICROSOFT_STATE_COOKIE,
  sealRefreshToken,
  MICROSOFT_REFRESH_COOKIE,
} from '@/lib/microsoft/graph'

export async function GET(request: NextRequest) {
  const destination = new URL('/microsoft', request.url)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    destination.pathname = '/login'
    return NextResponse.redirect(destination)
  }

  const error = request.nextUrl.searchParams.get('error')
  const errorDescription = request.nextUrl.searchParams.get('error_description')
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  const savedState = request.cookies.get(MICROSOFT_STATE_COOKIE)?.value

  if (error) {
    destination.searchParams.set('error', errorDescription || error)
    return NextResponse.redirect(destination)
  }

  if (!code || !state || !savedState || state !== savedState) {
    destination.searchParams.set('error', 'Die Microsoft-Anmeldung konnte nicht sicher bestätigt werden.')
    return NextResponse.redirect(destination)
  }

  try {
    const token = await exchangeAuthorizationCode(code)
    if (!token.refresh_token) throw new Error('Microsoft hat kein Aktualisierungstoken geliefert.')

    const response = NextResponse.redirect(new URL('/microsoft?connected=1', request.url))
    response.cookies.set(MICROSOFT_REFRESH_COOKIE, sealRefreshToken(token.refresh_token), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 90,
    })
    response.cookies.set(MICROSOFT_STATE_COOKIE, '', { path: '/', maxAge: 0 })
    return response
  } catch (tokenError) {
    destination.searchParams.set('error', tokenError instanceof Error ? tokenError.message : 'Microsoft-Anmeldung fehlgeschlagen.')
    return NextResponse.redirect(destination)
  }
}
