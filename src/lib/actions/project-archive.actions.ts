'use server'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const ADMIN_ROLES = new Set(['admin', 'owner'])

async function requireUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  return { supabase, userId: user.id }
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) return null

  return createAdminClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
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
    .select('id, user_id, location_country')
    .eq('id', id)
    .maybeSingle()

  if (projectError) return { error: `Projekt konnte nicht geprüft werden: ${projectError.message}` }
  if (!project) return { error: 'Projekt wurde nicht gefunden.' }

  const projectOwnerId = String(project.user_id)
  const ownsProject = projectOwnerId === userId
  let deleteClient = supabase

  if (!ownsProject) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle()

    if (profileError || !profile || !ADMIN_ROLES.has(String(profile.role).toLowerCase())) {
      return { error: 'Keine Berechtigung, dieses Projekt zu löschen.' }
    }

    const adminClient = getAdminClient()
    if (!adminClient) return { error: 'Die administrative Löschfunktion ist nicht konfiguriert.' }
    deleteClient = adminClient
  }

  const { data: documents, error: documentsError } = await deleteClient
    .from('documents')
    .select('file_path, external_provider')
    .eq('project_id', id)
    .eq('user_id', projectOwnerId)

  if (documentsError) return { error: `Projektunterlagen konnten nicht geprüft werden: ${documentsError.message}` }

  const documentPaths = (documents ?? [])
    .filter((item: { external_provider: string | null }) => item.external_provider !== 'project-imports')
    .map((item: { file_path: string | null }) => item.file_path)
    .filter((path): path is string => Boolean(path))
  if (documentPaths.length) {
    const { error: documentStorageError } = await deleteClient.storage.from('project-documents').remove(documentPaths)
    if (documentStorageError) return { error: `Projektunterlagen konnten nicht gelöscht werden: ${documentStorageError.message}` }
  }

  const imageFolder = `${projectOwnerId}/${id}`
  const { data: imageFiles, error: imageListError } = await deleteClient.storage.from('project-images').list(imageFolder, { limit: 1000 })
  if (imageListError) return { error: `Projektbilder konnten nicht geprüft werden: ${imageListError.message}` }
  if (imageFiles?.length) {
    const { error: imageStorageError } = await deleteClient.storage.from('project-images').remove(imageFiles.map((file) => `${imageFolder}/${file.name}`))
    if (imageStorageError) return { error: `Projektbilder konnten nicht gelöscht werden: ${imageStorageError.message}` }
  }

  let deleteQuery = deleteClient
    .from('projects')
    .delete()
    .eq('id', id)
    .select('id')

  if (ownsProject) deleteQuery = deleteQuery.eq('user_id', userId)

  const { data: deletedProject, error } = await deleteQuery.maybeSingle()

  if (error) return { error: `Projekt konnte nicht endgültig gelöscht werden: ${error.message}` }
  if (!deletedProject) return { error: 'Projekt konnte nicht endgültig gelöscht werden. Bitte lade das Archiv neu und versuche es erneut.' }

  revalidatePath('/projects')
  revalidatePath('/projects/archive')
  revalidatePath('/dashboard')
  if (project.location_country) revalidatePath(`/projects/country/${encodeURIComponent(String(project.location_country))}`)
  return { success: true }
}
