'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { ProjectType, ProjectStatus, ProjectPriority, MarketingStatus, DevStatus } from '@/lib/types/database.types'

const PROJECT_IMAGE_BUCKET = 'project-images'
const MAX_PROJECT_IMAGE_SIZE = 8 * 1024 * 1024
const ALLOWED_PROJECT_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

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
  return value || null
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

function getProjectImage(formData: FormData): File | null {
  const value = formData.get('project_image')
  if (!value || typeof value === 'string' || value.size === 0) return null
  return value
}

function validateProjectImage(file: File | null): string | null {
  if (!file) return null
  if (!ALLOWED_PROJECT_IMAGE_TYPES.has(file.type)) return 'Das Projektbild muss JPG, PNG oder WEBP sein.'
  if (file.size > MAX_PROJECT_IMAGE_SIZE) return 'Das Projektbild darf maximal 8 MB groß sein.'
  return null
}

async function uploadProjectImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  projectId: string,
  file: File,
): Promise<{ url: string; path: string } | { error: string }> {
  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${userId}/${projectId}/${randomUUID()}.${extension}`
  const bytes = Buffer.from(await file.arrayBuffer())
  const { error } = await supabase.storage.from(PROJECT_IMAGE_BUCKET).upload(path, bytes, { contentType: file.type, upsert: false })
  if (error) {
    console.error('[uploadProjectImage]', error)
    return { error: 'Das Projektbild konnte nicht hochgeladen werden.' }
  }
  const { data } = supabase.storage.from(PROJECT_IMAGE_BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, path }
}

async function logActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: { userId: string; projectId?: string; type: string; title: string; description?: string; metadata?: Record<string, unknown> },
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
  let query = supabase.from('v_projects_with_deals').select('*').eq('user_id', userId).eq('is_archived', false).order('last_activity_at', { ascending: false })
  if (filters?.type) query = query.eq('project_type', filters.type)
  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.search) query = query.or(`project_name.ilike.%${filters.search}%,project_number.ilike.%${filters.search}%,location_city.ilike.%${filters.search}%`)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getProject(id: string) {
  const { supabase, userId } = await requireUser()
  const { data, error } = await supabase.from('v_projects_with_deals').select('*').eq('id', id).eq('user_id', userId).single()
  if (error) throw new Error(error.message)
  return data
}

function projectPayload(formData: FormData) {
  const projectType = getString(formData, 'project_type') as ProjectType
  const projectStage = getString(formData, 'project_stage')
  return {
    project_name: getString(formData, 'project_name'),
    project_type: projectType,
    status: (getStringOrNull(formData, 'status') as ProjectStatus) ?? 'lead',
    project_stage: ['planung', 'rtb', 'betrieb'].includes(projectStage) ? projectStage : 'planung',
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
    lease_term_years: getNumberOrNull(formData, 'lease_term_years'),
    pv_mwp: getNumberOrNull(formData, 'pv_mwp'),
    pv_ac_mw: getNumberOrNull(formData, 'pv_ac_mw'),
    bess_mw: getNumberOrNull(formData, 'bess_mw'),
    bess_mwh: getNumberOrNull(formData, 'bess_mwh'),
    bess_duration_h: getNumberOrNull(formData, 'bess_dur'),
    data_center_grid_mw: projectType === 'rechenzentrum' ? getNumberOrNull(formData, 'data_center_grid_mw') : null,
    data_center_it_mw: projectType === 'rechenzentrum' ? getNumberOrNull(formData, 'data_center_it_mw') : null,
    land_area_sqm: projectType === 'rechenzentrum' ? getNumberOrNull(formData, 'land_area_sqm') : null,
    transformer_status: projectType === 'rechenzentrum' ? getStringOrNull(formData, 'transformer_status') : null,
    data_center_status: projectType === 'rechenzentrum' ? (projectStage === 'rtb' ? 'rtb' : 'in_entwicklung') : null,
    hybrid_config: null,
    dev_status: buildDevStatus(formData),
    notes: getStringOrNull(formData, 'notes'),
  }
}

export async function createProject(formData: FormData) {
  const { supabase, userId } = await requireUser()
  const payload = projectPayload(formData)
  const image = getProjectImage(formData)
  const imageError = validateProjectImage(image)
  if (imageError) return { error: imageError }
  if (!payload.project_name) return { error: 'Projektname fehlt' }
  if (!payload.project_type) return { error: 'Projekttyp fehlt' }

  const { data, error } = await supabase.from('projects').insert({ ...payload, user_id: userId, tags: [], is_archived: false } as never).select('id, project_number, project_name').single()
  if (error || !data) return { error: error?.message ?? 'Projekt konnte nicht erstellt werden' }

  if (image) {
    const uploaded = await uploadProjectImage(supabase, userId, data.id, image)
    if ('error' in uploaded) {
      await supabase.from('projects').delete().eq('id', data.id).eq('user_id', userId)
      return { error: uploaded.error }
    }
    const { error: imageUpdateError } = await supabase.from('projects').update({ project_image_url: uploaded.url } as never).eq('id', data.id).eq('user_id', userId)
    if (imageUpdateError) {
      await supabase.storage.from(PROJECT_IMAGE_BUCKET).remove([uploaded.path])
      await supabase.from('projects').delete().eq('id', data.id).eq('user_id', userId)
      return { error: 'Das Projektbild konnte nicht mit dem Projekt verknüpft werden.' }
    }
  }

  await logActivity(supabase, { userId, projectId: data.id, type: 'manual', title: 'Projekt erstellt', description: `${data.project_number} – ${data.project_name}`, metadata: { project_number: data.project_number } })
  revalidatePath('/projects')
  revalidatePath('/dashboard')
  redirect(`/projects/${data.id}/overview`)
}

export async function updateProject(id: string, formData: FormData) {
  const { supabase, userId } = await requireUser()
  const payload = projectPayload(formData)
  const image = getProjectImage(formData)
  const imageError = validateProjectImage(image)
  if (imageError) return { error: imageError }
  if (!payload.project_name) return { error: 'Projektname fehlt' }

  let imageUrl = getStringOrNull(formData, 'existing_project_image_url')
  if (image) {
    const uploaded = await uploadProjectImage(supabase, userId, id, image)
    if ('error' in uploaded) return { error: uploaded.error }
    imageUrl = uploaded.url
  }

  const { error } = await supabase.from('projects').update({ ...payload, project_image_url: imageUrl } as never).eq('id', id).eq('user_id', userId)
  if (error) return { error: error.message }
  await logActivity(supabase, { userId, projectId: id, type: 'manual', title: 'Projekt aktualisiert', description: 'Projektdaten wurden bearbeitet' })
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
  await logActivity(supabase, { userId, projectId: id, type: 'manual', title: 'Projekt archiviert', description: project ? `${project.project_number} – ${project.project_name}` : undefined })
  revalidatePath('/projects')
  revalidatePath('/dashboard')
  redirect('/projects')
}

export async function addActivityNote(projectId: string, formData: FormData) {
  const { supabase, userId } = await requireUser()
  const note = getString(formData, 'note')
  if (!note) return { error: 'Notiz darf nicht leer sein' }
  await logActivity(supabase, { userId, projectId, type: 'note_added', title: 'Notiz hinzugefügt', description: note })
  revalidatePath(`/projects/${projectId}/activity`)
  return { success: true }
}

export async function getActivityLog(projectId: string) {
  const { supabase, userId } = await requireUser()
  const { data, error } = await supabase.from('activity_log').select('*').eq('project_id', projectId).eq('user_id', userId).order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}