'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type InvestorProjectAssignment = {
  linkId: string
  projectId: string
  projectName: string
  exposes: Array<{ id: string; displayName: string; filePath: string }>
}

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht authentifiziert. Bitte erneut anmelden.')
  return { supabase, userId: user.id }
}

export async function getInvestorProjectAssignments(investorId: string) {
  try {
    const { supabase, userId } = await requireUser()
    const { data: links, error: linkError } = await supabase
      .from('investor_project_links')
      .select('id, project_id, projects(id, project_name)')
      .eq('investor_id', investorId)

    if (linkError) return { success: false as const, error: linkError.message }
    const projectIds = (links ?? []).map((item: any) => item.project_id)
    if (projectIds.length === 0) return { success: true as const, data: [] as InvestorProjectAssignment[] }

    const { data: assignments, error: assignmentError } = await (supabase as any)
      .from('document_assignments')
      .select('entity_id, document_id, template_documents(id, display_name, file_path, category, user_id, is_archived)')
      .eq('entity_type', 'project')
      .eq('user_id', userId)
      .in('entity_id', projectIds)

    if (assignmentError) return { success: false as const, error: assignmentError.message }

    const result: InvestorProjectAssignment[] = (links ?? []).map((link: any) => ({
      linkId: link.id,
      projectId: link.project_id,
      projectName: link.projects?.project_name ?? 'Projekt',
      exposes: (assignments ?? [])
        .filter((row: any) => row.entity_id === link.project_id && row.template_documents && !row.template_documents.is_archived)
        .filter((row: any) => {
          const category = String(row.template_documents.category ?? '').toLowerCase()
          const name = String(row.template_documents.display_name ?? '').toLowerCase()
          return category.includes('expos') || name.includes('exposé') || name.includes('expose')
        })
        .map((row: any) => ({ id: row.template_documents.id, displayName: row.template_documents.display_name, filePath: row.template_documents.file_path })),
    }))

    return { success: true as const, data: result }
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Zuordnungen konnten nicht geladen werden.' }
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
