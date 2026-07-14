'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const ALLOWED_STATUSES = new Set(['eingereicht', 'in_pruefung', 'rueckfrage', 'angenommen', 'abgelehnt'])

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!['admin', 'owner'].includes(String(profile?.role ?? '').toLowerCase())) {
    throw new Error('Keine Berechtigung.')
  }

  return { supabase, user }
}

function revalidateSubmissionPaths(submissionId: string) {
  revalidatePath('/partner-submissions')
  revalidatePath('/partner-submissions/archive')
  revalidatePath(`/partner-submissions/${submissionId}`)
  revalidatePath('/partner')
}

export async function updatePartnerSubmissionReview(formData: FormData) {
  const submissionId = String(formData.get('submission_id') ?? '')
  const status = String(formData.get('status') ?? '')
  const reviewNote = String(formData.get('review_note') ?? '').trim()

  if (!submissionId || !ALLOWED_STATUSES.has(status)) {
    throw new Error('Ungültige Prüfdaten.')
  }

  const { supabase, user } = await requireAdmin()
  const { error } = await supabase
    .from('project_submissions')
    .update({
      status,
      review_note: reviewNote || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq('id', submissionId)

  if (error) throw new Error(error.message)
  revalidateSubmissionPaths(submissionId)
}

export async function archivePartnerSubmission(formData: FormData) {
  const submissionId = String(formData.get('submission_id') ?? '')
  if (!submissionId) throw new Error('Projekt-ID fehlt.')

  const { supabase, user } = await requireAdmin()
  const { error } = await supabase
    .from('project_submissions')
    .update({
      status: 'archiviert',
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq('id', submissionId)

  if (error) throw new Error(error.message)
  revalidateSubmissionPaths(submissionId)
  redirect('/partner-submissions')
}

export async function restorePartnerSubmission(formData: FormData) {
  const submissionId = String(formData.get('submission_id') ?? '')
  if (!submissionId) throw new Error('Projekt-ID fehlt.')

  const { supabase, user } = await requireAdmin()
  const { error } = await supabase
    .from('project_submissions')
    .update({
      status: 'eingereicht',
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq('id', submissionId)

  if (error) throw new Error(error.message)
  revalidateSubmissionPaths(submissionId)
  redirect(`/partner-submissions/${submissionId}`)
}
