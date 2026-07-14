'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const ADMIN_ROLES = new Set(['admin', 'owner'])

function mapDocumentType(value: string) {
  const allowed = new Set(['expose', 'lageplan', 'netzanschluss', 'pachtvertrag', 'genehmigung', 'gutachten', 'bild', 'sonstiges'])
  return allowed.has(value) ? value : 'sonstiges'
}

function mapProjectType(value: string) {
  const normalized = String(value ?? '').toLowerCase()
  if (normalized === 'pv' || normalized === 'solar') return 'pv_freiflaeche'
  if (normalized === 'pv_dach' || normalized === 'pv_freiflaeche') return normalized
  if (normalized === 'bess' || normalized === 'hybrid' || normalized === 'wind') return normalized
  return 'pv_freiflaeche'
}

export async function convertPartnerSubmission(formData: FormData) {
  const submissionId = String(formData.get('submission_id') ?? '')
  if (!submissionId) throw new Error('Einreichung fehlt.')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!ADMIN_ROLES.has(String(profile?.role ?? '').toLowerCase())) throw new Error('Keine Berechtigung.')

  const { data: submission, error: submissionError } = await supabase
    .from('project_submissions')
    .select('*')
    .eq('id', submissionId)
    .maybeSingle()

  if (submissionError || !submission) throw new Error(submissionError?.message ?? 'Einreichung nicht gefunden.')
  if (submission.status !== 'angenommen') throw new Error('Nur angenommene Einreichungen können übernommen werden.')
  if (submission.converted_project_id) redirect(`/projects/${submission.converted_project_id}/overview`)

  const projectNotes = [
    submission.notes,
    `Übernommen aus Partner-Einreichung ${submission.id}.`,
    submission.remuneration_model ? `Vermarktung: ${submission.remuneration_model}` : null,
    submission.remuneration_ct_kwh != null ? `Vergütung: ${submission.remuneration_ct_kwh} ct/kWh` : null,
    submission.ppa_term_years ? `PPA-Laufzeit: ${submission.ppa_term_years} Jahre` : null,
  ].filter(Boolean).join('\n')

  const pvKwp = submission.pv_kwp == null || submission.pv_kwp === '' ? null : Number(submission.pv_kwp)

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,
      project_name: submission.project_name,
      project_type: mapProjectType(submission.project_type),
      status: 'lead',
      priority: 'mittel',
      marketing_status: 'nicht_gestartet',
      contact_name: submission.contact_name,
      contact_email: submission.contact_email,
      contact_phone: submission.contact_phone,
      location_address: submission.location_address,
      location_city: submission.location_city,
      location_state: submission.location_state,
      location_country: 'Deutschland',
      location_lat: submission.location_lat,
      location_lng: submission.location_lng,
      // Legacy-Spaltenname; die Anwendung behandelt diesen Wert durchgehend als kWp.
      pv_mwp: Number.isFinite(pvKwp) ? pvKwp : null,
      bess_mw: submission.bess_mw,
      bess_mwh: submission.bess_mwh,
      notes: projectNotes || null,
      tags: ['Partner-Einreichung'],
    })
    .select('id')
    .single()

  if (projectError || !project) throw new Error(projectError?.message ?? 'Projekt konnte nicht erstellt werden.')

  const copiedPaths: string[] = []

  try {
    const { data: sourceDocuments, error: documentsError } = await supabase
      .from('submission_documents')
      .select('*')
      .eq('submission_id', submissionId)
      .order('created_at')

    if (documentsError) throw documentsError

    for (const document of sourceDocuments ?? []) {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('partner-submissions')
        .download(document.file_path)
      if (downloadError || !fileData) throw downloadError ?? new Error('Dokument konnte nicht gelesen werden.')

      const targetPath = `${user.id}/${project.id}/${crypto.randomUUID()}-${document.file_name}`
      const { error: uploadError } = await supabase.storage
        .from('project-documents')
        .upload(targetPath, fileData, { contentType: document.mime_type ?? undefined, upsert: false })
      if (uploadError) throw uploadError
      copiedPaths.push(targetPath)

      const { error: recordError } = await supabase.from('documents').insert({
        project_id: project.id,
        user_id: user.id,
        document_type: mapDocumentType(document.document_type),
        display_name: document.display_name,
        file_name: document.file_name,
        file_path: targetPath,
        file_size_bytes: document.file_size_bytes,
        mime_type: document.mime_type,
        version: 1,
        notes: 'Aus Partner-Einreichung übernommen',
      })
      if (recordError) throw recordError
    }

    const { error: updateError } = await supabase
      .from('project_submissions')
      .update({
        converted_project_id: project.id,
        converted_at: new Date().toISOString(),
        converted_by: user.id,
      })
      .eq('id', submissionId)
      .is('converted_project_id', null)

    if (updateError) throw updateError

    await supabase.from('activity_log').insert({
      project_id: project.id,
      user_id: user.id,
      activity_type: 'manual',
      title: 'Partner-Einreichung übernommen',
      description: `Einreichung ${submission.id} wurde als internes Projekt angelegt.`,
      metadata: { submission_id: submission.id },
    })
  } catch (error) {
    if (copiedPaths.length > 0) await supabase.storage.from('project-documents').remove(copiedPaths)
    await supabase.from('documents').delete().eq('project_id', project.id).eq('user_id', user.id)
    await supabase.from('projects').delete().eq('id', project.id).eq('user_id', user.id)
    throw error
  }

  revalidatePath('/partner-submissions')
  revalidatePath(`/partner-submissions/${submissionId}`)
  revalidatePath('/projects')
  revalidatePath('/dashboard')
  redirect(`/projects/${project.id}/overview`)
}
