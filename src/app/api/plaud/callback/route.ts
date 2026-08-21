import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  exchangePlaudCode,
  PLAUD_CLIENT_COOKIE,
  PLAUD_STATE_COOKIE,
  PLAUD_VERIFIER_COOKIE,
} from '@/lib/plaud/oauth'
import { savePlaudConnection } from '@/lib/plaud/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function clearOAuthCookies(response: NextResponse) {
  for (const name of [PLAUD_STATE_COOKIE, PLAUD_VERIFIER_COOKIE, PLAUD_CLIENT_COOKIE]) {
    response.cookies.set(name, '', { path: '/', maxAge: 0 })
  }
  return response
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const destination = new URL('/plaud', request.url)
  const providerError = request.nextUrl.searchParams.get('error_description') || request.nextUrl.searchParams.get('error')
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  const savedState = request.cookies.get(PLAUD_STATE_COOKIE)?.value
  const verifier = request.cookies.get(PLAUD_VERIFIER_COOKIE)?.value
  const clientId = request.cookies.get(PLAUD_CLIENT_COOKIE)?.value

  if (providerError) {
    destination.searchParams.set('error', providerError)
    return clearOAuthCookies(NextResponse.redirect(destination))
  }
  if (!code || !state || !savedState || !verifier || !clientId || state !== savedState) {
    destination.searchParams.set('error', 'Die PLAUD-Anmeldung konnte nicht sicher bestätigt werden.')
    return clearOAuthCookies(NextResponse.redirect(destination))
  }

  try {
    const redirectUri = new URL('/api/plaud/callback', request.url).toString()
    const token = await exchangePlaudCode({ code, clientId, redirectUri, verifier })
    await savePlaudConnection(user.id, clientId, token)
    destination.searchParams.set('connected', '1')
  } catch (error) {
    destination.searchParams.set('error', error instanceof Error ? error.message : 'PLAUD-Anmeldung fehlgeschlagen.')
  }
  return clearOAuthCookies(NextResponse.redirect(destination))
}
