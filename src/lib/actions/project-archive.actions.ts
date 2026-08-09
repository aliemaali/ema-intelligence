'use server'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const ADMIN_ROLES = new Set(['admin', 'owner'])

type ProjectAccessRow = {
  id: string
  user_id: string
  location_country: string | null
  project_name: string
  project_number: string | null
  is_archived: boolean
}

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

async function getAuthorizedProjectAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  id: string,
) {
  const { data, error } = await supabase
    .from('projects')
    .select('id, user_id, location_country, project_name, project_number, is_archived')
    .eq('id', id)
    .maybeSingle()

  if (error) return { error: `Projekt konnte nicht geprüft werden: ${error.message}` } as const
  if (data && String(data.user_id) === userId) {
    return { project: data as ProjectAccessRow, projectClient: supabase } as const
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  if (profileError || !profile || !ADMIN_ROLES.has(String(profile.role).toLowerCase())) {
    return { error: 'Keine Berechtigung, dieses Projekt zu verwalten.' } as const
  }

  const adminClient = getAdminClient()
  if (!adminClient) return { error: 'Die administrative Projektverwaltung ist nicht konfiguriert.' } as const

  if (data) return { project: data as ProjectAccessRow, projectClient: adminClient } as const

  const { data: adminProject, error: adminProjectError } = await adminClient
    .from('projects')
    .select('id, user_id, location_country, project_name, project_number, is_archived')
    .eq('id', id)
    .maybeSingle()

  if (adminProjectError) return { error: `Projekt konnte nicht geprüft werden: ${adminProjectError.message}` } as const
  if (!adminProject) return { error: 'Projekt wurde nicht gefunden.' } as const
  return { project: adminProject as ProjectAccessRow, projectClient: adminClient } as const
}

export async function getArchivedProjects() {
  const { supabase, userId } = await requireUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  const isAdmin = ADMIN_ROLES.has(String(profile?.role ?? '').toLowerCase())
  const archiveClient = isAdmin ? getAdminClient() ?? supabase : supabase
  let query = archiveClient
    .from('v_projects_with_deals')
    .select('*')
    .eq('is_archived', true)
    .order('last_activity_at', { ascending: false })

  if (!isAdmin) query = query.eq('user_id', userId)

  const { data, error } = await query

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function archiveProject(id: string) {
  const { supabase, userId } = await requireUser()
  const access = await getAuthorizedProjectAccess(supabase, userId, id)
  if ('error' in access) return { error: access.error }
  if (access.project.is_archived) return { error: 'Das Projekt befindet sich bereits im Archiv.' }

  const { error } = await access.projectClient
    .from('projects')
    .update({ is_archived: true } as never)
    .eq('id', id)
    .eq('is_archived', false)

  if (error) return { error: `Projekt konnte nicht archiviert werden: ${error.message}` }

  await access.projectClient.from('activity_log').insert({
    user_id: access.project.user_id,
    project_id: id,
    activity_type: 'manual' as never,
    title: 'Projekt archiviert',
    description: `${access.project.project_number ?? 'Ohne Projektnummer'} – ${access.project.project_name}`,
    metadata: { archived_by: userId },
  })

  revalidatePath('/projects')
  revalidatePath('/projects/archive')
  revalidatePath('/dashboard')
  if (access.project.location_country) revalidatePath(`/projects/country/${encodeURIComponent(access.project.location_country)}`)
  return { success: true }
}

export async function restoreProject(id: string) {
  const { supabase, userId } = await requireUser()
  const access = await getAuthorizedProjectAccess(supabase, userId, id)
  if ('error' in access) return { error: access.error }
  if (!access.project.is_archived) return { error: 'Das Projekt befindet sich nicht im Archiv.' }

  const { error } = await access.projectClient
    .from('projects')
    .update({ is_archived: false } as never)
    .eq('id', id)
    .eq('is_archived', true)

  if (error) return { error: error.message }

  await access.projectClient.from('activity_log').insert({
    user_id: access.project.user_id,
    project_id: id,
    activity_type: 'manual' as never,
    title: 'Projekt wiederhergestellt',
    description: 'Das Projekt wurde aus dem Archiv wiederhergestellt.',
    metadata: { restored_by: userId },
  })

  revalidatePath('/projects')
  revalidatePath('/projects/archive')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function permanentlyDeleteProject(id: string) {
  const { supabase, userId } = await requireUser()
  const access = await getAuthorizedProjectAccess(supabase, userId, id)
  if ('error' in access) return { error: access.error }
  if (!access.project.is_archived) {
    return { error: 'Ein Projekt kann nur aus dem Archiv endgültig gelöscht werden.' }
  }

  const projectOwnerId = access.project.user_id
  const deleteClient = access.projectClient

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

  const deleteQuery = deleteClient
    .from('projects')
    .delete()
    .eq('id', id)
    .eq('is_archived', true)
    .select('id')

  const { data: deletedProject, error } = await deleteQuery.maybeSingle()

  if (error) return { error: `Projekt konnte nicht endgültig gelöscht werden: ${error.message}` }
  if (!deletedProject) return { error: 'Projekt konnte nicht endgültig gelöscht werden. Bitte lade das Archiv neu und versuche es erneut.' }

  revalidatePath('/projects')
  revalidatePath('/projects/archive')
  revalidatePath('/dashboard')
  if (access.project.location_country) revalidatePath(`/projects/country/${encodeURIComponent(access.project.location_country)}`)
  return { success: true }
}
