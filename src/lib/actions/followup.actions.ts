'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function text(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function followUpCopy(companyName: string, contactName: string | null, stage: 1 | 2) {
  const salutation = contactName ? `Guten Tag ${contactName},` : 'Guten Tag,'
  if (stage === 1) {
    return {
      subject: `Kurze Rückfrage zu unserer Anfrage an ${companyName}`,
      body: `${salutation}\n\nich wollte mich kurz erkundigen, ob meine Nachricht zu möglichen Energieprojekten beziehungsweise zur Nutzung einer geeigneten Dachfläche bei Ihnen angekommen ist.\n\nEin kurzer Hinweis zur zuständigen Ansprechperson oder eine unverbindliche Rückmeldung wäre bereits sehr hilfreich.\n\nMit freundlichen Grüßen\n\nAli Ünlüer\nEMA Enterprise GmbH\nE-Mail: unluer@ema-enterprise.de`,
    }
  }

  return {
    subject: `Letzte Rückfrage zu unserer Anfrage an ${companyName}`,
    body: `${salutation}\n\nich melde mich ein letztes Mal zu unserer unverbindlichen Anfrage. Falls das Thema aktuell nicht relevant ist, genügt eine kurze Rückmeldung. Andernfalls freue ich mich über die Weiterleitung an die zuständige Person.\n\nMit freundlichen Grüßen\n\nAli Ünlüer\nEMA Enterprise GmbH\nE-Mail: unluer@ema-enterprise.de`,
  }
}

export async function generateDueFollowUps() {
  const supabase = await createClient()
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: leads } = await db
    .from('acquisition_leads')
    .select('id,company_name,contact_name,email,status,next_action_at')
    .eq('user_id', user.id)
    .eq('status', 'contacted')
    .not('email', 'is', null)
    .lte('next_action_at', new Date().toISOString())
    .limit(50)

  let created = 0
  for (const lead of leads || []) {
    const { data: previous } = await db
      .from('acquisition_emails')
      .select('email_type,status')
      .eq('user_id', user.id)
      .eq('lead_id', lead.id)
      .in('email_type', ['follow_up_1', 'follow_up_2'])

    const hasFirst = (previous || []).some((item: any) => item.email_type === 'follow_up_1' && item.status !== 'cancelled')
    const hasSecond = (previous || []).some((item: any) => item.email_type === 'follow_up_2' && item.status !== 'cancelled')
    if (hasSecond) continue

    const stage: 1 | 2 = hasFirst ? 2 : 1
    const copy = followUpCopy(lead.company_name, lead.contact_name, stage)
    const { error } = await db.from('acquisition_emails').insert({
      user_id: user.id,
      lead_id: lead.id,
      email_type: stage === 1 ? 'follow_up_1' : 'follow_up_2',
      recipient_email: lead.email,
      subject: copy.subject,
      body: copy.body,
      status: 'ready_for_approval',
    })

    if (!error) {
      created += 1
      await db.from('acquisition_leads').update({
        status: 'ready_for_approval',
        next_action: `Follow-up ${stage} prüfen und freigeben`,
        next_action_at: null,
      }).eq('id', lead.id).eq('user_id', user.id)

      await db.from('acquisition_activities').insert({
        user_id: user.id,
        lead_id: lead.id,
        activity_type: 'follow_up_scheduled',
        title: `Follow-up ${stage} vorbereitet`,
        description: 'Der Entwurf wurde erstellt und wartet auf deine Freigabe.',
      })
    }
  }

  revalidatePath('/acquisition')
  revalidatePath('/acquisition/approvals')
  redirect(`/acquisition/approvals?followups=${created}`)
}

export async function updateAcquisitionLeadStatus(formData: FormData) {
  const leadId = text(formData, 'lead_id')
  const status = text(formData, 'status')
  const allowed = ['replied', 'qualified', 'rejected']
  if (!leadId || !status || !allowed.includes(status)) redirect('/acquisition?error=status')

  const supabase = await createClient()
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const labels: Record<string, string> = {
    replied: 'Antwort erhalten',
    qualified: 'Lead qualifiziert',
    rejected: 'Kein Interesse',
  }

  await db.from('acquisition_leads').update({
    status,
    next_action: status === 'replied' ? 'Antwort prüfen und nächsten Schritt festlegen' : null,
    next_action_at: null,
  }).eq('id', leadId).eq('user_id', user.id)

  await db.from('acquisition_activities').insert({
    user_id: user.id,
    lead_id: leadId,
    activity_type: 'status_changed',
    title: labels[status],
    description: 'Status wurde manuell im Akquise-Center aktualisiert.',
  })

  revalidatePath('/acquisition')
}
