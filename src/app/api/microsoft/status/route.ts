import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMicrosoftAccessToken, updateMicrosoftProfile } from '@/lib/microsoft/session'
import { graphFetch } from '@/lib/microsoft/graph'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  try {
    const accessToken = await getMicrosoftAccessToken(user.id)
    if (!accessToken) return NextResponse.json({ connected: false })

    const profile = await graphFetch<{ displayName?: string; mail?: string; userPrincipalName?: string }>(
      accessToken,
      '/me?$select=displayName,mail,userPrincipalName',
    )
    const name = profile.displayName || 'Microsoft 365'
    const email = profile.mail || profile.userPrincipalName || ''

    await updateMicrosoftProfile(user.id, { name, email }).catch(() => undefined)

    return NextResponse.json({
      connected: true,
      name,
      email,
    })
  } catch (error) {
    return NextResponse.json({
      connected: false,
      error: error instanceof Error ? error.message : 'Microsoft-Verbindung fehlgeschlagen',
    })
  }
}
