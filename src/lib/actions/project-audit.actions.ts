'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { calculatedAnnualYieldKwh, firstProjectValue, normalizedPricePerKwp, positiveNumber, projectPvCapacityKwp, projectSpecificYieldKwhPerKwp, resolvedPurchasePrice } from '@/lib/projects/pv-units'

export interface ProjectAuditRecord {
  id: string
  projectNumber: string
  projectName: string
  projectType: string
  projectImageUrl: string | null
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

function firstRowByProject(rows: unknown[] | null | undefined) {
  const map = new Map<string, Record<string, unknown>>()
  for (const raw of rows ?? []) {
    const row = raw as Record<string, unknown>
    const projectId = String(row.project_id ?? '')
    if (projectId && !map.has(projectId)) map.set(projectId, row)
  }
  return map
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

  const [dealsResult, financialsResult, economicsResult, capexResult] = await Promise.all([
    supabase.from('deals').select('*').eq('user_id', userId).eq('is_active', true).in('project_id', ids),
    supabase.from('project_financials').select('*').in('project_id', ids).order('updated_at', { ascending: false }),
    supabase.from('project_economics').select('*').in('project_id', ids).order('updated_at', { ascending: false }),
    supabase.from('capex_calculations').select('*').in('project_id', ids).order('updated_at', { ascending: false }),
  ])

  const dealByProject = firstRowByProject(dealsResult.data)
  const financialsByProject = firstRowByProject(financialsResult.data)
  const economicsByProject = firstRowByProject(economicsResult.data)
  const capexByProject = firstRowByProject(capexResult.data)

  const records: ProjectAuditRecord[] = []
  for (const raw of projects ?? []) {
    const project = raw as unknown as Record<string, unknown>
    const projectId = String(project.id)
    const optionalData = [
      dealByProject.get(projectId),
      financialsByProject.get(projectId),
      economicsByProject.get(projectId),
      capexByProject.get(projectId),
    ].filter(Boolean) as Record<string, unknown>[]

    const merged = Object.assign({}, project, ...optionalData) as Record<string, unknown>
    const pvKwp = projectPvCapacityKwp(merged)
    const purchasePrice = resolvedPurchasePrice(merged)
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
    const amortisationYears = purchasePrice && annualNetCashFlow ? purchasePrice / annualNetCashFlow : null

    const devStatus = merged.dev_status && typeof merged.dev_status === 'object' ? merged.dev_status as Record<string, unknown> : {}
    const gridRaw = firstProjectValue(merged, ['grid_connection', 'netzanschluss', 'grid_connection_secured']) ?? devStatus.netzanschluss
    const gridConnection = typeof gridRaw === 'boolean' ? gridRaw : gridRaw === 'true' ? true : gridRaw === 'false' ? false : null

    records.push({
      id: projectId,
      projectNumber: String(merged.project_number || '—'),
      projectName: String(merged.project_name || 'Projekt'),
      projectType: String(merged.project_type || ''),
      projectImageUrl: typeof merged.project_image_url === 'string' && merged.project_image_url ? merged.project_image_url : null,
      location: [merged.location_city, merged.location_state, merged.location_country].filter(Boolean).join(', ') || '—',
      stage: merged.project_stage === 'rtb' ? 'RTB' : 'In Planung',
      pvKwp,
      bessMw: positiveNumber(firstProjectValue(merged, ['bess_mw', 'storage_power_mw'])),
      bessMwh: positiveNumber(firstProjectValue(merged, ['bess_mwh', 'storage_capacity_mwh'])),
      purchasePrice,
      storedPricePerKwp: normalizedPricePerKwp(firstProjectValue(merged, ['price_per_kwp', 'purchase_price_per_kwp', 'ek_price_per_kwp', 'purchase_per_kwp'])),
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
