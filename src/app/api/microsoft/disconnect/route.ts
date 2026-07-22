import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { disconnectMicrosoftConnection } from '@/lib/microsoft/session'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    await disconnectMicrosoftConnection(user.id).catch(() => undefined)
  }

  return NextResponse.redirect(new URL('/microsoft?disconnected=1', request.url))
}
