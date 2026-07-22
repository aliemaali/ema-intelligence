import { randomBytes } from 'crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  MICROSOFT_SCOPES,
  MICROSOFT_STATE_COOKIE,
  microsoftConfig,
} from '@/lib/microsoft/graph'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', 'https://app.ema-enterprise.de'))

  const { tenantId, clientId, redirectUri } = microsoftConfig()
  const state = randomBytes(24).toString('base64url')
  const authorize = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`)
  authorize.searchParams.set('client_id', clientId)
  authorize.searchParams.set('response_type', 'code')
  authorize.searchParams.set('redirect_uri', redirectUri)
  authorize.searchParams.set('response_mode', 'query')
  authorize.searchParams.set('scope', MICROSOFT_SCOPES)
  authorize.searchParams.set('state', state)

  // Use the current EMA account as a hint, but do not force the account picker.
  if (user.email) authorize.searchParams.set('login_hint', user.email)

  const response = NextResponse.redirect(authorize)
  response.cookies.set(MICROSOFT_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60,
  })
  return response
}
