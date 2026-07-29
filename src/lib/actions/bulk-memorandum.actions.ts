'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getExposePresentation } from '@/lib/expose/projectPresentation'
import type { MemorandumPdfData } from '@/lib/pdf/memorandumPdf'

const COUNTRY_CODES: Record<string, string> = {
  Deutschland: 'de', Germany: 'de', Italien: 'it', Italy: 'it', Türkei: 'tr', Turkey: 'tr',
  Österreich: 'at', Austria: 'at', Schweiz: 'ch', Switzerland: 'ch', Frankreich: 'fr', France: 'fr',
  Spanien: 'es', Spain: 'es', Niederlande: 'nl', Netherlands: 'nl', Polen: 'pl', Poland: 'pl',
  Griechenland: 'gr', Greece: 'gr', Portugal: 'pt', Belgien: 'be', Belgium: 'be',
}

function formatNumber(value: unknown, digits = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed)
    ? new Intl.NumberFormat('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(parsed)
    : '—'
}

function formatMoney(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed)
    ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(parsed)
    : '—'
}

function tariffDisplay(raw: unknown) {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return 'Noch offen'
  return parsed <= 1 ? `${formatNumber(parsed, 3)} €/kWh` : `${formatNumber(parsed, 2)} ct/kWh`
}

function tariffEuroPerKwh(raw: unknown) {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed <= 1 ? parsed : parsed / 100
}

function firstValue(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const current = source[key]
    if (current !== null && current !== undefined && current !== '') return current
  }
  return null
}

function positiveNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function pvCapacityKwp(project: Record<string, unknown>) {
  const directKwp = firstValue(project, ['pv_kwp', 'capacity_kwp', 'plant_capacity_kwp'])
  const direct = positiveNumber(directKwp)
  if (direct !== null) return direct

  const mwp = positiveNumber(project.pv_mwp)
  return mwp !== null ? mwp * 1000 : null
}

function stageLabel(raw: unknown) {
  if (raw === 'rtb') return 'RTB'
  return 'In Planung'
}

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return { supabase, userId: user.id }
}

async function loadProjectData(projectId: string, userId: string, supabase: any) {
  const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).eq('user_id', userId).single()
  if (!project) return null

  const { data: deal } = await supabase.from('deals').select('*').eq('project_id', projectId).eq('user_id', userId).eq('is_active', true).maybeSingle()
  const emaAi = project.ai_score_details && typeof project.ai_score_details === 'object'
    ? (project.ai_score_details as Record<string, unknown>).ema_ai ?? {}
    : {}
  const optionalData: Record<string, unknown>[] = []

  for (const table of ['project_financials', 'project_economics', 'capex_calculations']) {
    const { data } = await supabase.from(table).select('*').eq('project_id', projectId).order('updated_at', { ascending: false }).limit(1).maybeSingle()
    if (data) optionalData.push(data)
  }

  return Object.assign({}, project, deal ?? {}, emaAi, ...optionalData) as Record<string, unknown>
}

function buildPdfData(project: Record<string, unknown>): MemorandumPdfData {
  const country = String(project.location_country || 'Deutschland')
  const code = COUNTRY_CODES[country]
  const location = [project.location_city, project.location_state].filter(Boolean).join(', ') || country
  const dateLabel = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(new Date())
  const purchasePrice = firstValue(project, ['purchase_price', 'deal_purchase_price', 'total_purchase_price'])
  const pvKwp = pvCapacityKwp(project)
  const specificYield = firstValue(project, ['specific_yield', 'specific_yield_kwh_kwp', 'yield_kwh_kwp'])
  const tariff = firstValue(project, ['feed_in_tariff', 'feed_in_tariff_ct_kwh', 'tariff_ct_kwh'])
  const storedAnnualYield = firstValue(project, ['annual_yield_kwh', 'annual_energy_kwh', 'annual_production_kwh'])
  const storedNetCashFlow = firstValue(project, ['annual_net_cash_flow', 'annual_net_income', 'annual_profit', 'net_cashflow_year', 'cashflow_annual'])
  const storedAnnualOpex = firstValue(project, ['annual_opex', 'opex_annual', 'operating_costs_annual'])
  const opexPerKwp = positiveNumber(firstValue(project, ['opex_per_kwp', 'opex_eur_kwp'])) ?? 7
  const pv = Number(pvKwp)
  const yieldPerKwp = Number(specificYield)
  const price = Number(purchasePrice)
  const tariffEur = tariffEuroPerKwh(tariff)
  const calculatedAnnualYield = Number.isFinite(pv) && pv > 0 && Number.isFinite(yieldPerKwp) && yieldPerKwp > 0 ? pv * yieldPerKwp : null
  const annualYield = positiveNumber(storedAnnualYield) ?? calculatedAnnualYield
  const annualRevenue = annualYield !== null && tariffEur !== null ? annualYield * tariffEur : 0
  const annualOpex = positiveNumber(storedAnnualOpex) ?? (Number.isFinite(pv) && pv > 0 ? pv * opexPerKwp : 0)
  const annualNetCashFlow = positiveNumber(storedNetCashFlow) ?? Math.max(0, annualRevenue - annualOpex)
  const amortisation = price > 0 && annualNetCashFlow > 0 ? price / annualNetCashFlow : null
  const roi = price > 0 && annualNetCashFlow > 0 ? (annualNetCashFlow / price) * 100 : null
  const presentation = getExposePresentation(
    { ...project, purchase_price: purchasePrice, pv_kwp: pvKwp, specific_yield: specificYield, feed_in_tariff: tariff, amortisation_years: amortisation },
    location,
    { number: formatNumber, money: formatMoney, tariff: tariffDisplay },
  )

  return {
    projectName: String(project.project_name || 'Projekt'),
    projectNumber: String(project.project_number || '—'),
    projectType: String(project.project_type || ''),
    typeLabel: presentation.typeLabel,
    location,
    country,
    countryFlag: code ? `https://flagcdn.com/w80/${code}.png` : '',
    dateLabel,
    status: stageLabel(project.project_stage),
    summary: presentation.summary,
    metrics: presentation.metrics,
    profile: presentation.profile,
    highlights: presentation.highlights,
    heroImage: presentation.heroImage,
    showPvEconomics: presentation.showPvEconomics,
    pvEconomics: presentation.showPvEconomics ? {
      annualYield: Number(annualYield) || 0,
      annualRevenue: Number(annualRevenue) || 0,
      purchasePrice: Number(price) || 0,
      tariffEurKwh: tariffEur ?? 0,
      roi: Number(roi) || 0,
      amortisation: Number(amortisation) || 0,
    } : null,
  }
}

export async function getBulkMemorandumData(projectIds: string[]) {
  const { supabase, userId } = await requireUser()
  const ids = Array.from(new Set(projectIds.filter(Boolean))).slice(0, 20)
  const items: Array<{ projectId: string; data: MemorandumPdfData }> = []

  for (const projectId of ids) {
    const project = await loadProjectData(projectId, userId, supabase as any)
    if (project) items.push({ projectId, data: buildPdfData(project) })
  }

  return { success: true as const, data: items }
}

export interface DeliveryLogInput {
  projectIds: string[]
  recipients: Array<{ id?: string; name: string; email?: string; type: 'investor' | 'partner' | 'manual' }>
  channel: 'email' | 'whatsapp'
  status: 'sent' | 'shared'
}

export async function recordMemorandumDeliveries(input: DeliveryLogInput) {
  const { supabase, userId } = await requireUser()
  const projectIds = Array.from(new Set(input.projectIds.filter(Boolean))).slice(0, 20)
  const recipients = input.recipients.length ? input.recipients : [{ name: 'WhatsApp-Kontakt', type: 'manual' as const }]
  const rows = projectIds.flatMap((projectId) => recipients.map((recipient) => ({
    user_id: userId,
    project_id: projectId,
    document_type: 'investment_memorandum',
    recipient_id: recipient.id ? recipient.id.split(':').pop() || null : null,
    recipient_name: recipient.name,
    recipient_email: recipient.email || null,
    recipient_type: recipient.type,
    channel: input.channel,
    status: input.status,
    sent_at: new Date().toISOString(),
    metadata: {},
  })))

  const { error } = await (supabase as any).from('document_deliveries').insert(rows)
  if (error) return { error: error.message }

  for (const projectId of projectIds) {
    await supabase.from('activity_log').insert({
      user_id: userId,
      project_id: projectId,
      activity_type: 'manual' as never,
      title: 'Investment Memorandum versendet',
      description: `${recipients.length} Empfänger · ${input.channel === 'email' ? 'E-Mail' : 'WhatsApp'}`,
      metadata: { channel: input.channel, recipient_count: recipients.length },
    })
  }

  revalidatePath('/projects')
  return { success: true as const }
}
