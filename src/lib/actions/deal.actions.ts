'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { calculateDeal } from '@/lib/utils'
import type { MarginType } from '@/lib/types/database.types'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  return { supabase, userId: user.id }
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH DEAL FOR PROJECT
// ─────────────────────────────────────────────────────────────────────────────

export async function getDealForProject(projectId: string) {
  const { supabase, userId } = await requireUser()

  const { data: deal, error } = await supabase
    .from('deals')
    .select('*')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) throw new Error(error.message)

  // Fetch expenses for this deal
  let expenses: Array<{
    id: string
    category: string
    description: string | null
    amount_eur: number
    is_confirmed: boolean
  }> = []

  if (deal) {
    const { data: expData } = await supabase
      .from('expenses')
      .select('id, category, description, amount_eur, is_confirmed')
      .eq('deal_id', deal.id)
      .order('category')

    expenses = expData ?? []
  }

  return { deal, expenses }
}

// ─────────────────────────────────────────────────────────────────────────────
// UPSERT DEAL (create or update active deal)
// ─────────────────────────────────────────────────────────────────────────────

export async function upsertDeal(projectId: string, formData: FormData) {
  const { supabase, userId } = await requireUser()

  const marginType   = formData.get('margin_type') as MarginType
  const marginValue  = parseFloat(formData.get('margin_value') as string) || 0
  const purchasePrice = parseFloat(formData.get('purchase_price') as string) || 0

  // Fetch project for MWp / MWh values needed for calculation
  const { data: project } = await supabase
    .from('projects')
    .select('pv_mwp, bess_mwh, project_type')
    .eq('id', projectId)
    .single()

  // Sum all expenses from form
  const expensesTotal =
    (parseFloat(formData.get('exp_aussenprovision') as string) || 0) +
    (parseFloat(formData.get('exp_reise') as string) || 0) +
    (parseFloat(formData.get('exp_beratung') as string) || 0) +
    (parseFloat(formData.get('exp_sonstiges') as string) || 0)

  // Calculate financials
  const calc = calculateDeal({
    purchase_price:  purchasePrice,
    margin_type:     marginType,
    margin_value:    marginValue,
    pv_mwp:          project?.pv_mwp,
    bess_mwh:        project?.bess_mwh,
    expenses_total:  expensesTotal,
  })

  // Check for existing active deal
  const { data: existing } = await supabase
    .from('deals')
    .select('id, deal_number')
    .eq('project_id', projectId)
    .eq('is_active', true)
    .maybeSingle()

  let dealId: string
  let dealNumber: string

  if (existing) {
    // Update existing deal
    const { error } = await supabase
      .from('deals')
      .update({
        purchase_price:    purchasePrice || null,
        purchase_per_kwp:  project?.pv_mwp ? purchasePrice / (project.pv_mwp * 1000) : null,
        purchase_per_mwh:  project?.bess_mwh ? purchasePrice / project.bess_mwh : null,
        margin_type:       marginType,
        margin_value:      marginValue,
        margin_eur:        calc.margin_eur,
        sales_price:       calc.sales_price,
        gross_margin:      calc.gross_margin,
        gross_margin_pct:  calc.gross_margin_pct,
        net_profit:        calc.net_profit,
        net_profit_pct:    calc.net_profit_pct,
        notes:             (formData.get('notes') as string) || null,
      } as never)
      .eq('id', existing.id)

    if (error) return { error: error.message }
    dealId = existing.id
    dealNumber = existing.deal_number
  } else {
    // Generate deal number
    const year = new Date().getFullYear()
    const { count } = await supabase
      .from('deals')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    const num = String((count ?? 0) + 1).padStart(3, '0')
    const newDealNumber = `DEAL-${year}-${num}`

    const { data: newDeal, error } = await supabase
      .from('deals')
      .insert({
        project_id:       projectId,
        user_id:          userId,
        deal_number:      newDealNumber,
        is_active:        true,
        deal_status:      'open',
        purchase_price:   purchasePrice || null,
        purchase_per_kwp: project?.pv_mwp ? purchasePrice / (project.pv_mwp * 1000) : null,
        purchase_per_mwh: project?.bess_mwh ? purchasePrice / project.bess_mwh : null,
        margin_type:      marginType,
        margin_value:     marginValue,
        margin_eur:       calc.margin_eur,
        sales_price:      calc.sales_price,
        gross_margin:     calc.gross_margin,
        gross_margin_pct: calc.gross_margin_pct,
        net_profit:       calc.net_profit,
        net_profit_pct:   calc.net_profit_pct,
        notes:            (formData.get('notes') as string) || null,
      } as never)
      .select('id, deal_number')
      .single()

    if (error) return { error: error.message }
    dealId = newDeal.id
    dealNumber = newDeal.deal_number
  }

  // Upsert expenses (delete old, insert new)
  await supabase.from('expenses').delete().eq('deal_id', dealId)

  const expenseRows = [
    { category: 'aussenprovision', amount: parseFloat(formData.get('exp_aussenprovision') as string) || 0, desc: formData.get('exp_aussenprovision_desc') as string },
    { category: 'reise',           amount: parseFloat(formData.get('exp_reise') as string) || 0,           desc: formData.get('exp_reise_desc') as string },
    { category: 'beratung',        amount: parseFloat(formData.get('exp_beratung') as string) || 0,        desc: formData.get('exp_beratung_desc') as string },
    { category: 'sonstiges',       amount: parseFloat(formData.get('exp_sonstiges') as string) || 0,       desc: formData.get('exp_sonstiges_desc') as string },
  ].filter((e) => e.amount > 0)

  if (expenseRows.length > 0) {
    await supabase.from('expenses').insert(
      expenseRows.map((e) => ({
        deal_id:     dealId,
        project_id:  projectId,
        user_id:     userId,
        category:    e.category,
        description: e.desc || null,
        amount_eur:  e.amount,
        is_confirmed: false,
      }))
    )
  }

  // Activity log
  await supabase.from('activity_log').insert({
    user_id:       userId,
    project_id:    projectId,
    activity_type: 'deal_update' as never,
    title:         existing ? 'Deal aktualisiert' : 'Deal erstellt',
    description:   `${dealNumber} – Nettogewinn: €${calc.net_profit?.toLocaleString('de-DE') ?? '–'}`,
    metadata:      {
      deal_number:  dealNumber,
      net_profit:   calc.net_profit,
      gross_margin: calc.gross_margin,
    },
  })

  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/projects')
  return { success: true, dealId }
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH ALL DEALS (for /deals overview page)
// ─────────────────────────────────────────────────────────────────────────────

export async function getAllDeals() {
  const { supabase, userId } = await requireUser()

  const { data, error } = await supabase
    .from('deals')
    .select(`
      *,
      projects (
        project_number, project_name, project_type,
        location_city, location_state, status
      )
    `)
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}
