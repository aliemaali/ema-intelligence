'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type DevelopmentValue = boolean | null

const ALLOWED_KEYS = new Set([
  'expose',
  'pv_sol',
  'netzanschluss',
  'baugenehmigung',
  'pachtvertrag',
  'eeg_faehigkeit',
  'gutachten',
  'umweltpruefung',
])

async function requireUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  return { supabase, userId: user.id }
}

export async function updateProjectDevelopmentStatus(
  projectId: string,
  key: string,
  value: DevelopmentValue,
) {
  if (!ALLOWED_KEYS.has(key)) return { error: 'Ungültiger Entwicklungsstatus.' }
  if (value !== true && value !== false && value !== null) return { error: 'Ungültiger Statuswert.' }

  const { supabase, userId } = await requireUser()
  const { data: project, error: readError } = await supabase
    .from('projects')
    .select('dev_status')
    .eq('id', projectId)
    .eq('user_id', userId)
    .maybeSingle()

  if (readError || !project) return { error: 'Projekt wurde nicht gefunden.' }

  const current = project.dev_status && typeof project.dev_status === 'object'
    ? project.dev_status as Record<string, boolean | null>
    : {}

  const next = { ...current, [key]: value }
  const { error } = await supabase
    .from('projects')
    .update({ dev_status: next } as never)
    .eq('id', projectId)
    .eq('user_id', userId)

  if (error) return { error: error.message }

  await supabase.from('activity_log').insert({
    user_id: userId,
    project_id: projectId,
    activity_type: 'manual' as never,
    title: 'Entwicklungsstand aktualisiert',
    description: `${key}: ${value === true ? 'Erfüllt' : value === false ? 'Nicht erfüllt' : 'Offen'}`,
    metadata: { key, value },
  })

  revalidatePath(`/projects/${projectId}/overview`)
  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/dashboard')
  return { success: true }
}
