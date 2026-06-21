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

/**
 * Lädt alle Projekte aus der bestehenden `projects`-Tabelle für den
 * Projekt-Picker. Nimmt minimal `id` + `name` an (siehe Annahme bei Migration).
 */
export async function getProjectOptions(): Promise<ProjectOption[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('projects')
    .select('id, project_name')
    .order('project_name', { ascending: true })

  if (error) {
    console.error('getProjectOptions error:', error)
    return []
  }
  return (data ?? []).map((project) => ({
  id: project.id,
  name: project.project_name,
}))
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
