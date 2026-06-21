'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type {
  InsertProject, UpdateProject,
  ProjectType, ProjectStatus, ProjectPriority,
  MarketingStatus, DevStatus,
} from '@/lib/types/database.types'

// ── Helper: get current user or throw ────────────────────────────────────────
async function requireUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  return { supabase, userId: user.id }
}

// ── Helper: null-sicheres Auslesen von String-Feldern ─────────────────────────
// formData.get() liefert `FormDataEntryValue | null`. Diese Helfer stellen
// sicher, dass nie .trim() oder parseFloat() auf null aufgerufen wird.

function getString(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function getStringOrNull(formData: FormData, key: string): string | null {
  const value = getString(formData, key)
  return value.length > 0 ? value : null
}

function getNumberOrNull(formData: FormData, key: string): number | null {
  const value = formData.get(key)
  if (typeof value !== 'string' || value.trim() === '') return null
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

function getTriState(formData: FormData, key: string): boolean | null {
  const value = formData.get(key)
  if (value === 'true')  return true
  if (value === 'false') return false
  return null
}

function buildDevStatus(formData: FormData): DevStatus {
  return {
    netzanschluss:  getTriState(formData, 'dev_netzanschluss'),
    baugenehmigung: getTriState(formData, 'dev_baugenehmigung'),
    pachtvertrag:   getTriState(formData, 'dev_pachtvertrag'),
    eeg_faehigkeit: getTriState(formData, 'dev_eeg'),
    gutachten:      getTriState(formData, 'dev_gutachten'),
    umweltpruefung: getTriState(formData, 'dev_umwelt'),
  }
}

// ── Helper: log activity ──────────────────────────────────────────────────────
async function logActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    userId:       string
    projectId?:   string
    type:         string
    title:        string
    description?: string
    oldValue?:    string
    newValue?:    string
    metadata?:    Record<string, unknown>
  }
) {
  await supabase.from('activity_log').insert({
    user_id:       params.userId,
    project_id:    params.projectId ?? null,
    activity_type: params.type as never,
    title:         params.title,
    description:   params.description ?? null,
    old_value:     params.oldValue ?? null,
    new_value:     params.newValue ?? null,
    metadata:      params.metadata ?? {},
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH PROJECTS
// ─────────────────────────────────────────────────────────────────────────────

export async function getProjects(filters?: {
  type?:   ProjectType
  status?: ProjectStatus
  search?: string
}) {
  const { supabase, userId } = await requireUser()

  let query = supabase
    .from('v_projects_with_deals')
    .select('*')
    .eq('user_id', userId)
    .eq('is_archived', false)
    .order('last_activity_at', { ascending: false })

  if (filters?.type)   query = query.eq('project_type', filters.type)
  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.search) {
    query = query.or(
      `project_name.ilike.%${filters.search}%,` +
      `project_number.ilike.%${filters.search}%,` +
      `location_city.ilike.%${filters.search}%`
    )
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH SINGLE PROJECT
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// CREATE PROJECT
// ─────────────────────────────────────────────────────────────────────────────

export async function createProject(formData: FormData) {
  const { supabase, userId } = await requireUser()

  // ── Pflichtfeld-Validierung ZUERST, bevor irgendetwas anderes passiert ────
  const projectName = getString(formData, 'project_name')
  if (!projectName) {
    return { error: 'Projektname fehlt' }
  }

  const projectTypeRaw = formData.get('project_type')
  if (typeof projectTypeRaw !== 'string' || projectTypeRaw.length === 0) {
    return { error: 'Projekttyp fehlt' }
  }
  const projectType = projectTypeRaw as ProjectType

  const devStatus = buildDevStatus(formData)

  const insertData: any = {
    user_id:          userId,
    project_name:     projectName,
    project_type:     projectType,
    status:           (getStringOrNull(formData, 'status')           as ProjectStatus)   ?? 'lead',
    priority:         (getStringOrNull(formData, 'priority')         as ProjectPriority) ?? 'mittel',
    marketing_status: (getStringOrNull(formData, 'marketing_status') as MarketingStatus) ?? 'nicht_gestartet',
    partner_id:       getStringOrNull(formData, 'partner_id'),
    contact_name:     getStringOrNull(formData, 'contact_name'),
    contact_email:    getStringOrNull(formData, 'contact_email'),
    contact_phone:    getStringOrNull(formData, 'contact_phone'),
    location_city:    getStringOrNull(formData, 'location_city'),
    location_state:   getStringOrNull(formData, 'location_state'),
    location_country: getStringOrNull(formData, 'location_country') ?? 'Deutschland',
    // PV
    pv_mwp:           getNumberOrNull(formData, 'pv_mwp'),
    pv_ac_mw:         getNumberOrNull(formData, 'pv_ac_mw'),
    // BESS
    bess_mw:          getNumberOrNull(formData, 'bess_mw'),
    bess_mwh:         getNumberOrNull(formData, 'bess_mwh'),
    bess_duration_h:  getNumberOrNull(formData, 'bess_dur'),
    // Hybrid
    hybrid_config:    null,
    dev_status:       devStatus,
    notes:            getStringOrNull(formData, 'notes'),
    tags:             [],
    is_archived:      false,
  }

  // project_number wird automatisch durch den DB-Trigger vergeben (siehe 001_initial_schema.sql)
  const { data, error } = await supabase
    .from('projects')
    .insert(insertData as never)
    .select('id, project_number, project_name')
    .single()

  if (error) {
    console.error('❌ createProject Fehler:', {
      message: error.message,
      details: error.details,
      hint:    error.hint,
      code:    error.code,
    })
    return { error: error.message }
  }

  // Erstellung im Activity Log vermerken
  await logActivity(supabase, {
    userId,
    projectId:   data.id,
    type:        'manual',
    title:       'Projekt erstellt',
    description: `${data.project_number} – ${data.project_name}`,
    metadata:    { project_number: data.project_number },
  })

  revalidatePath('/projects')
  redirect(`/projects/${data.id}/overview`)
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE PROJECT
// ─────────────────────────────────────────────────────────────────────────────

export async function updateProject(id: string, formData: FormData) {
  const { supabase, userId } = await requireUser()

  // ── Pflichtfeld-Validierung ────────────────────────────────────────────────
  const projectName = getString(formData, 'project_name')
  if (!projectName) {
    return { error: 'Projektname fehlt' }
  }

  // Fetch current state for activity log diff
  const { data: current } = await supabase
    .from('projects')
    .select('status, project_name, priority, marketing_status')
    .eq('id', id)
    .single()

  const devStatus = buildDevStatus(formData)

  const statusValue = getStringOrNull(formData, 'status') as ProjectStatus | null

  const updates: UpdateProject = {
    project_name:     projectName,
    status:           statusValue ?? 'lead',
    priority:         (getStringOrNull(formData, 'priority')         as ProjectPriority) ?? 'mittel',
    marketing_status: (getStringOrNull(formData, 'marketing_status') as MarketingStatus) ?? 'nicht_gestartet',
    partner_id:       getStringOrNull(formData, 'partner_id'),
    contact_name:     getStringOrNull(formData, 'contact_name'),
    contact_email:    getStringOrNull(formData, 'contact_email'),
    contact_phone:    getStringOrNull(formData, 'contact_phone'),
    location_city:    getStringOrNull(formData, 'location_city'),
    location_state:   getStringOrNull(formData, 'location_state'),
    location_country: getStringOrNull(formData, 'location_country') ?? 'Deutschland',
    pv_mwp:           getNumberOrNull(formData, 'pv_mwp'),
    pv_ac_mw:         getNumberOrNull(formData, 'pv_ac_mw'),
    bess_mw:          getNumberOrNull(formData, 'bess_mw'),
    bess_mwh:         getNumberOrNull(formData, 'bess_mwh'),
    bess_duration_h:  getNumberOrNull(formData, 'bess_dur'),
    dev_status:       devStatus,
    notes:            getStringOrNull(formData, 'notes'),
  }

  const { error } = await supabase
    .from('projects')
    .update(updates as never)
    .eq('id', id)
    .eq('user_id', userId)

  if (error) {
    console.error('❌ updateProject Fehler:', {
      message: error.message,
      details: error.details,
      hint:    error.hint,
      code:    error.code,
    })
    return { error: error.message }
  }

  // Statusänderung wird bereits automatisch durch DB-Trigger geloggt.
  // Hier nur zusätzlichen Eintrag schreiben, wenn sich der Status NICHT geändert hat
  // (sonst doppelter Log-Eintrag).
  const newStatus = getStringOrNull(formData, 'status')
  if (current && current.status === newStatus) {
    await logActivity(supabase, {
      userId,
      projectId:   id,
      type:        'manual',
      title:       'Projekt aktualisiert',
      description: 'Projektdaten wurden bearbeitet',
    })
  }

  revalidatePath(`/projects/${id}`)
  revalidatePath('/projects')
  redirect(`/projects/${id}/overview`)
}

// ─────────────────────────────────────────────────────────────────────────────
// SOFT DELETE (archive)
// ─────────────────────────────────────────────────────────────────────────────

export async function archiveProject(id: string) {
  const { supabase, userId } = await requireUser()

  const { data: proj } = await supabase
    .from('projects')
    .select('project_name, project_number')
    .eq('id', id)
    .single()

  const { error } = await supabase
    .from('projects')
    .update({ is_archived: true } as never)
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { error: error.message }

  await logActivity(supabase, {
    userId,
    projectId:   id,
    type:        'manual',
    title:       'Projekt archiviert',
    description: `${proj?.project_number ?? ''} – ${proj?.project_name ?? ''}`,
  })

  revalidatePath('/projects')
  redirect('/projects')
}

// ─────────────────────────────────────────────────────────────────────────────
// ADD MANUAL ACTIVITY NOTE
// ─────────────────────────────────────────────────────────────────────────────

export async function addActivityNote(projectId: string, formData: FormData) {
  const { supabase, userId } = await requireUser()

  const note = getString(formData, 'note')
  if (!note) return { error: 'Notiz darf nicht leer sein' }

  await logActivity(supabase, {
    userId,
    projectId,
    type:        'note_added',
    title:       'Notiz hinzugefügt',
    description: note,
  })

  revalidatePath(`/projects/${projectId}/activity`)
  return { success: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH ACTIVITY LOG
// ─────────────────────────────────────────────────────────────────────────────

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
