'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function text(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function numberValue(formData: FormData, key: string) {
  const value = text(formData, key)
  if (!value) return null
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

type DraftLead = {
  id: string
  acquisition_type: 'project' | 'roof'
  company_name: string
  contact_name: string | null
  email: string | null
  city: string | null
  estimated_potential_kwp: number | null
  estimated_roof_area_sqm: number | null
}

function buildInitialEmail(lead: DraftLead) {
  const salutation = lead.contact_name ? `Guten Tag ${lead.contact_name},` : 'Guten Tag,'
  const location = lead.city ? ` am Standort ${lead.city}` : ''
  const roofArea = lead.estimated_roof_area_sqm
    ? ` mit einer grob geschätzten Dachfläche von rund ${Math.round(lead.estimated_roof_area_sqm).toLocaleString('de-DE')} m²`
    : ''
  const potential = lead.estimated_potential_kwp
    ? ` und einem möglichen PV-Potenzial von etwa ${Math.round(lead.estimated_potential_kwp).toLocaleString('de-DE')} kWp`
    : ''

  if (lead.acquisition_type === 'roof') {
    return {
      subject: `Unverbindliche Anfrage zur Nutzung Ihrer Dachfläche${lead.city ? ` in ${lead.city}` : ''}`,
      body: `${salutation}

wir sind auf die gewerblich genutzte Immobilie von ${lead.company_name}${location} aufmerksam geworden${roofArea}${potential}.

EMA Enterprise GmbH entwickelt und vermittelt Photovoltaikprojekte für professionelle Investoren. In diesem Zusammenhang prüfen wir geeignete große Gewerbe- und Industriedächer für eine langfristige Nutzung oder Verpachtung.

Für Sie kann daraus eine zusätzliche, langfristige Einnahme entstehen, ohne dass Sie selbst in die Photovoltaikanlage investieren müssen. Planung, Finanzierung, Bau und Betrieb werden durch geeignete Projektpartner übernommen.

Gerne würden wir unverbindlich prüfen, ob die Dachfläche grundsätzlich für ein solches Modell infrage kommt. Ein kurzer Austausch oder die Weiterleitung an die zuständige Person wäre dafür bereits hilfreich.

Mit freundlichen Grüßen

Ali Ünlüer
EMA Enterprise GmbH
Connecting Capital with Energy Infrastructure.
E-Mail: unluer@ema-enterprise.de`,
    }
  }

  return {
    subject: `Anfrage zu möglichen Energieprojekten von ${lead.company_name}`,
    body: `${salutation}

EMA Enterprise GmbH verbindet professionelle Investoren mit Photovoltaik-, BESS- und Hybridprojekten.

Wir sind auf ${lead.company_name}${location} aufmerksam geworden und möchten unverbindlich anfragen, ob Sie aktuell Projekte entwickeln, vermarkten oder geeignete Investitionsmöglichkeiten anbieten.

Für eine erste Prüfung benötigen wir lediglich die wichtigsten Eckdaten wie Standort, Projektart, Leistung, Entwicklungsstand, Netzstatus und Preisvorstellung. Vertrauliche Unterlagen können anschließend kontrolliert ausgetauscht werden.

Ich freue mich über eine kurze Rückmeldung oder die Weiterleitung an die zuständige Person.

Mit freundlichen Grüßen

Ali Ünlüer
EMA Enterprise GmbH
Connecting Capital with Energy Infrastructure.
E-Mail: unluer@ema-enterprise.de`,
  }
}

async function createDraftForLead(db: any, userId: string, lead: DraftLead) {
  if (!lead.email) return { created: false, reason: 'missing_email' }

  const { data: existing } = await db
    .from('acquisition_emails')
    .select('id')
    .eq('user_id', userId)
    .eq('lead_id', lead.id)
    .eq('email_type', 'initial')
    .in('status', ['draft', 'ready_for_approval', 'approved', 'sent'])
    .maybeSingle()

  if (existing) return { created: false, reason: 'duplicate' }

  const draft = buildInitialEmail(lead)
  const { error } = await db.from('acquisition_emails').insert({
    user_id: userId,
    lead_id: lead.id,
    email_type: 'initial',
    recipient_email: lead.email,
    subject: draft.subject,
    body: draft.body,
    status: 'ready_for_approval',
  })

  if (error) return { created: false, reason: 'save_error' }

  await db.from('acquisition_leads').update({
    status: 'ready_for_approval',
    next_action: 'E-Mail-Entwurf prüfen und freigeben',
  }).eq('id', lead.id).eq('user_id', userId)

  await db.from('acquisition_activities').insert({
    user_id: userId,
    lead_id: lead.id,
    activity_type: 'email_created',
    title: 'Erstkontakt-E-Mail vorbereitet',
    description: 'EMA Scout hat einen kostenfreien, regelbasierten E-Mail-Entwurf zur Freigabe erstellt.',
  })

  return { created: true, reason: null }
}

export async function createAcquisitionLead(formData: FormData) {
  const supabase = await createClient()
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const companyName = text(formData, 'company_name')
  const acquisitionType = text(formData, 'acquisition_type')

  if (!companyName || !['project', 'roof'].includes(acquisitionType || '')) {
    redirect('/acquisition/new?error=missing')
  }

  const { data: lead, error } = await db
    .from('acquisition_leads')
    .insert({
      user_id: user.id,
      acquisition_type: acquisitionType,
      company_name: companyName,
      contact_name: text(formData, 'contact_name'),
      contact_role: text(formData, 'contact_role'),
      email: text(formData, 'email'),
      phone: text(formData, 'phone'),
      website: text(formData, 'website'),
      street: text(formData, 'street'),
      postal_code: text(formData, 'postal_code'),
      city: text(formData, 'city'),
      state: text(formData, 'state'),
      source_name: text(formData, 'source_name'),
      source_url: text(formData, 'source_url'),
      project_type: text(formData, 'project_type'),
      project_stage: text(formData, 'project_stage'),
      estimated_potential_kwp: numberValue(formData, 'estimated_potential_kwp'),
      estimated_roof_area_sqm: numberValue(formData, 'estimated_roof_area_sqm'),
      score: numberValue(formData, 'score') ?? 0,
      notes: text(formData, 'notes'),
      status: 'new',
    })
    .select('id')
    .single()

  if (error || !lead) redirect('/acquisition/new?error=save')

  await db.from('acquisition_activities').insert({
    user_id: user.id,
    lead_id: lead.id,
    activity_type: 'created',
    title: 'Lead manuell angelegt',
    description: 'Der Lead wurde im EMA Akquise-Center erfasst.',
  })

  revalidatePath('/acquisition')
  redirect('/acquisition')
}

export async function createAcquisitionEmailDraft(formData: FormData) {
  const leadId = text(formData, 'lead_id')
  const supabase = await createClient()
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!leadId) redirect('/acquisition?error=lead')

  const { data: lead } = await db
    .from('acquisition_leads')
    .select('id,acquisition_type,company_name,contact_name,email,city,estimated_potential_kwp,estimated_roof_area_sqm')
    .eq('id', leadId)
    .eq('user_id', user.id)
    .single()

  if (!lead) redirect('/acquisition?error=lead')
  const result = await createDraftForLead(db, user.id, lead as DraftLead)

  revalidatePath('/acquisition')
  revalidatePath('/acquisition/approvals')
  redirect(result.created ? '/acquisition/approvals?created=1' : `/acquisition?error=${result.reason}`)
}

export async function createAllAcquisitionEmailDrafts() {
  const supabase = await createClient()
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await db
    .from('acquisition_leads')
    .select('id,acquisition_type,company_name,contact_name,email,city,estimated_potential_kwp,estimated_roof_area_sqm')
    .eq('user_id', user.id)
    .not('email', 'is', null)
    .in('status', ['new', 'researching'])
    .order('score', { ascending: false })
    .limit(50)

  let created = 0
  for (const lead of (data || []) as DraftLead[]) {
    const result = await createDraftForLead(db, user.id, lead)
    if (result.created) created += 1
  }

  revalidatePath('/acquisition')
  revalidatePath('/acquisition/approvals')
  redirect(`/acquisition/approvals?bulk=${created}`)
}

export async function approveAcquisitionEmail(formData: FormData) {
  const supabase = await createClient()
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const emailId = text(formData, 'email_id')
  if (!emailId) redirect('/acquisition/approvals')

  const { data: email } = await db
    .from('acquisition_emails')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq('id', emailId)
    .eq('user_id', user.id)
    .select('lead_id')
    .single()

  if (email?.lead_id) {
    await db.from('acquisition_leads').update({ status: 'approved' }).eq('id', email.lead_id).eq('user_id', user.id)
    await db.from('acquisition_activities').insert({
      user_id: user.id,
      lead_id: email.lead_id,
      activity_type: 'approved',
      title: 'E-Mail freigegeben',
      description: 'Der Versand erfolgt erst nach Anschluss des Outlook-Moduls.',
    })
  }

  revalidatePath('/acquisition')
  revalidatePath('/acquisition/approvals')
}

export async function rejectAcquisitionEmail(formData: FormData) {
  const supabase = await createClient()
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const emailId = text(formData, 'email_id')
  if (emailId) {
    await db
      .from('acquisition_emails')
      .update({ status: 'cancelled', approval_note: 'Von Ali abgelehnt' })
      .eq('id', emailId)
      .eq('user_id', user.id)
  }

  revalidatePath('/acquisition/approvals')
}
