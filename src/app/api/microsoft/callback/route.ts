import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  exchangeAuthorizationCode,
  graphFetch,
  MICROSOFT_STATE_COOKIE,
} from '@/lib/microsoft/graph'
import { saveMicrosoftConnection } from '@/lib/microsoft/session'

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

    let profile: { name?: string; email?: string } = {}
    try {
      const account = await graphFetch<{ displayName?: string; mail?: string; userPrincipalName?: string }>(
        token.access_token,
        '/me?$select=displayName,mail,userPrincipalName',
      )
      profile = {
        name: account.displayName,
        email: account.mail || account.userPrincipalName,
      }
    } catch {
      // The token is still valid even if the optional profile lookup briefly fails.
    }

    await saveMicrosoftConnection(user.id, token.refresh_token, profile)

    const response = NextResponse.redirect(new URL('/microsoft?connected=1', request.url))
    response.cookies.set(MICROSOFT_STATE_COOKIE, '', { path: '/', maxAge: 0 })
    return response
  } catch (tokenError) {
    destination.searchParams.set('error', tokenError instanceof Error ? tokenError.message : 'Microsoft-Anmeldung fehlgeschlagen.')
    return NextResponse.redirect(destination)
  }
}
