import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMicrosoftAccessToken } from '@/lib/microsoft/session'
import { graphFetch } from '@/lib/microsoft/graph'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const accessToken = await getMicrosoftAccessToken()
  if (!accessToken) return NextResponse.json({ connected: false })

  try {
    const profile = await graphFetch<{ displayName?: string; mail?: string; userPrincipalName?: string }>(
      accessToken,
      '/me?$select=displayName,mail,userPrincipalName',
    )
    return NextResponse.json({
      connected: true,
      name: profile.displayName || 'Microsoft 365',
      email: profile.mail || profile.userPrincipalName || '',
    })
  } catch (error) {
    return NextResponse.json({ connected: false, error: error instanceof Error ? error.message : 'Microsoft-Verbindung fehlgeschlagen' })
  }
}
