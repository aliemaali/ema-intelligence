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

function parseMoney(value: FormDataEntryValue | null): number {
  if (typeof value !== 'string') return 0
  return parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0
}

export async function getDealForProject(projectId: string) {
  const { supabase, userId } = await requireUser()
  const { data: deal, error } = await supabase.from('deals').select('*').eq('project_id', projectId).eq('user_id', userId).eq('is_active', true).maybeSingle()
  if (error) throw new Error(error.message)
  let expenses: Array<{ id: string; category: string; description: string | null; amount_eur: number; is_confirmed: boolean }> = []
  if (deal) {
    const { data } = await supabase.from('expenses').select('id, category, description, amount_eur, is_confirmed').eq('deal_id', deal.id).order('category')
    expenses = data ?? []
  }
  return { deal, expenses }
}

export async function upsertDeal(projectId: string, formData: FormData) {
  const { supabase, userId } = await requireUser()
  const marginType = (formData.get('margin_type') as MarginType) || 'percent'
  const marginValue = parseMoney(formData.get('margin_value'))
  const purchasePriceType = formData.get('purchase_price_type') === 'per_kwp' ? 'per_kwp' : 'total'
  const purchaseInput = parseMoney(formData.get('purchase_input'))

  const { data: project } = await supabase.from('projects').select('pv_mwp, bess_mwh, project_type').eq('id', projectId).single()
  const pvKwp = Number(project?.pv_mwp ?? 0)
  if (purchasePriceType === 'per_kwp' && pvKwp <= 0) return { error: 'Für die Berechnung pro kWp muss eine PV-Leistung hinterlegt sein.' }

  const purchasePrice = purchasePriceType === 'per_kwp' ? purchaseInput * pvKwp : purchaseInput
  const includedMarginPerKwp = marginType === 'included_per_kwp' ? marginValue : null
  const expensesTotal = parseMoney(formData.get('exp_aussenprovision')) + parseMoney(formData.get('exp_sonstiges'))
  const calc = calculateDeal({ purchase_price: purchasePrice, margin_type: marginType, margin_value: marginValue, pv_mwp: project?.pv_mwp, bess_mwh: project?.bess_mwh, expenses_total: expensesTotal })

  const { data: existing } = await supabase.from('deals').select('id, deal_number').eq('project_id', projectId).eq('is_active', true).maybeSingle()
  const payload = {
    purchase_price: purchasePrice || null,
    purchase_price_type: purchasePriceType,
    purchase_per_kwp: pvKwp > 0 ? purchasePrice / pvKwp : null,
    purchase_per_mwh: project?.bess_mwh ? purchasePrice / project.bess_mwh : null,
    margin_type: marginType,
    margin_value: marginValue,
    included_margin_per_kwp: includedMarginPerKwp,
    margin_eur: calc.margin_eur,
    sales_price: calc.sales_price,
    gross_margin: calc.gross_margin,
    gross_margin_pct: calc.gross_margin_pct,
    net_profit: calc.net_profit,
    net_profit_pct: calc.net_profit_pct,
    notes: (formData.get('notes') as string) || null,
  }

  let dealId: string
  let dealNumber: string
  if (existing) {
    const { error } = await supabase.from('deals').update(payload as never).eq('id', existing.id)
    if (error) return { error: error.message }
    dealId = existing.id
    dealNumber = existing.deal_number
  } else {
    const year = new Date().getFullYear()
    const { count } = await supabase.from('deals').select('*', { count: 'exact', head: true }).eq('user_id', userId)
    dealNumber = `DEAL-${year}-${String((count ?? 0) + 1).padStart(3, '0')}`
    const { data, error } = await supabase.from('deals').insert({ project_id: projectId, user_id: userId, deal_number: dealNumber, is_active: true, deal_status: 'open', ...payload } as never).select('id').single()
    if (error || !data) return { error: error?.message ?? 'Deal konnte nicht erstellt werden.' }
    dealId = data.id
  }

  await supabase.from('expenses').delete().eq('deal_id', dealId)
  const expenseRows = [
    { category: 'aussenprovision', amount: parseMoney(formData.get('exp_aussenprovision')), desc: formData.get('exp_aussenprovision_desc') as string },
    { category: 'sonstiges', amount: parseMoney(formData.get('exp_sonstiges')), desc: formData.get('exp_sonstiges_desc') as string },
  ].filter((item) => item.amount > 0)
  if (expenseRows.length) {
    await supabase.from('expenses').insert(expenseRows.map((item) => ({ deal_id: dealId, project_id: projectId, user_id: userId, category: item.category, description: item.desc || null, amount_eur: item.amount, is_confirmed: false })))
  }

  await supabase.from('activity_log').insert({
    user_id: userId,
    project_id: projectId,
    activity_type: 'deal_update' as never,
    title: existing ? 'Deal aktualisiert' : 'Deal erstellt',
    description: `${dealNumber} – Nettogewinn: €${calc.net_profit?.toLocaleString('de-DE') ?? '–'}`,
    metadata: { deal_number: dealNumber, purchase_price_type: purchasePriceType, included_margin_per_kwp: includedMarginPerKwp, net_profit: calc.net_profit, gross_margin: calc.gross_margin },
  })

  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/projects')
  return { success: true, dealId }
}

export async function getAllDeals() {
  const { supabase, userId } = await requireUser()
  const { data, error } = await supabase.from('deals').select(`*, projects (project_number, project_name, project_type, location_city, location_state, status)`).eq('user_id', userId).eq('is_active', true).order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}
