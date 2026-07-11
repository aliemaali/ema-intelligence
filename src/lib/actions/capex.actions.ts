// src/lib/actions/capex.actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  capexProjectToRow,
  rowToCapexProject,
  type CapexCalculationRow,
  type CapexProject,
  type ProjectOption,
} from '@/lib/types/capex.types'

const CAPEX_HIDDEN_TAG = 'hide_from_capex'

/** Lädt alle sichtbaren Projekte für den CAPEX-Projekt-Picker. */
export async function getProjectOptions(): Promise<ProjectOption[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('projects')
    .select('id, project_name, tags, is_archived')
    .eq('is_archived', false)
    .order('project_name', { ascending: true })

  if (error) {
    console.error('getProjectOptions error:', error)
    return []
  }

  return (data ?? [])
    .filter((project: any) => !Array.isArray(project.tags) || !project.tags.includes(CAPEX_HIDDEN_TAG))
    .map((project: any) => ({
      id: project.id,
      name: project.project_name,
    }))
}

/** Entfernt ein Projekt nur aus dem CAPEX-Picker, ohne das Hauptprojekt zu löschen. */
export async function hideProjectFromCapex(projectId: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: project, error: readError } = await supabase
    .from('projects')
    .select('tags')
    .eq('id', projectId)
    .single()

  if (readError) return { error: readError.message }

  const tags = Array.isArray(project?.tags) ? project.tags : []
  const nextTags = tags.includes(CAPEX_HIDDEN_TAG) ? tags : [...tags, CAPEX_HIDDEN_TAG]

  const { error } = await supabase
    .from('projects')
    .update({ tags: nextTags } as never)
    .eq('id', projectId)

  if (error) return { error: error.message }

  revalidatePath('/capex')
  return { error: null }
}

/** Lädt alle CAPEX-Kalkulationen für ein gegebenes Projekt. */
export async function getCapexCalculationsForProject(
  projectId: string
): Promise<CapexProject[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('capex_calculations')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('getCapexCalculationsForProject error:', error)
    return []
  }
  return (data ?? []).map((row) => rowToCapexProject(row as CapexCalculationRow))
}

/** Lädt eine einzelne CAPEX-Kalkulation per ID. */
export async function getCapexCalculation(id: string): Promise<CapexProject | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('capex_calculations')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    console.error('getCapexCalculation error:', error)
    return null
  }
  return rowToCapexProject(data as CapexCalculationRow)
}

/** Speichert eine CAPEX-Kalkulation (Insert bei neuer, Update bei vorhandener id). */
export async function saveCapexCalculation(
  project: CapexProject
): Promise<{ data: CapexProject | null; error: string | null }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!project.projectId) {
    return { data: null, error: 'Kein Projekt ausgewählt (projectId fehlt).' }
  }

  const payload = capexProjectToRow(project, { createdBy: user?.id ?? null })

  if (project.id) {
    const { data, error } = await supabase
      .from('capex_calculations')
      .update(payload)
      .eq('id', project.id)
      .select()
      .single()

    if (error) {
      console.error('saveCapexCalculation (update) error:', error)
      return { data: null, error: error.message }
    }
    revalidatePath(`/capex/${project.projectId}`)
    return { data: rowToCapexProject(data as CapexCalculationRow), error: null }
  }

  const { data, error } = await supabase
    .from('capex_calculations')
    .insert(payload)
    .select()
    .single()

  if (error) {
    console.error('saveCapexCalculation (insert) error:', error)
    return { data: null, error: error.message }
  }
  revalidatePath(`/capex/${project.projectId}`)
  return { data: rowToCapexProject(data as CapexCalculationRow), error: null }
}

/** Löscht eine CAPEX-Kalkulation. */
export async function deleteCapexCalculation(
  id: string,
  projectId: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { error } = await supabase.from('capex_calculations').delete().eq('id', id)

  if (error) {
    console.error('deleteCapexCalculation error:', error)
    return { error: error.message }
  }
  revalidatePath(`/capex/${projectId}`)
  return { error: null }
}
