'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type InvestorProjectAssignment = {
  linkId: string
  projectId: string
  projectName: string
  assigned: boolean
  status: string
  exposeSentAt: string | null
  memorandumUrl: string
}

type AssignmentRow = {
  id: string
  project_id: string
  status: string
  expose_sent_at: string | null
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

    const { data: assignments, error: assignmentError } = await (supabase as any)
      .from('investor_project_assignments')
      .select('id, project_id, status, expose_sent_at')
      .eq('user_id', userId)
      .eq('investor_id', investorId)

    if (assignmentError) return { success: false as const, error: assignmentError.message }

    const assignmentRows = (assignments ?? []) as AssignmentRow[]
    const assignedProjectIds = assignmentRows.map((item) => item.project_id)
    const idsToLoad = Array.from(new Set([...projectIds, ...assignedProjectIds]))
    if (idsToLoad.length === 0) return { success: true as const, data: [] as InvestorProjectAssignment[] }

    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, project_name')
      .eq('user_id', userId)
      .in('id', idsToLoad)

    if (projectsError) return { success: false as const, error: projectsError.message }

    const assignmentMap = new Map<string, AssignmentRow>(
      assignmentRows.map((assignment) => [assignment.project_id, assignment])
    )
    const result: InvestorProjectAssignment[] = (projects ?? []).map((project: any) => {
      const assignment = assignmentMap.get(project.id)
      return {
        linkId: assignment?.id ?? '',
        projectId: project.id,
        projectName: project.project_name ?? 'Projekt',
        assigned: Boolean(assignment),
        status: assignment?.status ?? 'vorgemerkt',
        exposeSentAt: assignment?.expose_sent_at ?? null,
        memorandumUrl: `/expose/${project.id}`,
      }
    })

    return { success: true as const, data: result }
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Zuordnungen konnten nicht geladen werden.' }
  }
}

export async function saveInvestorProjectAssignments(investorId: string, projectIds: string[]) {
  try {
    const { supabase, userId } = await requireUser()
    const uniqueProjectIds = Array.from(new Set(projectIds.filter(Boolean)))

    const { data: existing, error: readError } = await (supabase as any)
      .from('investor_project_assignments')
      .select('id, project_id')
      .eq('user_id', userId)
      .eq('investor_id', investorId)

    if (readError) return { success: false as const, error: readError.message }

    const existingRows = (existing ?? []) as Array<Pick<AssignmentRow, 'id' | 'project_id'>>
    const desired = new Set(uniqueProjectIds)
    const existingByProject = new Map(existingRows.map((item) => [item.project_id, item.id]))
    const idsToDelete = existingRows.filter((item) => !desired.has(item.project_id)).map((item) => item.id)
    const projectIdsToInsert = uniqueProjectIds.filter((projectId) => !existingByProject.has(projectId))

    if (idsToDelete.length > 0) {
      const { error: deleteError } = await (supabase as any)
        .from('investor_project_assignments')
        .delete()
        .eq('user_id', userId)
        .in('id', idsToDelete)
      if (deleteError) return { success: false as const, error: deleteError.message }
    }

    if (projectIdsToInsert.length > 0) {
      const { error: insertError } = await (supabase as any)
        .from('investor_project_assignments')
        .insert(projectIdsToInsert.map((projectId) => ({
          user_id: userId,
          investor_id: investorId,
          project_id: projectId,
          status: 'vorgemerkt',
        })))
      if (insertError) return { success: false as const, error: insertError.message }
    }

    revalidatePath('/investors')
    revalidatePath(`/investors/${investorId}`)
    revalidatePath('/projects')
    return { success: true as const }
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Zuordnungen konnten nicht gespeichert werden.' }
  }
}
