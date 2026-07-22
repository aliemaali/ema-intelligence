import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { graphFetch } from '@/lib/microsoft/graph'
import { getMicrosoftAccessToken } from '@/lib/microsoft/session'

type GraphContact = {
  id: string
  displayName?: string
  givenName?: string
  surname?: string
  companyName?: string
  jobTitle?: string
  emailAddresses?: { address?: string; name?: string }[]
  businessPhones?: string[]
  mobilePhone?: string
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const accessToken = await getMicrosoftAccessToken()
  if (!accessToken) return NextResponse.json({ error: 'Microsoft nicht verbunden' }, { status: 401 })

  try {
    const query = '/me/contacts?$top=250&$orderby=displayName&$select=id,displayName,givenName,surname,companyName,jobTitle,emailAddresses,businessPhones,mobilePhone'
    const result = await graphFetch<{ value: GraphContact[] }>(accessToken, query)
    const contacts = (result.value || []).map((contact) => {
      const email = contact.emailAddresses?.find((item) => item.address)?.address || ''
      const phone = contact.mobilePhone || contact.businessPhones?.[0] || ''
      const name = contact.displayName || [contact.givenName, contact.surname].filter(Boolean).join(' ') || email || 'Unbenannter Kontakt'
      return {
        id: contact.id,
        name,
        company: contact.companyName || '',
        role: contact.jobTitle || '',
        email,
        phone,
        initials: name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '–',
      }
    })
    return NextResponse.json({ contacts })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Kontakte konnten nicht geladen werden.' }, { status: 502 })
  }
}
