'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const ALLOWED_STATUSES = new Set(['eingereicht', 'in_pruefung', 'rueckfrage', 'angenommen', 'abgelehnt'])

export async function updatePartnerSubmissionReview(formData: FormData) {
  const submissionId = String(formData.get('submission_id') ?? '')
  const status = String(formData.get('status') ?? '')
  const reviewNote = String(formData.get('review_note') ?? '').trim()

  if (!submissionId || !ALLOWED_STATUSES.has(status)) {
    throw new Error('Ungültige Prüfdaten.')
  }

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

  revalidatePath('/partner-submissions')
  revalidatePath(`/partner-submissions/${submissionId}`)
  revalidatePath('/partner')
}
