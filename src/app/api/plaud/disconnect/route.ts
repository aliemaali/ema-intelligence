import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { revokePlaudAccess } from '@/lib/plaud/api'
import { disconnectPlaudConnection, getPlaudAccessToken } from '@/lib/plaud/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const token = await getPlaudAccessToken(user.id).catch(() => null)
    if (token) await revokePlaudAccess(token).catch(() => undefined)
    await disconnectPlaudConnection(user.id).catch(() => undefined)
  }
  return NextResponse.redirect(new URL('/plaud?disconnected=1', request.url))
}
