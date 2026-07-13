'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function text(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export async function updateAcquisitionEmailDraft(formData: FormData) {
  const emailId = text(formData, 'email_id')
  const subject = text(formData, 'subject')
  const body = text(formData, 'body')

  if (!emailId || !subject || !body || subject.length > 300 || body.length > 20_000) {
    redirect('/acquisition/approvals?error=draft')
  }

  const supabase = await createClient()
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: current } = await db
    .from('acquisition_emails')
    .select('id, lead_id, status')
    .eq('id', emailId)
    .eq('user_id', user.id)
    .in('status', ['draft', 'ready_for_approval', 'approved', 'failed'])
    .maybeSingle()

  if (!current) redirect('/acquisition/approvals?error=status')

  const { error } = await db
    .from('acquisition_emails')
    .update({
      subject,
      body,
      status: 'ready_for_approval',
      approved_at: null,
      approval_note: current.status === 'approved' ? 'Nach Bearbeitung erneut freigeben' : null,
      error_message: null,
    })
    .eq('id', emailId)
    .eq('user_id', user.id)

  if (error) redirect('/acquisition/approvals?error=draft')

  if (current.lead_id) {
    await db.from('acquisition_leads').update({
      status: 'ready_for_approval',
      next_action: 'Bearbeiteten E-Mail-Entwurf prüfen und freigeben',
    }).eq('id', current.lead_id).eq('user_id', user.id)

    await db.from('acquisition_activities').insert({
      user_id: user.id,
      lead_id: current.lead_id,
      activity_type: 'email_updated',
      title: 'E-Mail-Entwurf bearbeitet',
      description: 'Betreff oder Nachrichtentext wurde manuell geändert. Vor dem Versand ist eine neue Freigabe erforderlich.',
    })
  }

  revalidatePath('/acquisition')
  revalidatePath('/acquisition/approvals')
  redirect('/acquisition/approvals?saved=1')
}
