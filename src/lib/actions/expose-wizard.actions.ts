'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { buildExposeSource, exposeDraftSchema, exposeKind, type ExposeDraft, type ExposeWizardSource } from '@/lib/expose/wizard'
import { mergeProjectEconomicSources } from '@/lib/projects/pv-units'

const outputType = 'expose_wizard_v1'
export async function loadExposeWizard(projectId: string): Promise<{ source?: ExposeWizardSource; error?: string }> {
  if (!z.string().uuid().safeParse(projectId).success) return { error: 'Ungültiges Projekt.' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Bitte erneut anmelden.' }
  const { data: project, error } = await supabase.from('projects').select('*').eq('id', projectId).eq('user_id', user.id).eq('is_archived', false).single()
  if (error || !project || !exposeKind(project.project_type)) return { error: 'Projekt konnte nicht geladen werden.' }
  const [deal, saved] = await Promise.all([
    supabase.from('deals').select('*').eq('project_id', projectId).eq('user_id', user.id).eq('is_active', true).maybeSingle(),
    supabase.from('ai_outputs').select('metadata').eq('project_id', projectId).eq('user_id', user.id).eq('output_type', outputType).eq('status', 'draft').order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  if (deal.error || saved.error) return { error: 'Projektdaten oder Entwurf konnten nicht vollständig geladen werden. Bitte erneut versuchen.' }
  const draft = exposeDraftSchema.safeParse(saved.data?.metadata?.draft)
  const source = buildExposeSource(mergeProjectEconomicSources(project, deal.data))
  if (draft.success && Number(saved.data?.metadata?.master_data_version) !== Number(project.master_data_version)) {
    source.warnings.push('Die Projektakte wurde seit dem gespeicherten Entwurf geändert. Bitte Texte und Kennzahlen erneut vergleichen.')
  }
  return { source: { ...source, draft: draft.success ? draft.data : null } }
}

export async function saveExposeWizard(projectId: string, input: ExposeDraft): Promise<{ success?: true; error?: string }> {
  const draft = exposeDraftSchema.safeParse(input)
  if (!z.string().uuid().safeParse(projectId).success || !draft.success) return { error: 'Bitte die Exposé-Inhalte prüfen.' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Bitte erneut anmelden.' }
  const { data: project } = await supabase.from('projects').select('id,project_type,master_data_version').eq('id', projectId).eq('user_id', user.id).eq('is_archived', false).single()
  if (!project || !exposeKind(project.project_type)) return { error: 'Projekt wurde nicht gefunden.' }
  // Append a draft revision; never overwrite an approved document or the project master data.
  const { error } = await supabase.from('ai_outputs').insert({ user_id: user.id, project_id: projectId, output_type: outputType, status: 'draft', content: draft.data.summary,
    metadata: { draft: draft.data, master_data_version: project.master_data_version, schema_version: 1 } })
  return error ? { error: 'Entwurf konnte nicht gespeichert werden.' } : { success: true }
}
