'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { ProjectGeneratedOutput } from '@/lib/projects/master-data'

export type ProjectOutputType = ProjectGeneratedOutput['type']

export async function markProjectOutputGenerated(
  projectId: string,
  type: ProjectOutputType,
): Promise<{ success?: true; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: project, error: readError } = await supabase
    .from('projects')
    .select('id, master_data_version, output_metadata')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (readError || !project) {
    return { error: readError?.message ?? 'Projekt wurde nicht gefunden.' }
  }

  const previous = project.output_metadata && typeof project.output_metadata === 'object'
    ? project.output_metadata as Record<string, ProjectGeneratedOutput>
    : {}

  const generatedAt = new Date().toISOString()
  const output: ProjectGeneratedOutput = {
    type,
    generatedAt,
    masterDataVersion: Number(project.master_data_version ?? 1),
  }

  const { error } = await supabase
    .from('projects')
    .update({ output_metadata: { ...previous, [type]: output } } as never)
    .eq('id', projectId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  await supabase.from('activity_log').insert({
    user_id: user.id,
    project_id: projectId,
    activity_type: 'document_generated' as never,
    title: 'Dokument erzeugt',
    description: `Ausgabe ${type} wurde aus Version ${output.masterDataVersion} der Projektdaten erstellt.`,
    metadata: { output_type: type, master_data_version: output.masterDataVersion },
  })

  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/overview`)
  revalidatePath(`/projects/${projectId}/documents`)
  return { success: true }
}
