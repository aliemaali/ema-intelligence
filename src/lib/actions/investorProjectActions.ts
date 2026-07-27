'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type InvestorProjectAssignment = {
  linkId: string
  projectId: string
  projectName: string
  assigned: boolean
  exposes: Array<{ id: string; displayName: string; filePath: string }>
}

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht authentifiziert. Bitte erneut anmelden.')
  return { supabase, userId: user.id }
}

export async function getInvestorProjectAssignments(investorId: string, allProjectIds: string[] = []) {
  try {
    const { supabase, userId } = await requireUser()
    const projectIds = Array.from(new Set(allProjectIds.filter(Boolean)))

    const { data: links, error: linkError } = await supabase
      .from('investor_project_links')
      .select('id, project_id')
      .eq('investor_id', investorId)

    if (linkError) return { success: false as const, error: linkError.message }

    const linkedProjectIds = (links ?? []).map((item: any) => item.project_id)
    const idsToLoad = Array.from(new Set([...projectIds, ...linkedProjectIds]))
    if (idsToLoad.length === 0) return { success: true as const, data: [] as InvestorProjectAssignment[] }

    const [{ data: projects, error: projectsError }, { data: documents, error: documentsError }] = await Promise.all([
      supabase
        .from('projects')
        .select('id, project_name')
        .eq('user_id', userId)
        .in('id', idsToLoad),
      supabase
        .from('documents')
        .select('id, project_id, display_name, file_path, document_type, is_archived')
        .eq('user_id', userId)
        .eq('document_type', 'expose')
        .eq('is_archived', false)
        .in('project_id', idsToLoad),
    ])

    if (projectsError) return { success: false as const, error: projectsError.message }
    if (documentsError) return { success: false as const, error: documentsError.message }

    const linkMap = new Map((links ?? []).map((link: any) => [link.project_id, link.id]))
    const result: InvestorProjectAssignment[] = (projects ?? []).map((project: any) => ({
      linkId: linkMap.get(project.id) ?? '',
      projectId: project.id,
      projectName: project.project_name ?? 'Projekt',
      assigned: linkMap.has(project.id),
      exposes: (documents ?? [])
        .filter((doc: any) => doc.project_id === project.id)
        .map((doc: any) => ({
          id: doc.id,
          displayName: doc.display_name || 'Exposé',
          filePath: doc.file_path,
        })),
    }))

    return { success: true as const, data: result }
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Zuordnungen konnten nicht geladen werden.' }
  }
}

export async function getProjectExposeUrl(filePath: string) {
  try {
    const { supabase, userId } = await requireUser()
    const { data: document, error: documentError } = await supabase
      .from('documents')
      .select('file_path')
      .eq('user_id', userId)
      .eq('file_path', filePath)
      .eq('document_type', 'expose')
      .eq('is_archived', false)
      .single()

    if (documentError || !document) return { error: 'Exposé wurde nicht gefunden.' }

    const { data, error } = await supabase.storage
      .from('project-documents')
      .createSignedUrl(filePath, 3600)

    if (error) return { error: error.message }
    return { url: data.signedUrl }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Exposé konnte nicht geöffnet werden.' }
  }
}

export async function saveInvestorProjectAssignments(investorId: string, projectIds: string[]) {
  try {
    const { supabase, userId } = await requireUser()
    const uniqueProjectIds = Array.from(new Set(projectIds.filter(Boolean)))

    const { error: deleteError } = await supabase
      .from('investor_project_links')
      .delete()
      .eq('investor_id', investorId)
    if (deleteError) return { success: false as const, error: deleteError.message }

    if (uniqueProjectIds.length > 0) {
      const { error: insertError } = await supabase
        .from('investor_project_links')
        .insert(uniqueProjectIds.map((projectId) => ({ investor_id: investorId, project_id: projectId, created_by: userId })))
      if (insertError) return { success: false as const, error: insertError.message }
    }

    revalidatePath('/investors')
    revalidatePath('/projects')
    return { success: true as const }
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Zuordnungen konnten nicht gespeichert werden.' }
  }
}
