'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getExposePresentation } from '@/lib/expose/projectPresentation'
import type { MemorandumLanguage, MemorandumPdfData } from '@/lib/pdf/memorandumPdf'
import { mergeProjectEconomicSources, resolvePvEconomics } from '@/lib/projects/pv-units'

const COUNTRY_CODES: Record<string, string> = {
  Deutschland: 'de', Germany: 'de', Italien: 'it', Italy: 'it', Türkei: 'tr', Turkey: 'tr',
  Österreich: 'at', Austria: 'at', Schweiz: 'ch', Switzerland: 'ch', Frankreich: 'fr', France: 'fr',
  Spanien: 'es', Spain: 'es', Niederlande: 'nl', Netherlands: 'nl', Polen: 'pl', Poland: 'pl',
  Griechenland: 'gr', Greece: 'gr', Portugal: 'pt', Belgien: 'be', Belgium: 'be',
}

const COUNTRY_NAMES_EN: Record<string, string> = {
  Deutschland: 'Germany', Germany: 'Germany', Italien: 'Italy', Italy: 'Italy', Türkei: 'Turkey', Turkey: 'Turkey',
  Österreich: 'Austria', Austria: 'Austria', Schweiz: 'Switzerland', Switzerland: 'Switzerland', Frankreich: 'France', France: 'France',
  Spanien: 'Spain', Spain: 'Spain', Niederlande: 'Netherlands', Netherlands: 'Netherlands', Polen: 'Poland', Poland: 'Poland',
  Griechenland: 'Greece', Greece: 'Greece', Portugal: 'Portugal', Belgien: 'Belgium', Belgium: 'Belgium',
}

function locale(language: MemorandumLanguage) {
  return language === 'en' ? 'en-GB' : 'de-DE'
}

function formatNumber(value: unknown, digits = 0, language: MemorandumLanguage = 'de') {
  const parsed = Number(value)
  return Number.isFinite(parsed)
    ? new Intl.NumberFormat(locale(language), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(parsed)
    : '—'
}

function formatMoney(value: unknown, language: MemorandumLanguage = 'de') {
  const parsed = Number(value)
  return Number.isFinite(parsed)
    ? new Intl.NumberFormat(locale(language), { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(parsed)
    : '—'
}

function tariffDisplay(raw: unknown, language: MemorandumLanguage = 'de') {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return language === 'en' ? 'Pending' : 'Noch offen'
  return parsed <= 1 ? `${formatNumber(parsed, 3, language)} €/kWh` : `${formatNumber(parsed, 2, language)} ct/kWh`
}

function stageLabel(raw: unknown, language: MemorandumLanguage) {
  if (raw === 'rtb') return 'RTB'
  if (raw === 'betrieb') return language === 'en' ? 'In operation' : 'Im Betrieb'
  return language === 'en' ? 'In development' : 'In Planung'
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
  const optionalData: Record<string, unknown>[] = []

  for (const table of ['project_financials', 'project_economics', 'capex_calculations']) {
    const { data } = await supabase.from(table).select('*').eq('project_id', projectId).order('updated_at', { ascending: false }).limit(1).maybeSingle()
    if (data) optionalData.push(data)
  }

  return mergeProjectEconomicSources(project, deal, optionalData)
}

function buildPdfData(project: Record<string, unknown>, language: MemorandumLanguage): MemorandumPdfData {
  const rawCountry = String(project.location_country || 'Deutschland')
  const country = language === 'en' ? COUNTRY_NAMES_EN[rawCountry] || rawCountry : rawCountry
  const code = COUNTRY_CODES[rawCountry]
  const location = [project.location_city, project.location_state].filter(Boolean).join(', ') || country
  const dateLabel = new Intl.DateTimeFormat(locale(language), { month: 'long', year: 'numeric' }).format(new Date())
  const economics = resolvePvEconomics(project)
  const purchasePrice = economics.purchasePrice
  const pvKwp = economics.pvKwp
  const tariff = economics.tariffEurKwh
  const price = economics.purchasePrice ?? 0
  const tariffEur = economics.tariffEurKwh
  const annualYield = economics.annualYieldKwh
  const displaySpecificYield = economics.specificYieldKwhPerKwp
  const annualRevenue = economics.annualRevenue
  const amortisation = economics.amortisationYears
  const roi = economics.roiPercent
  const presentation = getExposePresentation(
    { ...project, purchase_price: purchasePrice, pv_kwp: pvKwp, specific_yield: displaySpecificYield, feed_in_tariff: tariff, amortisation_years: amortisation },
    location,
    {
      number: (value, digits) => formatNumber(value, digits, language),
      money: (value) => formatMoney(value, language),
      tariff: (value) => tariffDisplay(value, language),
    },
    language,
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
    status: stageLabel(project.project_stage, language),
    summary: presentation.summary,
    metrics: presentation.metrics,
    profile: presentation.profile,
    highlights: presentation.highlights,
    dataCenterDetails: presentation.dataCenterDetails,
    heroImage: '/pdf/hero-solarpark.jpg',
    projectImage: presentation.heroImage,
    language,
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

export async function getBulkMemorandumData(projectIds: string[], requestedLanguages: MemorandumLanguage[] = ['de']) {
  const { supabase, userId } = await requireUser()
  const ids = Array.from(new Set(projectIds.filter(Boolean))).slice(0, 20)
  const languages = Array.from(new Set(requestedLanguages.filter((language): language is MemorandumLanguage => language === 'de' || language === 'en'))).slice(0, 2)
  if (!languages.length) languages.push('de')
  const items: Array<{ projectId: string; language: MemorandumLanguage; data: MemorandumPdfData }> = []

  for (const projectId of ids) {
    const project = await loadProjectData(projectId, userId, supabase as any)
    if (project) {
      for (const language of languages) items.push({ projectId, language, data: buildPdfData(project, language) })
    }
  }

  return { success: true as const, data: items }
}

export interface DeliveryLogInput {
  projectIds: string[]
  recipients: Array<{ id?: string; name: string; email?: string; type: 'investor' | 'partner' | 'manual' }>
  channel: 'email' | 'whatsapp'
  status: 'sent' | 'shared'
  languages?: MemorandumLanguage[]
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
    metadata: { languages: input.languages?.length ? input.languages : ['de'] },
  })))

  const { error } = await (supabase as any).from('document_deliveries').insert(rows)
  if (error) return { error: error.message }

  for (const projectId of projectIds) {
    await supabase.from('activity_log').insert({
      user_id: userId,
      project_id: projectId,
      activity_type: 'manual' as never,
      title: 'Exposé versendet',
      description: `${recipients.length} Empfänger · ${input.channel === 'email' ? 'E-Mail' : 'WhatsApp'} · ${(input.languages?.length ? input.languages : ['de']).map((language) => language.toUpperCase()).join(' + ')}`,
      metadata: { channel: input.channel, recipient_count: recipients.length, languages: input.languages?.length ? input.languages : ['de'] },
    })
  }

  revalidatePath('/projects')
  return { success: true as const }
}
