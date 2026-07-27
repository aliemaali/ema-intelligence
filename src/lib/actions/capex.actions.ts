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

/** Lädt alle sichtbaren Projekte inklusive zentraler Projektdaten für den CAPEX-Rechner. */
export async function getProjectOptions(): Promise<ProjectOption[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('projects')
    .select(
      'id, project_name, tags, is_archived, pv_mwp, pv_ac_mw, bess_mw, bess_mwh, bess_duration_h, location_city, location_state, location_country, specific_yield_kwh_kwp, feed_in_tariff_ct_kwh, lease_term_years, master_data_version'
    )
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
      pv_mwp: project.pv_mwp,
      pv_ac_mw: project.pv_ac_mw,
      bess_mw: project.bess_mw,
      bess_mwh: project.bess_mwh,
      bess_duration_h: project.bess_duration_h,
      location_city: project.location_city,
      location_state: project.location_state,
      location_country: project.location_country,
      specific_yield: project.specific_yield_kwh_kwp,
      tariff_eur_kwh:
        project.feed_in_tariff_ct_kwh == null
          ? null
          : Number(project.feed_in_tariff_ct_kwh) / 100,
      lease_term_years: project.lease_term_years,
      master_data_version: project.master_data_version,
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

async function syncCapexValuesToProject(
  supabase: Awaited<ReturnType<typeof createClient>>,
  project: CapexProject
): Promise<string | null> {
  if (!project.projectId) return 'Kein Projekt ausgewählt.'

  const { data: masterProject, error: readError } = await supabase
    .from('projects')
    .select('source_metadata')
    .eq('id', project.projectId)
    .single()

  if (readError) return readError.message

  const now = new Date().toISOString()
  const currentSources =
    masterProject?.source_metadata && typeof masterProject.source_metadata === 'object'
      ? masterProject.source_metadata
      : {}

  const capexSource = { source: 'capex', sourceName: project.calculationName, importedAt: now }
  const sourceMetadata = {
    ...currentSources,
    pvKwp: capexSource,
    specificYieldKwhKwp: capexSource,
    feedInTariffCtKwh: capexSource,
    leaseTermYears: capexSource,
  }

  const { error } = await supabase
    .from('projects')
    .update({
      pv_mwp: project.anlagenleistungKwp,
      specific_yield_kwh_kwp: project.spezErtragKwhKwp,
      feed_in_tariff_ct_kwh: project.strompreisEurKwh * 100,
      lease_term_years: project.pachtdauerJahre,
      source_metadata: sourceMetadata,
    } as never)
    .eq('id', project.projectId)

  return error?.message ?? null
}

/** Speichert eine CAPEX-Kalkulation und synchronisiert gemeinsame Werte mit dem Projekt. */
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
  let savedRow: CapexCalculationRow

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
    savedRow = data as CapexCalculationRow
  } else {
    const { data, error } = await supabase
      .from('capex_calculations')
      .insert(payload)
      .select()
      .single()

    if (error) {
      console.error('saveCapexCalculation (insert) error:', error)
      return { data: null, error: error.message }
    }
    savedRow = data as CapexCalculationRow
  }

  const syncError = await syncCapexValuesToProject(supabase, project)
  if (syncError) {
    console.error('syncCapexValuesToProject error:', syncError)
    return {
      data: rowToCapexProject(savedRow),
      error: `Kalkulation gespeichert, Projektdaten konnten aber nicht synchronisiert werden: ${syncError}`,
    }
  }

  revalidatePath(`/capex/${project.projectId}`)
  revalidatePath(`/projects/${project.projectId}`)
  revalidatePath('/projects')
  return { data: rowToCapexProject(savedRow), error: null }
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
