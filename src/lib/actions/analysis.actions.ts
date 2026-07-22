'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { generateProjectAnalysis } from '@/lib/analysis/generateAnalysisWithChecklist'
import type { AnalysisSourceData, GeneratedAnalysis } from '@/lib/types/analysis.types'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  return { supabase, userId: user.id }
}

export async function getAnalysisSourceData(projectId: string): Promise<AnalysisSourceData> {
  const { supabase, userId } = await requireUser()

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single()

  if (projectError || !project) throw new Error('Projekt nicht gefunden')

  const [{ data: deal }, { data: documents }, { data: checklist }, { data: investorLinks }] = await Promise.all([
    supabase
      .from('deals')
      .select('deal_status, purchase_price, sales_price, net_profit')
      .eq('project_id', projectId)
      .eq('is_active', true)
      .maybeSingle(),
    supabase
      .from('documents')
      .select('document_type, display_name, file_name')
      .eq('project_id', projectId)
      .eq('is_archived', false),
    supabase
      .from('project_document_checklists')
      .select('document_type, status')
      .eq('project_id', projectId)
      .eq('user_id', userId),
    supabase
      .from('project_investors')
      .select(`
        status,
        investors (
          id, full_name, company,
          interest_pv, interest_bess, interest_hybrid,
          size_preferences
        )
      `)
      .eq('project_id', projectId)
      .eq('user_id', userId),
  ])

  const linkedInvestors = (investorLinks ?? [])
    .map((link) => {
      const inv = link.investors as unknown as {
        id: string; full_name: string; company: string | null
        interest_pv: boolean; interest_bess: boolean; interest_hybrid: boolean
        size_preferences: string[]
      } | null
      if (!inv) return null
      return {
        investor_id: inv.id,
        full_name: inv.full_name,
        company: inv.company,
        status: link.status,
        interest_pv: inv.interest_pv,
        interest_bess: inv.interest_bess,
        interest_hybrid: inv.interest_hybrid,
        size_preferences: inv.size_preferences ?? [],
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  return {
    project: {
      id: project.id,
      project_number: project.project_number,
      project_name: project.project_name,
      project_type: project.project_type,
      status: project.status,
      location_city: project.location_city,
      location_state: project.location_state,
      pv_mwp: project.pv_mwp,
      bess_mw: project.bess_mw,
      bess_mwh: project.bess_mwh,
      dev_status: project.dev_status,
      created_at: project.created_at,
      last_activity_at: project.last_activity_at,
    },
    deal: deal ?? null,
    documents: (documents ?? []) as AnalysisSourceData['documents'],
    documentChecklist: (checklist ?? []) as AnalysisSourceData['documentChecklist'],
    linkedInvestors,
  }
}

export async function generateAndSaveAnalysis(projectId: string) {
  const { supabase, userId } = await requireUser()
  const sourceData = await getAnalysisSourceData(projectId)
  const analysis = generateProjectAnalysis(sourceData)

  const { data: output, error: outputError } = await supabase
    .from('ai_outputs')
    .insert({
      project_id: projectId,
      user_id: userId,
      output_type: 'dd_analysis',
      content: JSON.stringify(analysis),
      content_html: null,
      metadata: {
        generator: 'rule_based_v1',
        overall_score: analysis.overallScore,
        recommendation: analysis.marketingRecommendation,
        analyzed_at: analysis.analyzedAt,
      },
      status: 'draft',
      version: 1,
    } as never)
    .select('id')
    .single()

  if (outputError) return { error: outputError.message }

  await supabase
    .from('projects')
    .update({
      ai_score: analysis.overallScore,
      ai_score_details: {
        dev_status_percent: analysis.devStatusScore.percent,
        missing_documents: analysis.missingDocuments.length,
        risk_count: analysis.risks.length,
        recommendation: analysis.marketingRecommendation,
      },
      ai_last_analyzed: analysis.analyzedAt,
    } as never)
    .eq('id', projectId)
    .eq('user_id', userId)

  await supabase.from('activity_log').insert({
    user_id: userId,
    project_id: projectId,
    activity_type: 'manual',
    title: 'KI-Projektanalyse erstellt',
    description: `Gesamtscore: ${analysis.overallScore}/100 · Empfehlung: ${analysis.marketingRecommendation}`,
    metadata: { ai_output_id: output.id, overall_score: analysis.overallScore },
  } as never)

  revalidatePath(`/projects/${projectId}/analysis`)
  revalidatePath(`/projects/${projectId}/overview`)
  revalidatePath('/projects')
  return { success: true, aiOutputId: output.id }
}

export async function getLatestAnalysis(projectId: string): Promise<{
  id: string
  analysis: GeneratedAnalysis
  status: string
  createdAt: string
} | null> {
  const { supabase, userId } = await requireUser()

  const { data, error } = await supabase
    .from('ai_outputs')
    .select('id, content, status, created_at')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .eq('output_type', 'dd_analysis')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data || !data.content) return null

  try {
    return {
      id: data.id,
      analysis: JSON.parse(data.content) as GeneratedAnalysis,
      status: data.status,
      createdAt: data.created_at,
    }
  } catch {
    return null
  }
}

export async function approveAnalysis(aiOutputId: string, projectId: string) {
  const { supabase, userId } = await requireUser()

  const { error } = await supabase
    .from('ai_outputs')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: userId,
    } as never)
    .eq('id', aiOutputId)
    .eq('user_id', userId)

  if (error) return { error: error.message }

  await supabase.from('activity_log').insert({
    user_id: userId,
    project_id: projectId,
    activity_type: 'manual',
    title: 'KI-Projektanalyse freigegeben',
    description: 'Manuelle Prüfung abgeschlossen, Analyse freigegeben.',
    metadata: { ai_output_id: aiOutputId },
  } as never)

  revalidatePath(`/projects/${projectId}/analysis`)
  return { success: true }
}
