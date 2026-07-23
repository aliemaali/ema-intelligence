'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/types/investors'
import {
  buildInvestorProfile,
  extractInvestorProfileFields,
  profileNotes,
  splitHeadquarters,
} from '@/lib/investors/investor-profile-pdf'

const MAX_PROFILE_SIZE = 15 * 1024 * 1024
const PROFILE_DOCUMENT_TYPE = 'Investoren-Suchprofil'

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return !!value && typeof value !== 'string' && typeof value.arrayBuffer === 'function'
}

function validEmail(value: string) {
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(value)
}

export async function importInvestorProfilePdf(
  formData: FormData
): Promise<ActionResult<{ investorId: string; companyName: string }>> {
  const file = formData.get('file')
  if (!isUploadedFile(file)) return { success: false, error: 'Bitte ein ausgefülltes PDF auswählen.' }
  if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
    return { success: false, error: 'Das Investoren-Suchprofil muss als PDF hochgeladen werden.' }
  }
  if (file.size <= 0 || file.size > MAX_PROFILE_SIZE) {
    return { success: false, error: 'Die PDF-Datei darf maximal 15 MB groß sein.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Nicht angemeldet. Bitte erneut anmelden.' }

  const bytes = new Uint8Array(await file.arrayBuffer())
  if (Buffer.from(bytes.slice(0, 5)).toString('ascii') !== '%PDF-') {
    return { success: false, error: 'Die ausgewählte Datei ist kein gültiges PDF.' }
  }

  let fields: Record<string, string>
  try {
    fields = extractInvestorProfileFields(bytes)
  } catch (error) {
    console.error('[importInvestorProfilePdf:parse]', error)
    return { success: false, error: 'Die Formularfelder konnten nicht ausgelesen werden.' }
  }

  const companyName = fields.firma_1?.trim()
  const contactPerson = fields.ansprech_2?.trim()
  const email = fields.email_4?.trim().toLowerCase()
  const phone = fields.telefon_5?.trim() || null
  const positionTitle = fields.position_3?.trim() || null

  if (!companyName || !contactPerson || !email) {
    return {
      success: false,
      error: 'Firmenname, Ansprechpartner und E-Mail müssen im Investoren-Suchprofil ausgefüllt sein.',
    }
  }
  if (!validEmail(email)) return { success: false, error: 'Die E-Mail im PDF ist ungültig.' }

  const { data: duplicate } = await supabase
    .from('investors')
    .select('id, company_name')
    .or(`user_id.eq.${user.id},created_by.eq.${user.id}`)
    .ilike('email', email)
    .limit(1)
    .maybeSingle()

  if (duplicate) {
    return {
      success: false,
      error: `Ein Investor mit dieser E-Mail existiert bereits (${duplicate.company_name || email}).`,
    }
  }

  const { profile, focus, ticketMin, ticketMax } = buildInvestorProfile(fields)
  const headquarters = splitHeadquarters(profile.headquarters)
  const hasPv = profile.technologies.pv_ground || profile.technologies.pv_rooftop
  const importedAt = new Date().toISOString()
  const sizePreferences = [
    profile.project_sizes.pv_from_mwp || profile.project_sizes.pv_to_mwp
      ? { technology: 'PV', from: profile.project_sizes.pv_from_mwp, to: profile.project_sizes.pv_to_mwp, unit: 'MWp' }
      : null,
    profile.project_sizes.bess_from_mwh || profile.project_sizes.bess_to_mwh
      ? { technology: 'BESS', from: profile.project_sizes.bess_from_mwh, to: profile.project_sizes.bess_to_mwh, unit: 'MWh' }
      : null,
  ].filter((entry): entry is NonNullable<typeof entry> => entry !== null)

  const { data: investor, error: investorError } = await supabase
    .from('investors')
    .insert({
      user_id: user.id,
      created_by: user.id,
      updated_by: user.id,
      full_name: contactPerson,
      company: companyName,
      company_name: companyName,
      contact_person: contactPerson,
      position_title: positionTitle,
      email,
      phone,
      location_city: headquarters.city || null,
      location_country: headquarters.country,
      interest_pv: hasPv,
      interest_bess: profile.technologies.bess,
      interest_hybrid: hasPv && profile.technologies.bess,
      interest_wind: profile.technologies.wind,
      size_preferences: sizePreferences,
      investment_type: profile.investment_models.join(', ') || null,
      min_ticket_eur: ticketMin,
      max_ticket_eur: ticketMax,
      ticket_size_min_eur: ticketMin,
      ticket_size_max_eur: ticketMax,
      dd_ready: profile.project_stages.some((stage) => ['Baureif (RTB)', 'Im Bau', 'In Betrieb'].includes(stage)),
      focus,
      status: 'Neu',
      notes: profileNotes(profile),
      search_profile: profile,
      profile_imported_at: importedAt,
      profile_source: PROFILE_DOCUMENT_TYPE,
      is_active: true,
    })
    .select('id')
    .single()

  if (investorError || !investor) {
    console.error('[importInvestorProfilePdf:investor]', investorError)
    return { success: false, error: 'Der Investor konnte nicht angelegt werden.' }
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${user.id}/investor/${investor.id}/${randomUUID()}-${safeName}`
  const { error: uploadError } = await supabase.storage
    .from('contact-documents')
    .upload(storagePath, Buffer.from(bytes), { contentType: 'application/pdf', upsert: false })

  if (uploadError) {
    console.error('[importInvestorProfilePdf:upload]', uploadError)
    await supabase.from('investors').delete().eq('id', investor.id)
    return { success: false, error: 'Das PDF konnte nicht in der Investorenakte gespeichert werden.' }
  }

  const { error: documentError } = await supabase
    .from('contact_documents')
    .insert({
      user_id: user.id,
      entity_type: 'investor',
      entity_id: investor.id,
      document_type: PROFILE_DOCUMENT_TYPE,
      file_name: file.name,
      storage_path: storagePath,
      mime_type: 'application/pdf',
      size_bytes: file.size,
    })

  if (documentError) {
    console.error('[importInvestorProfilePdf:document]', documentError)
    await supabase.storage.from('contact-documents').remove([storagePath])
    await supabase.from('investors').delete().eq('id', investor.id)
    return { success: false, error: 'Die PDF-Datei konnte nicht mit dem Investor verknüpft werden.' }
  }

  await supabase.from('contact_document_checklists').upsert({
    user_id: user.id,
    entity_type: 'investor',
    entity_id: investor.id,
    document_type: PROFILE_DOCUMENT_TYPE,
    status: 'vorhanden',
    updated_at: importedAt,
  }, { onConflict: 'user_id,entity_type,entity_id,document_type' })

  await supabase.from('activity_log').insert({
    user_id: user.id,
    investor_id: investor.id,
    activity_type: 'manual',
    title: 'Investor aus Suchprofil importiert',
    description: `${companyName} wurde aus dem ausgefüllten EMA Investoren-Suchprofil angelegt.`,
    metadata: { source: PROFILE_DOCUMENT_TYPE, file_name: file.name, storage_path: storagePath },
  })

  revalidatePath('/investors')
  revalidatePath(`/investors/${investor.id}`)
  return { success: true, data: { investorId: investor.id, companyName } }
}
