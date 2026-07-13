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
