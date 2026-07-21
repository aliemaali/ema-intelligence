'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function linkInvestorToProject(projectId: string, formData: FormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const investorId = String(formData.get('investor_id') ?? '').trim()
  if (!investorId) throw new Error('Bitte einen Investor auswählen')

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!project) throw new Error('Projekt nicht gefunden')

  const { data: investor } = await supabase
    .from('investors')
    .select('id')
    .eq('id', investorId)
    .eq('user_id', user.id)
    .single()

  if (!investor) throw new Error('Investor nicht gefunden')

  const { error } = await supabase.from('project_investors').insert({
    project_id: projectId,
    investor_id: investorId,
    user_id: user.id,
    status: 'verknuepft',
  })

  if (error && error.code !== '23505') throw new Error(error.message)

  revalidatePath(`/projects/${projectId}/investors`)
}
