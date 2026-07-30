'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { calculatedAnnualYieldKwh, firstProjectValue, positiveNumber, projectPvCapacityKwp, projectSpecificYieldKwhPerKwp } from '@/lib/projects/pv-units'

export interface ProjectAuditRecord {
  id: string
  projectNumber: string
  projectName: string
  projectType: string
  location: string
  stage: string
  pvKwp: number | null
  bessMw: number | null
  bessMwh: number | null
  purchasePrice: number | null
  storedPricePerKwp: number | null
  feedInTariff: number | null
  specificYield: number | null
  annualYield: number | null
  annualRevenue: number | null
  annualOpex: number | null
  opexPerKwp: number | null
  annualNetCashFlow: number | null
  amortisationYears: number | null
  leaseTermYears: number | null
  landAreaSqm: number | null
  investmentVolume: number | null
  gridConnection: boolean | null
}

function numberOrNull(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function positiveOrNull(value: unknown) {
  const parsed = numberOrNull(value)
  return parsed !== null && parsed > 0 ? parsed : null
}

function tariffEuroPerKwh(value: unknown) {
  const parsed = positiveOrNull(value)
  if (parsed === null) return null
  return parsed <= 1 ? parsed : parsed / 100
}

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return { supabase, userId: user.id }
}

export async function getProjectAuditData(projectIds: string[]) {
  const { supabase, userId } = await requireUser()
  const ids = Array.from(new Set(projectIds.filter(Boolean))).slice(0, 250)
  if (!ids.length) return { success: true as const, data: [] as ProjectAuditRecord[] }

  const { data: projects, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .in('id', ids)

  if (error) return { success: false as const, error: error.message, data: [] as ProjectAuditRecord[] }

  const records: ProjectAuditRecord[] = []
  for (const raw of projects ?? []) {
    const project = raw as unknown as Record<string, unknown>
    const projectId = String(project.id)
    const optionalData: Record<string, unknown>[] = []

    const { data: deal } = await supabase.from('deals').select('*').eq('project_id', projectId).eq('user_id', userId).eq('is_active', true).maybeSingle()
    if (deal) optionalData.push(deal as unknown as Record<string, unknown>)

    for (const table of ['project_financials', 'project_economics', 'capex_calculations']) {
      const { data } = await supabase.from(table).select('*').eq('project_id', projectId).order('updated_at', { ascending: false }).limit(1).maybeSingle()
      if (data) optionalData.push(data as unknown as Record<string, unknown>)
    }

    const merged = Object.assign({}, project, ...optionalData) as Record<string, unknown>
    const pvKwp = projectPvCapacityKwp(merged)
    const purchasePrice = positiveNumber(firstProjectValue(merged, ['purchase_price', 'deal_purchase_price', 'total_purchase_price']))
    const specificYield = projectSpecificYieldKwhPerKwp(merged)
    const feedInTariff = positiveNumber(firstProjectValue(merged, ['feed_in_tariff', 'feed_in_tariff_ct_kwh', 'tariff_ct_kwh']))
    const storedAnnualYield = positiveNumber(firstProjectValue(merged, ['annual_yield_kwh', 'annual_energy_kwh', 'annual_production_kwh']))
    const calculatedYield = calculatedAnnualYieldKwh(merged)
    const annualYield = storedAnnualYield ?? calculatedYield
    const tariffEur = tariffEuroPerKwh(feedInTariff)
    const storedRevenue = positiveNumber(firstProjectValue(merged, ['annual_revenue', 'revenue_annual', 'annual_sales']))
    const annualRevenue = storedRevenue ?? (annualYield && tariffEur ? annualYield * tariffEur : null)
    const opexPerKwp = positiveNumber(firstProjectValue(merged, ['opex_per_kwp', 'opex_eur_kwp'])) ?? (pvKwp ? 7 : null)
    const storedOpex = positiveNumber(firstProjectValue(merged, ['annual_opex', 'opex_annual', 'operating_costs_annual']))
    const annualOpex = storedOpex ?? (pvKwp && opexPerKwp ? pvKwp * opexPerKwp : null)
    const storedNet = positiveNumber(firstProjectValue(merged, ['annual_net_cash_flow', 'annual_net_income', 'annual_profit', 'net_cashflow_year', 'cashflow_annual']))
    const annualNetCashFlow = storedNet ?? (annualRevenue !== null && annualOpex !== null ? Math.max(0, annualRevenue - annualOpex) : null)
    const storedAmortisation = positiveNumber(firstProjectValue(merged, ['amortisation_years', 'payback_years']))
    const amortisationYears = storedAmortisation ?? (purchasePrice && annualNetCashFlow ? purchasePrice / annualNetCashFlow : null)

    const devStatus = merged.dev_status && typeof merged.dev_status === 'object' ? merged.dev_status as Record<string, unknown> : {}
    const gridRaw = firstProjectValue(merged, ['grid_connection', 'netzanschluss', 'grid_connection_secured']) ?? devStatus.netzanschluss
    const gridConnection = typeof gridRaw === 'boolean' ? gridRaw : gridRaw === 'true' ? true : gridRaw === 'false' ? false : null

    records.push({
      id: projectId,
      projectNumber: String(merged.project_number || '—'),
      projectName: String(merged.project_name || 'Projekt'),
      projectType: String(merged.project_type || ''),
      location: [merged.location_city, merged.location_state, merged.location_country].filter(Boolean).join(', ') || '—',
      stage: merged.project_stage === 'rtb' ? 'RTB' : 'In Planung',
      pvKwp,
      bessMw: positiveNumber(firstProjectValue(merged, ['bess_mw', 'storage_power_mw'])),
      bessMwh: positiveNumber(firstProjectValue(merged, ['bess_mwh', 'storage_capacity_mwh'])),
      purchasePrice,
      storedPricePerKwp: positiveNumber(firstProjectValue(merged, ['price_per_kwp', 'purchase_price_per_kwp', 'ek_price_per_kwp', 'purchase_per_kwp'])),
      feedInTariff,
      specificYield,
      annualYield,
      annualRevenue,
      annualOpex,
      opexPerKwp,
      annualNetCashFlow,
      amortisationYears,
      leaseTermYears: positiveNumber(merged.lease_term_years),
      landAreaSqm: positiveNumber(firstProjectValue(merged, ['land_area_sqm', 'area_sqm', 'property_area_sqm'])),
      investmentVolume: positiveNumber(merged.investment_volume_eur),
      gridConnection,
    })
  }

  const order = new Map(ids.map((id, index) => [id, index]))
  records.sort((a, b) => (order.get(a.id) ?? 9999) - (order.get(b.id) ?? 9999))
  return { success: true as const, data: records }
}
