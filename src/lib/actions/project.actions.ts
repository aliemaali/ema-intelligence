'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type {
  ProjectType, ProjectStatus, ProjectPriority,
  MarketingStatus, DevStatus,
} from '@/lib/types/database.types'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  return { supabase, userId: user.id }
}

function getString(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function getStringOrNull(formData: FormData, key: string): string | null {
  const value = getString(formData, key)
  return value ? value : null
}

function getNumberOrNull(formData: FormData, key: string): number | null {
  const value = getString(formData, key).replace(',', '.')
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function getTriState(formData: FormData, key: string): boolean | null {
  const value = formData.get(key)
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

function buildDevStatus(formData: FormData): DevStatus {
  return {
    netzanschluss: getTriState(formData, 'dev_netzanschluss'),
    baugenehmigung: getTriState(formData, 'dev_baugenehmigung'),
    pachtvertrag: getTriState(formData, 'dev_pachtvertrag'),
    eeg_faehigkeit: getTriState(formData, 'dev_eeg'),
    gutachten: getTriState(formData, 'dev_gutachten'),
    umweltpruefung: getTriState(formData, 'dev_umwelt'),
  }
}

async function logActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    userId: string
    projectId?: string
    type: string
    title: string
    description?: string
    metadata?: Record<string, unknown>
  },
) {
  await supabase.from('activity_log').insert({
    user_id: params.userId,
    project_id: params.projectId ?? null,
    activity_type: params.type as never,
    title: params.title,
    description: params.description ?? null,
    metadata: params.metadata ?? {},
  })
}

export async function getProjects(filters?: { type?: ProjectType; status?: ProjectStatus; search?: string }) {
  const { supabase, userId } = await requireUser()
  let query = supabase
    .from('v_projects_with_deals')
    .select('*')
    .eq('user_id', userId)
    .eq('is_archived', false)
    .order('last_activity_at', { ascending: false })

  if (filters?.type) query = query.eq('project_type', filters.type)
  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.search) {
    query = query.or(`project_name.ilike.%${filters.search}%,project_number.ilike.%${filters.search}%,location_city.ilike.%${filters.search}%`)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getProject(id: string) {
  const { supabase, userId } = await requireUser()
  const { data, error } = await supabase
    .from('v_projects_with_deals')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (error) throw new Error(error.message)
  return data
}

function projectPayload(formData: FormData) {
  const projectType = getString(formData, 'project_type') as ProjectType
  const dataCenterStatus = projectType === 'rechenzentrum'
    ? (getStringOrNull(formData, 'data_center_status') ?? 'in_entwicklung')
    : null

  return {
    project_name: getString(formData, 'project_name'),
    project_type: projectType,
    status: (getStringOrNull(formData, 'status') as ProjectStatus) ?? 'lead',
    priority: (getStringOrNull(formData, 'priority') as ProjectPriority) ?? 'mittel',
    marketing_status: (getStringOrNull(formData, 'marketing_status') as MarketingStatus) ?? 'nicht_gestartet',
    partner_id: getStringOrNull(formData, 'partner_id'),
    contact_name: getStringOrNull(formData, 'contact_name'),
    contact_email: getStringOrNull(formData, 'contact_email'),
    contact_phone: getStringOrNull(formData, 'contact_phone'),
    location_city: getStringOrNull(formData, 'location_city'),
    location_state: getStringOrNull(formData, 'location_state'),
    location_country: getStringOrNull(formData, 'location_country') ?? 'Deutschland',
    investment_volume_eur: getNumberOrNull(formData, 'investment_volume_eur'),
    pv_mwp: getNumberOrNull(formData, 'pv_mwp'),
    pv_ac_mw: getNumberOrNull(formData, 'pv_ac_mw'),
    bess_mw: getNumberOrNull(formData, 'bess_mw'),
    bess_mwh: getNumberOrNull(formData, 'bess_mwh'),
    bess_duration_h: getNumberOrNull(formData, 'bess_dur'),
    data_center_grid_mw: projectType === 'rechenzentrum' ? getNumberOrNull(formData, 'data_center_grid_mw') : null,
    data_center_it_mw: projectType === 'rechenzentrum' ? getNumberOrNull(formData, 'data_center_it_mw') : null,
    land_area_sqm: projectType === 'rechenzentrum' ? getNumberOrNull(formData, 'land_area_sqm') : null,
    transformer_status: projectType === 'rechenzentrum' ? getStringOrNull(formData, 'transformer_status') : null,
    data_center_status: dataCenterStatus,
    hybrid_config: null,
    dev_status: buildDevStatus(formData),
    notes: getStringOrNull(formData, 'notes'),
  }
}

export async function createProject(formData: FormData) {
  const { supabase, userId } = await requireUser()
  const payload = projectPayload(formData)

  if (!payload.project_name) return { error: 'Projektname fehlt' }
  if (!payload.project_type) return { error: 'Projekttyp fehlt' }

  const { data, error } = await supabase
    .from('projects')
    .insert({ ...payload, user_id: userId, tags: [], is_archived: false } as never)
    .select('id, project_number, project_name')
    .single()

  if (error || !data) return { error: error?.message ?? 'Projekt konnte nicht erstellt werden' }

  await logActivity(supabase, {
    userId,
    projectId: data.id,
    type: 'manual',
    title: 'Projekt erstellt',
    description: `${data.project_number} – ${data.project_name}`,
    metadata: { project_number: data.project_number },
  })

  revalidatePath('/projects')
  revalidatePath('/dashboard')
  redirect(`/projects/${data.id}/overview`)
}

export async function updateProject(id: string, formData: FormData) {
  const { supabase, userId } = await requireUser()
  const payload = projectPayload(formData)
  if (!payload.project_name) return { error: 'Projektname fehlt' }

  const { error } = await supabase
    .from('projects')
    .update(payload as never)
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { error: error.message }

  await logActivity(supabase, {
    userId,
    projectId: id,
    type: 'manual',
    title: 'Projekt aktualisiert',
    description: 'Projektdaten wurden bearbeitet',
  })

  revalidatePath(`/projects/${id}`)
  revalidatePath(`/expose/${id}`)
  revalidatePath('/projects')
  revalidatePath('/dashboard')
  redirect(`/projects/${id}/overview`)
}

export async function archiveProject(id: string) {
  const { supabase, userId } = await requireUser()
  const { data: project } = await supabase.from('projects').select('project_name, project_number').eq('id', id).eq('user_id', userId).single()
  const { error } = await supabase.from('projects').update({ is_archived: true } as never).eq('id', id).eq('user_id', userId)
  if (error) return { error: error.message }

  await logActivity(supabase, {
    userId,
    projectId: id,
    type: 'manual',
    title: 'Projekt archiviert',
    description: project ? `${project.project_number} – ${project.project_name}` : undefined,
  })

  revalidatePath('/projects')
  revalidatePath('/dashboard')
  redirect('/projects')
}

export async function addActivityNote(projectId: string, formData: FormData) {
  const { supabase, userId } = await requireUser()
  const note = getString(formData, 'note')
  if (!note) return { error: 'Notiz darf nicht leer sein' }

  await logActivity(supabase, {
    userId,
    projectId,
    type: 'note_added',
    title: 'Notiz hinzugefügt',
    description: note,
  })

  revalidatePath(`/projects/${projectId}/activity`)
  return { success: true }
}

export async function getActivityLog(projectId: string) {
  const { supabase, userId } = await requireUser()
  const { data, error } = await supabase
    .from('activity_log')
    .select('*')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}
