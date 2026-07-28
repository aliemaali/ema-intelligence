'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  return { supabase, userId: user.id }
}

export async function getArchivedProjects() {
  const { supabase, userId } = await requireUser()
  const { data, error } = await supabase
    .from('v_projects_with_deals')
    .select('*')
    .eq('user_id', userId)
    .eq('is_archived', true)
    .order('last_activity_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function restoreProject(id: string) {
  const { supabase, userId } = await requireUser()
  const { error } = await supabase
    .from('projects')
    .update({ is_archived: false } as never)
    .eq('id', id)
    .eq('user_id', userId)
    .eq('is_archived', true)

  if (error) return { error: error.message }

  await supabase.from('activity_log').insert({
    user_id: userId,
    project_id: id,
    activity_type: 'manual' as never,
    title: 'Projekt wiederhergestellt',
    description: 'Das Projekt wurde aus dem Archiv wiederhergestellt.',
    metadata: {},
  })

  revalidatePath('/projects')
  revalidatePath('/projects/archive')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function permanentlyDeleteProject(id: string) {
  const { supabase, userId } = await requireUser()

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, is_archived')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (projectError || !project) return { error: 'Projekt wurde nicht gefunden.' }
  if (!project.is_archived) return { error: 'Nur archivierte Projekte können endgültig gelöscht werden.' }

  const { data: documents } = await supabase
    .from('project_documents')
    .select('file_path')
    .eq('project_id', id)
    .eq('user_id', userId)

  const documentPaths = (documents ?? []).map((item: { file_path: string | null }) => item.file_path).filter((path): path is string => Boolean(path))
  if (documentPaths.length) await supabase.storage.from('project-documents').remove(documentPaths)

  const { data: imageFiles } = await supabase.storage.from('project-images').list(`${userId}/${id}`)
  if (imageFiles?.length) {
    await supabase.storage.from('project-images').remove(imageFiles.map((file) => `${userId}/${id}/${file.name}`))
  }

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .eq('is_archived', true)

  if (error) return { error: `Projekt konnte nicht endgültig gelöscht werden: ${error.message}` }

  revalidatePath('/projects')
  revalidatePath('/projects/archive')
  revalidatePath('/dashboard')
  return { success: true }
}
