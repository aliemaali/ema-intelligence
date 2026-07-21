'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function linkInvestorToProject(projectId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Nicht angemeldet' }

  const investorId = String(formData.get('investor_id') ?? '').trim()
  if (!investorId) return { error: 'Bitte einen Investor auswählen' }

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!project) return { error: 'Projekt nicht gefunden' }

  const { data: investor } = await supabase
    .from('investors')
    .select('id')
    .eq('id', investorId)
    .eq('user_id', user.id)
    .single()

  if (!investor) return { error: 'Investor nicht gefunden' }

  const { error } = await supabase.from('project_investors').insert({
    project_id: projectId,
    investor_id: investorId,
    user_id: user.id,
    status: 'kontaktiert',
  })

  if (error) {
    if (error.code === '23505') return { error: 'Dieser Investor ist bereits mit dem Projekt verknüpft' }
    return { error: error.message }
  }

  revalidatePath(`/projects/${projectId}/investors`)
  return { success: true }
}
