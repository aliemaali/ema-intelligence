'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function inferJobType(prompt: string) {
  const text = prompt.toLowerCase()
  if (text.includes('dach') || text.includes('logistik') || text.includes('halle')) return 'roof_search'
  if (text.includes('projekt') || text.includes('pv') || text.includes('bess') || text.includes('hybrid')) return 'project_search'
  if (text.includes('mail') || text.includes('e-mail')) return 'email_drafting'
  if (text.includes('bewert') || text.includes('score')) return 'lead_scoring'
  return 'other'
}

export async function createAgentJob(formData: FormData) {
  const prompt = String(formData.get('prompt') || '').trim()
  if (prompt.length < 10) redirect('/ai-agent?error=prompt')

  const supabase = await createClient()
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const title = prompt.length > 72 ? `${prompt.slice(0, 69)}...` : prompt
  const { data: job, error } = await db.from('agent_jobs').insert({
    user_id: user.id,
    title,
    prompt,
    job_type: inferJobType(prompt),
    status: 'queued',
    progress: 0,
    current_step: 'Auftrag wartet auf Verarbeitung',
  }).select('id').single()

  if (error || !job) redirect('/ai-agent?error=create')

  await db.from('agent_logs').insert({
    user_id: user.id,
    job_id: job.id,
    level: 'info',
    message: 'Auftrag wurde erstellt und in die Warteschlange aufgenommen.',
  })

  revalidatePath('/ai-agent')
  redirect(`/ai-agent?job=${job.id}&created=1`)
}

export async function cancelAgentJob(formData: FormData) {
  const jobId = String(formData.get('job_id') || '')
  const supabase = await createClient()
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !jobId) return

  await db.from('agent_jobs').update({ status: 'cancelled', current_step: 'Vom Benutzer gestoppt' }).eq('id', jobId).eq('user_id', user.id)
  await db.from('agent_logs').insert({ user_id: user.id, job_id: jobId, level: 'warning', message: 'Auftrag wurde gestoppt.' })
  revalidatePath('/ai-agent')
}