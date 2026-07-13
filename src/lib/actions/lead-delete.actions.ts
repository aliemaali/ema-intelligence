'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function text(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export async function softDeleteAcquisitionLead(formData: FormData) {
  const leadId = text(formData, 'lead_id')
  if (!leadId) redirect('/acquisition?error=lead')

  const supabase = await createClient()
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const deletedAt = new Date().toISOString()
  const { data: lead, error } = await db
    .from('acquisition_leads')
    .update({
      deleted_at: deletedAt,
      status: 'blocked',
      next_action: null,
      next_action_at: null,
    })
    .eq('id', leadId)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .select('id,company_name')
    .maybeSingle()

  if (error || !lead) redirect('/acquisition?error=delete')

  await db
    .from('acquisition_emails')
    .update({ status: 'cancelled', approval_note: 'Lead gelöscht' })
    .eq('user_id', user.id)
    .eq('lead_id', leadId)
    .in('status', ['draft', 'ready_for_approval', 'approved'])

  await db.from('acquisition_activities').insert({
    user_id: user.id,
    lead_id: leadId,
    activity_type: 'deleted',
    title: 'Lead gelöscht',
    description: `${lead.company_name} wurde ausgeblendet. Offene E-Mail-Entwürfe und Follow-ups wurden gestoppt.`,
  })

  revalidatePath('/acquisition')
  revalidatePath('/acquisition/approvals')
  redirect('/acquisition?deleted=1')
}
