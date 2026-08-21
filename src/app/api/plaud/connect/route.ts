import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  createPkce,
  PLAUD_CLIENT_COOKIE,
  PLAUD_STATE_COOKIE,
  PLAUD_VERIFIER_COOKIE,
  plaudAuthorizationUrl,
  registerPlaudClient,
} from '@/lib/plaud/oauth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const redirectUri = new URL('/api/plaud/callback', request.url).toString()
  try {
    const { verifier, challenge, state } = createPkce()
    const clientId = await registerPlaudClient(redirectUri)
    const response = NextResponse.redirect(plaudAuthorizationUrl({ clientId, redirectUri, challenge, state }))
    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 10 * 60,
    }
    response.cookies.set(PLAUD_STATE_COOKIE, state, options)
    response.cookies.set(PLAUD_VERIFIER_COOKIE, verifier, options)
    response.cookies.set(PLAUD_CLIENT_COOKIE, clientId, options)
    return response
  } catch (error) {
    const destination = new URL('/plaud', request.url)
    destination.searchParams.set('error', error instanceof Error ? error.message : 'PLAUD-Verbindung konnte nicht gestartet werden.')
    return NextResponse.redirect(destination)
  }
}
