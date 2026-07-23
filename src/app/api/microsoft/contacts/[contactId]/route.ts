import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { graphFetch } from '@/lib/microsoft/graph'
import { getMicrosoftAccessToken } from '@/lib/microsoft/session'

type RouteContext = {
  params: { contactId: string }
}

type ContactUpdateInput = {
  name?: unknown
  company?: unknown
  role?: unknown
  email?: unknown
  phone?: unknown
}

type GraphEmailAddress = {
  address?: string
  name?: string
}

type GraphContact = {
  displayName?: string
  emailAddresses?: GraphEmailAddress[]
  mobilePhone?: string
  businessPhones?: string[]
}

function text(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function contactPath(contactId: string) {
  const normalized = contactId.trim()
  if (!normalized || normalized.length > 512) throw new Error('Ungültiger Outlook-Kontakt.')
  return `/me/contacts/${encodeURIComponent(normalized)}`
}

async function accessTokenForCurrentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 }) }

  const accessToken = await getMicrosoftAccessToken(user.id)
  if (!accessToken) return { error: NextResponse.json({ error: 'Microsoft nicht verbunden' }, { status: 401 }) }

  return { accessToken }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const session = await accessTokenForCurrentUser()
    if ('error' in session) return session.error

    const input = await request.json() as ContactUpdateInput
    const name = text(input.name, 160)
    const company = text(input.company, 160)
    const role = text(input.role, 160)
    const email = text(input.email, 254)
    const phone = text(input.phone, 80)

    if (!name) return NextResponse.json({ error: 'Der Kontaktname darf nicht leer sein.' }, { status: 400 })
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: 'Bitte eine gültige E-Mail-Adresse eingeben.' }, { status: 400 })
    }

    const path = contactPath(params.contactId)
    const current = await graphFetch<GraphContact>(session.accessToken, `${path}?$select=displayName,emailAddresses,mobilePhone,businessPhones`)
    const existingEmails = current.emailAddresses || []
    const emailAddresses = email
      ? existingEmails.length > 0
        ? [{ ...existingEmails[0], address: email, name }, ...existingEmails.slice(1)]
        : [{ address: email, name }]
      : existingEmails.slice(1)

    const update: Record<string, unknown> = {
      displayName: name,
      companyName: company || null,
      jobTitle: role || null,
      emailAddresses,
    }

    if (current.mobilePhone || !(current.businessPhones || []).length) {
      update.mobilePhone = phone || null
    } else {
      update.businessPhones = phone ? [phone] : []
    }

    await graphFetch<GraphContact>(session.accessToken, path, {
      method: 'PATCH',
      body: JSON.stringify(update),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Kontakt konnte nicht geändert werden.'
    const status = /privilege|permission|authorization|access/i.test(message) ? 403 : 502
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const session = await accessTokenForCurrentUser()
    if ('error' in session) return session.error

    await graphFetch<void>(session.accessToken, contactPath(params.contactId), { method: 'DELETE' })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Kontakt konnte nicht gelöscht werden.'
    const status = /privilege|permission|authorization|access/i.test(message) ? 403 : 502
    return NextResponse.json({ error: message }, { status })
  }
}
