import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEmaVoiceUserName } from '@/lib/ema/voiceAccess'
import { parseCountryProjectListText } from '@/lib/ema/countryProjectList'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_REQUEST_BYTES = 8 * 1024
const MAX_SEARCH_RESULTS = 20

type KnowledgeTool =
  | 'get_portfolio_summary'
  | 'search_ema_projects'
  | 'get_project_details'
  | 'search_ema_country_list_projects'
  | 'search_ema_investors'
  | 'get_investor_details'
  | 'search_ema_partners'
  | 'get_partner_details'
  | 'search_ema_documents'
  | 'get_document_details'

type ProjectRow = {
  id: string
  project_number: string | null
  project_name: string
  project_type: string
  status: string | null
  priority: string | null
  marketing_status: string | null
  location_city: string | null
  location_state: string | null
  location_country: string | null
  contact_name?: string | null
  pv_mwp: number | string | null
  pv_ac_mw?: number | string | null
  bess_mw: number | string | null
  bess_mwh: number | string | null
  bess_duration_h?: number | string | null
  dev_status?: Record<string, boolean | null> | null
  notes?: string | null
  tags?: string[] | null
  project_stage?: string | null
  lease_term_years?: number | string | null
  investment_volume_eur?: number | string | null
  feed_in_type?: string | null
  feed_in_tariff_ct_kwh?: number | string | null
  specific_yield_kwh_kwp?: number | string | null
  annual_yield_kwh?: number | string | null
  data_center_grid_mw?: number | string | null
  data_center_it_mw?: number | string | null
  land_area_sqm?: number | string | null
  transformer_status?: string | null
  data_center_status?: string | null
  data_center_grid_confirmed?: boolean | null
  customer_intake?: Record<string, unknown> | null
  created_at?: string | null
  updated_at?: string | null
}

type CountryListRow = {
  country: string
  project_count: number | string | null
  total_kwp: number | string | null
  display_name: string | null
  file_name: string | null
  created_at: string
}

type InvestorRow = {
  id: string
  full_name: string | null
  company: string | null
  company_name: string | null
  contact_person: string | null
  email: string | null
  phone: string | null
  website: string | null
  location_city: string | null
  location_country: string | null
  country: string | null
  interest_pv: boolean | null
  interest_bess: boolean | null
  interest_hybrid: boolean | null
  interest_wind: boolean | null
  size_preferences: unknown
  investment_type: string | null
  min_ticket_eur: number | string | null
  max_ticket_eur: number | string | null
  ticket_size_min_eur: number | string | null
  ticket_size_max_eur: number | string | null
  dd_ready: boolean | null
  focus: string | null
  status: string | null
  search_profile: Record<string, unknown> | null
  last_contact: string | null
  last_contact_at: string | null
  next_contact_at: string | null
  notes: string | null
  is_active: boolean | null
  updated_at: string | null
}

type PartnerRow = {
  id: string
  full_name: string
  company: string | null
  email: string | null
  phone: string | null
  website: string | null
  location_city: string | null
  location_state: string | null
  notes: string | null
  project_count: number | string | null
  deal_count: number | string | null
  close_rate: number | string | null
  total_volume: number | string | null
  category: string | null
  is_active: boolean | null
  updated_at: string | null
}

type DocumentRow = {
  id: string
  project_id: string
  document_type: string
  display_name: string
  file_name: string
  file_size_bytes: number | string | null
  mime_type: string | null
  version: number | string | null
  ai_analyzed: boolean | null
  ai_extracted_data: Record<string, unknown> | null
  ai_analyzed_at: string | null
  notes: string | null
  updated_at: string | null
}

const PROJECT_SEARCH_COLUMNS = [
  'id',
  'project_number',
  'project_name',
  'project_type',
  'status',
  'priority',
  'marketing_status',
  'location_city',
  'location_state',
  'location_country',
  'pv_mwp',
  'bess_mw',
  'bess_mwh',
  'project_stage',
  'dev_status',
].join(',')

const INVESTOR_COLUMNS = [
  'id',
  'full_name',
  'company',
  'company_name',
  'contact_person',
  'email',
  'phone',
  'website',
  'location_city',
  'location_country',
  'country',
  'interest_pv',
  'interest_bess',
  'interest_hybrid',
  'interest_wind',
  'size_preferences',
  'investment_type',
  'min_ticket_eur',
  'max_ticket_eur',
  'ticket_size_min_eur',
  'ticket_size_max_eur',
  'dd_ready',
  'focus',
  'status',
  'search_profile',
  'last_contact',
  'last_contact_at',
  'next_contact_at',
  'notes',
  'is_active',
  'updated_at',
].join(',')

const PARTNER_COLUMNS = [
  'id',
  'full_name',
  'company',
  'email',
  'phone',
  'website',
  'location_city',
  'location_state',
  'notes',
  'project_count',
  'deal_count',
  'close_rate',
  'total_volume',
  'category',
  'is_active',
  'updated_at',
].join(',')

const DOCUMENT_COLUMNS = [
  'id',
  'project_id',
  'document_type',
  'display_name',
  'file_name',
  'file_size_bytes',
  'mime_type',
  'version',
  'ai_analyzed',
  'ai_extracted_data',
  'ai_analyzed_at',
  'notes',
  'updated_at',
].join(',')

const PROJECT_DETAIL_COLUMNS = [
  'id',
  'project_number',
  'project_name',
  'project_type',
  'status',
  'priority',
  'marketing_status',
  'location_city',
  'location_state',
  'location_country',
  'contact_name',
  'pv_mwp',
  'pv_ac_mw',
  'bess_mw',
  'bess_mwh',
  'bess_duration_h',
  'dev_status',
  'notes',
  'tags',
  'project_stage',
  'lease_term_years',
  'investment_volume_eur',
  'feed_in_type',
  'feed_in_tariff_ct_kwh',
  'specific_yield_kwh_kwp',
  'annual_yield_kwh',
  'data_center_grid_mw',
  'data_center_it_mw',
  'land_area_sqm',
  'transformer_status',
  'data_center_status',
  'data_center_grid_confirmed',
  'customer_intake',
  'created_at',
  'updated_at',
].join(',')

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalized(value: unknown) {
  return String(value ?? '')
    .toLocaleLowerCase('de-DE')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function boundedLimit(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 10
  return Math.max(1, Math.min(MAX_SEARCH_RESULTS, Math.floor(parsed)))
}

function latestCountryLists(rows: CountryListRow[]) {
  const latest = new Map<string, CountryListRow>()
  for (const row of rows) {
    const country = String(row.country ?? '').trim()
    if (!country || latest.has(country)) continue
    latest.set(country, row)
  }
  return Array.from(latest.values())
}

function compactProject(project: ProjectRow) {
  return {
    id: project.id,
    project_number: project.project_number,
    project_name: project.project_name,
    project_type: project.project_type,
    status: project.status,
    project_stage: project.project_stage,
    priority: project.priority,
    marketing_status: project.marketing_status,
    location: {
      country: project.location_country,
      state: project.location_state,
      city: project.location_city,
    },
    pv_kwp: numberValue(project.pv_mwp),
    bess_mw: numberValue(project.bess_mw),
    bess_mwh: numberValue(project.bess_mwh),
    development_status: project.dev_status ?? null,
  }
}

async function loadActiveProjects(supabase: Awaited<ReturnType<typeof createClient>>, columns: string) {
  const { data, error } = await supabase
    .from('projects')
    .select(columns)
    .eq('is_archived', false)
    .order('project_number', { ascending: true, nullsFirst: false })
    .limit(500)

  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as ProjectRow[]
}

async function loadCountryLists(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase
    .from('country_project_lists')
    .select('country, project_count, total_kwp, display_name, file_name, created_at')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return latestCountryLists((data ?? []) as unknown as CountryListRow[])
}

async function portfolioSummary(supabase: Awaited<ReturnType<typeof createClient>>) {
  const [projects, countryLists] = await Promise.all([
    loadActiveProjects(supabase, PROJECT_SEARCH_COLUMNS),
    loadCountryLists(supabase),
  ])

  const pvProjects = projects.filter((project) =>
    ['pv_freiflaeche', 'pv_dach', 'hybrid'].includes(project.project_type),
  )
  const listProjectCount = countryLists.reduce((sum, row) => sum + numberValue(row.project_count), 0)
  const activePvKwp = pvProjects.reduce((sum, project) => sum + numberValue(project.pv_mwp), 0)
  const listPvKwp = countryLists.reduce((sum, row) => sum + numberValue(row.total_kwp), 0)
  const bessMwh = projects.reduce((sum, project) => sum + numberValue(project.bess_mwh), 0)

  const countryBreakdown = new Map<string, { active_projects: number; active_pv_kwp: number }>()
  for (const project of projects) {
    const country = String(project.location_country || 'Unbekannt').trim() || 'Unbekannt'
    const current = countryBreakdown.get(country) ?? { active_projects: 0, active_pv_kwp: 0 }
    current.active_projects += 1
    if (['pv_freiflaeche', 'pv_dach', 'hybrid'].includes(project.project_type)) {
      current.active_pv_kwp += numberValue(project.pv_mwp)
    }
    countryBreakdown.set(country, current)
  }

  return {
    source: 'EMA Intelligence live database',
    generated_at: new Date().toISOString(),
    total_projects_visible: projects.length + listProjectCount,
    active_individual_projects: projects.length,
    pv_projects_total: pvProjects.length + listProjectCount,
    pv_projects_active: pvProjects.length,
    projects_in_saved_country_overviews: listProjectCount,
    pv_capacity_kwp_total: activePvKwp + listPvKwp,
    pv_capacity_kwp_active: activePvKwp,
    pv_capacity_kwp_in_country_overviews: listPvKwp,
    bess_capacity_mwh_active: bessMwh,
    data_center_sites: projects.filter((project) => project.project_type === 'rechenzentrum').length,
    active_by_type: Object.fromEntries(
      Array.from(new Set(projects.map((project) => project.project_type))).map((type) => [
        type,
        projects.filter((project) => project.project_type === type).length,
      ]),
    ),
    countries: Array.from(countryBreakdown.entries()).map(([country, values]) => ({
      country,
      ...values,
      saved_overview: countryLists.find((row) => normalized(row.country) === normalized(country))
        ? {
            project_count: numberValue(countryLists.find((row) => normalized(row.country) === normalized(country))?.project_count),
            total_kwp: numberValue(countryLists.find((row) => normalized(row.country) === normalized(country))?.total_kwp),
          }
        : null,
    })),
    additional_country_overviews: countryLists
      .filter((row) => !countryBreakdown.has(row.country))
      .map((row) => ({
        country: row.country,
        project_count: numberValue(row.project_count),
        total_kwp: numberValue(row.total_kwp),
        display_name: row.display_name,
      })),
    note: 'DE/EN PDFs derselben Länder-Projektliste werden pro Land nur einmal gezählt.',
  }
}

async function searchProjects(
  supabase: Awaited<ReturnType<typeof createClient>>,
  args: Record<string, unknown>,
) {
  const [projects, countryLists] = await Promise.all([
    loadActiveProjects(supabase, PROJECT_SEARCH_COLUMNS),
    loadCountryLists(supabase),
  ])

  const query = normalized(args.query)
  const country = normalized(args.country)
  const projectType = normalized(args.project_type)
  const status = normalized(args.status)
  const limit = boundedLimit(args.limit)

  const filtered = projects.filter((project) => {
    if (country && normalized(project.location_country) !== country) return false
    if (projectType && normalized(project.project_type) !== projectType) return false
    if (status && normalized(project.status) !== status && normalized(project.project_stage) !== status) return false
    if (!query) return true

    return [
      project.project_number,
      project.project_name,
      project.project_type,
      project.status,
      project.project_stage,
      project.location_country,
      project.location_state,
      project.location_city,
    ].some((value) => normalized(value).includes(query))
  })

  const matchingCountryOverviews = countryLists.filter((row) => {
    if (country && normalized(row.country) !== country) return false
    if (!query) return Boolean(country)
    return normalized(row.country).includes(query) || normalized(row.display_name).includes(query)
  })

  return {
    matches: filtered.slice(0, limit).map(compactProject),
    match_count: filtered.length,
    country_overviews: matchingCountryOverviews.map((row) => ({
      country: row.country,
      project_count: numberValue(row.project_count),
      total_kwp: numberValue(row.total_kwp),
      display_name: row.display_name,
    })),
    limitation: matchingCountryOverviews.length
      ? 'Die Länderübersicht enthält die aggregierte Projektzahl und Leistung. Einzelne Projekte innerhalb der PDF-Liste sind noch nicht als strukturierte Datensätze gespeichert.'
      : null,
  }
}

async function projectDetails(
  supabase: Awaited<ReturnType<typeof createClient>>,
  args: Record<string, unknown>,
) {
  const query = normalized(args.query)
  if (!query) return { found: false, error: 'Projektname oder Projektnummer fehlt.' }

  const projects = await loadActiveProjects(supabase, PROJECT_DETAIL_COLUMNS)
  const exact = projects.find((project) =>
    [project.id, project.project_number, project.project_name].some((value) => normalized(value) === query),
  )
  const partial = exact ?? projects.find((project) =>
    [project.project_number, project.project_name].some((value) => normalized(value).includes(query)),
  )

  if (!partial) return { found: false, query: args.query }

  return {
    found: true,
    project: {
      ...compactProject(partial),
      pv_ac_kw: numberValue(partial.pv_ac_mw),
      bess_duration_h: numberValue(partial.bess_duration_h),
      contact_name: partial.contact_name,
      lease_term_years: numberValue(partial.lease_term_years) || null,
      investment_volume_eur: numberValue(partial.investment_volume_eur) || null,
      feed_in_type: partial.feed_in_type,
      feed_in_tariff_ct_kwh: numberValue(partial.feed_in_tariff_ct_kwh) || null,
      specific_yield_kwh_kwp: numberValue(partial.specific_yield_kwh_kwp) || null,
      annual_yield_kwh: numberValue(partial.annual_yield_kwh) || null,
      data_center: partial.project_type === 'rechenzentrum'
        ? {
            grid_mw: numberValue(partial.data_center_grid_mw),
            grid_confirmed: partial.data_center_grid_confirmed ?? false,
            it_mw: numberValue(partial.data_center_it_mw),
            land_area_sqm: numberValue(partial.land_area_sqm),
            transformer_status: partial.transformer_status,
            status: partial.data_center_status,
          }
        : null,
      notes: partial.notes,
      tags: partial.tags ?? [],
      customer_intake: partial.customer_intake ?? {},
      created_at: partial.created_at,
      updated_at: partial.updated_at,
    },
  }
}


function countrySourceAliases(country: string) {
  const value = normalized(country)
  if (value === 'frankreich' || value === 'france') return ['frankreich', 'france']
  return value ? [value] : []
}

async function searchCountryListProjects(
  supabase: Awaited<ReturnType<typeof createClient>>,
  args: Record<string, unknown>,
) {
  const requestedCountry = String(args.country ?? '').trim()
  if (!requestedCountry) return { found: false, error: 'Land fehlt.' }

  const countryLists = await loadCountryLists(supabase)
  const list = countryLists.find((row) => {
    const aliases = countrySourceAliases(requestedCountry)
    const rowCountry = normalized(row.country)
    return aliases.includes(rowCountry)
      || (aliases.includes('france') && rowCountry === 'frankreich')
      || (aliases.includes('frankreich') && rowCountry === 'france')
  })
  if (!list) return { found: false, country: requestedCountry, error: 'Keine gespeicherte Länder-Projektliste gefunden.' }

  const aliases = countrySourceAliases(list.country)
  const { data: imports, error: importError } = await supabase
    .from('project_imports')
    .select('id,storage_bucket,storage_paths,original_file_names,created_at')
    .lte('created_at', list.created_at)
    .order('created_at', { ascending: false })
    .limit(50)

  if (importError) throw new Error(importError.message)

  const source = (imports ?? []).find((item) => {
    const names = Array.isArray((item as { original_file_names?: unknown }).original_file_names)
      ? (item as { original_file_names: string[] }).original_file_names
      : []
    return names.some((name) => aliases.some((alias) => normalized(name).includes(alias)))
  }) as {
    id: string
    storage_bucket: string | null
    storage_paths: string[] | null
    original_file_names: string[] | null
    created_at: string
  } | undefined

  if (!source || source.storage_bucket !== 'project-imports') {
    return {
      found: true,
      country: list.country,
      source_available: false,
      project_count: numberValue(list.project_count),
      total_kwp: numberValue(list.total_kwp),
      limitation: 'Die gespeicherte Übersicht ist vorhanden, aber die strukturierte Quelldatei wurde nicht gefunden.',
    }
  }

  const paths = source.storage_paths ?? []
  const names = source.original_file_names ?? []
  let combinedText = ''

  for (const [index, storagePath] of paths.entries()) {
    const name = names[index] ?? ''
    const lower = name.toLocaleLowerCase('de-DE')
    if (!lower.endsWith('.pdf') && !lower.endsWith('.csv') && !lower.endsWith('.txt')) continue

    const { data: blob, error: downloadError } = await supabase.storage
      .from('project-imports')
      .download(storagePath)
    if (downloadError || !blob) continue
    if (blob.size > 20 * 1024 * 1024) throw new Error('Projektlisten-Quelldatei ist zu groß.')

    const buffer = Buffer.from(await blob.arrayBuffer())
    if (lower.endsWith('.pdf')) {
      const pdfParse = (await import('pdf-parse')).default
      const parsed = await pdfParse(buffer)
      combinedText += `\n${parsed.text || ''}`
    } else {
      combinedText += `\n${buffer.toString('utf-8')}`
    }
  }

  const projects = parseCountryProjectListText(combinedText)
  if (projects.length === 0) {
    return {
      found: true,
      country: list.country,
      source_available: true,
      project_count: numberValue(list.project_count),
      total_kwp: numberValue(list.total_kwp),
      limitation: 'Die Quelldatei ist vorhanden, aber ihre Projektzeilen konnten nicht sicher gelesen werden.',
    }
  }

  const query = normalized(args.query)
  const region = normalized(args.region)
  const minPvKwp = nullableNumber(args.min_pv_kwp)
  const maxPvKwp = nullableNumber(args.max_pv_kwp)
  const limit = boundedLimit(args.limit)

  const filtered = projects.filter((project) => {
    const pvKwp = nullableNumber(project.pvKwp)
    if (region && !normalized(project.region).includes(region)) return false
    if (minPvKwp !== null && (pvKwp === null || pvKwp < minPvKwp)) return false
    if (maxPvKwp !== null && (pvKwp === null || pvKwp > maxPvKwp)) return false
    if (!query) return true

    return [
      project.externalNumber,
      project.region,
      project.projectName,
      project.structure,
      project.permissionDate,
      project.commissioning,
    ].some((value) => normalized(value).includes(query))
  })

  return {
    found: true,
    country: list.country,
    source_available: true,
    source_project_count: projects.length,
    saved_project_count: numberValue(list.project_count),
    saved_total_kwp: numberValue(list.total_kwp),
    match_count: filtered.length,
    matches: filtered.slice(0, limit).map((project) => ({
      external_number: project.externalNumber,
      project_name: project.projectName,
      region: project.region,
      pv_kwp: project.pvKwp,
      grid_distance_km: project.gridDistanceKm,
      structure: project.structure,
      permission_date: project.permissionDate || null,
      studies_start: project.studiesStart || null,
      commissioning: project.commissioning || null,
      secured_land_ha: project.securedLandHa,
      specific_yield_kwh_kwp: project.specificYield,
    })),
  }
}

function compactInvestor(investor: InvestorRow) {
  const company = investor.company_name || investor.company
  const contact = investor.contact_person || investor.full_name
  return {
    id: investor.id,
    company,
    contact_person: contact,
    location: {
      country: investor.country || investor.location_country,
      city: investor.location_city,
    },
    interests: {
      pv: investor.interest_pv ?? false,
      bess: investor.interest_bess ?? false,
      hybrid: investor.interest_hybrid ?? false,
      wind: investor.interest_wind ?? false,
    },
    focus: investor.focus,
    investment_type: investor.investment_type,
    ticket_min_eur: nullableNumber(investor.ticket_size_min_eur ?? investor.min_ticket_eur),
    ticket_max_eur: nullableNumber(investor.ticket_size_max_eur ?? investor.max_ticket_eur),
    size_preferences: investor.size_preferences ?? null,
    dd_ready: investor.dd_ready ?? false,
    status: investor.status,
    active: investor.is_active ?? true,
    next_contact_at: investor.next_contact_at,
  }
}

async function loadInvestors(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase
    .from('investors')
    .select(INVESTOR_COLUMNS)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(500)

  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as InvestorRow[]
}

async function searchInvestors(
  supabase: Awaited<ReturnType<typeof createClient>>,
  args: Record<string, unknown>,
) {
  const investors = await loadInvestors(supabase)
  const query = normalized(args.query)
  const focus = normalized(args.focus)
  const activeOnly = args.active_only === true
  const limit = boundedLimit(args.limit)

  const filtered = investors.filter((investor) => {
    if (activeOnly && investor.is_active === false) return false
    const profileText = investor.search_profile ? normalized(JSON.stringify(investor.search_profile)) : ''
    if (focus && ![
      investor.focus,
      investor.investment_type,
      profileText,
    ].some((value) => normalized(value).includes(focus))) return false
    if (!query) return true

    return [
      investor.full_name,
      investor.company,
      investor.company_name,
      investor.contact_person,
      investor.location_city,
      investor.location_country,
      investor.country,
      investor.focus,
      investor.status,
      investor.investment_type,
      profileText,
    ].some((value) => normalized(value).includes(query))
  })

  return {
    match_count: filtered.length,
    matches: filtered.slice(0, limit).map(compactInvestor),
  }
}

async function investorDetails(
  supabase: Awaited<ReturnType<typeof createClient>>,
  args: Record<string, unknown>,
) {
  const query = normalized(args.query)
  if (!query) return { found: false, error: 'Investor, Firma oder Kontaktperson fehlt.' }

  const investors = await loadInvestors(supabase)
  const exact = investors.find((investor) => [
    investor.id,
    investor.full_name,
    investor.company,
    investor.company_name,
    investor.contact_person,
  ].some((value) => normalized(value) === query))
  const match = exact ?? investors.find((investor) => [
    investor.full_name,
    investor.company,
    investor.company_name,
    investor.contact_person,
  ].some((value) => normalized(value).includes(query)))

  if (!match) return { found: false, query: args.query }

  const includeContact = args.include_contact_details === true
  return {
    found: true,
    investor: {
      ...compactInvestor(match),
      website: match.website,
      last_contact: match.last_contact_at || match.last_contact,
      notes: match.notes,
      search_profile: match.search_profile,
      contact_details: includeContact ? {
        email: match.email,
        phone: match.phone,
      } : null,
    },
  }
}

function compactPartner(partner: PartnerRow) {
  return {
    id: partner.id,
    full_name: partner.full_name,
    company: partner.company,
    category: partner.category,
    location: {
      state: partner.location_state,
      city: partner.location_city,
    },
    project_count: numberValue(partner.project_count),
    deal_count: numberValue(partner.deal_count),
    close_rate: nullableNumber(partner.close_rate),
    total_volume: nullableNumber(partner.total_volume),
    active: partner.is_active ?? true,
  }
}

async function loadPartners(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase
    .from('partners')
    .select(PARTNER_COLUMNS)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(500)

  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as PartnerRow[]
}

async function searchPartners(
  supabase: Awaited<ReturnType<typeof createClient>>,
  args: Record<string, unknown>,
) {
  const partners = await loadPartners(supabase)
  const query = normalized(args.query)
  const category = normalized(args.category)
  const activeOnly = args.active_only === true
  const limit = boundedLimit(args.limit)

  const filtered = partners.filter((partner) => {
    if (activeOnly && partner.is_active === false) return false
    if (category && normalized(partner.category) !== category) return false
    if (!query) return true

    return [
      partner.full_name,
      partner.company,
      partner.category,
      partner.location_city,
      partner.location_state,
      partner.notes,
    ].some((value) => normalized(value).includes(query))
  })

  return {
    match_count: filtered.length,
    matches: filtered.slice(0, limit).map(compactPartner),
  }
}

async function partnerDetails(
  supabase: Awaited<ReturnType<typeof createClient>>,
  args: Record<string, unknown>,
) {
  const query = normalized(args.query)
  if (!query) return { found: false, error: 'Partnername oder Firma fehlt.' }

  const partners = await loadPartners(supabase)
  const exact = partners.find((partner) => [
    partner.id,
    partner.full_name,
    partner.company,
  ].some((value) => normalized(value) === query))
  const match = exact ?? partners.find((partner) => [
    partner.full_name,
    partner.company,
  ].some((value) => normalized(value).includes(query)))

  if (!match) return { found: false, query: args.query }

  const includeContact = args.include_contact_details === true
  return {
    found: true,
    partner: {
      ...compactPartner(match),
      website: match.website,
      notes: match.notes,
      contact_details: includeContact ? {
        email: match.email,
        phone: match.phone,
      } : null,
    },
  }
}

async function loadDocuments(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase
    .from('documents')
    .select(DOCUMENT_COLUMNS)
    .eq('is_archived', false)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(500)

  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as DocumentRow[]
}

function compactDocument(document: DocumentRow, project: ProjectRow | undefined) {
  const contentIndexed = document.ai_analyzed === true &&
    Boolean(document.ai_extracted_data && Object.keys(document.ai_extracted_data).length > 0)

  return {
    id: document.id,
    project: project ? {
      id: project.id,
      project_number: project.project_number,
      project_name: project.project_name,
    } : { id: document.project_id },
    document_type: document.document_type,
    display_name: document.display_name,
    file_name: document.file_name,
    mime_type: document.mime_type,
    file_size_bytes: nullableNumber(document.file_size_bytes),
    version: nullableNumber(document.version),
    notes: document.notes,
    content_indexed: contentIndexed,
    ai_analyzed_at: document.ai_analyzed_at,
  }
}

async function searchDocuments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  args: Record<string, unknown>,
) {
  const [documents, projects] = await Promise.all([
    loadDocuments(supabase),
    loadActiveProjects(supabase, 'id,project_number,project_name,project_type,status,priority,marketing_status,location_city,location_state,location_country,pv_mwp,bess_mw,bess_mwh'),
  ])
  const projectMap = new Map(projects.map((project) => [project.id, project]))
  const query = normalized(args.query)
  const projectQuery = normalized(args.project)
  const documentType = normalized(args.document_type)
  const limit = boundedLimit(args.limit)

  const filtered = documents.filter((document) => {
    const project = projectMap.get(document.project_id)
    if (documentType && normalized(document.document_type) !== documentType) return false
    if (projectQuery && ![
      project?.id,
      project?.project_number,
      project?.project_name,
    ].some((value) => normalized(value).includes(projectQuery))) return false
    if (!query) return true

    return [
      document.display_name,
      document.file_name,
      document.document_type,
      document.notes,
      project?.project_number,
      project?.project_name,
    ].some((value) => normalized(value).includes(query))
  })

  return {
    match_count: filtered.length,
    matches: filtered.slice(0, limit).map((document) => compactDocument(document, projectMap.get(document.project_id))),
    content_indexing: {
      indexed_matches: filtered.filter((document) =>
        document.ai_analyzed === true &&
        Boolean(document.ai_extracted_data && Object.keys(document.ai_extracted_data).length > 0),
      ).length,
      note: 'Dateiinhalte können nur beantwortet werden, wenn content_indexed true ist. Nicht indexierte PDFs nicht erfinden.',
    },
  }
}

async function documentDetails(
  supabase: Awaited<ReturnType<typeof createClient>>,
  args: Record<string, unknown>,
) {
  const query = normalized(args.query)
  if (!query) return { found: false, error: 'Dokumentname oder Dokument-ID fehlt.' }

  const [documents, projects] = await Promise.all([
    loadDocuments(supabase),
    loadActiveProjects(supabase, 'id,project_number,project_name,project_type,status,priority,marketing_status,location_city,location_state,location_country,pv_mwp,bess_mw,bess_mwh'),
  ])
  const projectMap = new Map(projects.map((project) => [project.id, project]))
  const exact = documents.find((document) => [
    document.id,
    document.display_name,
    document.file_name,
  ].some((value) => normalized(value) === query))
  const match = exact ?? documents.find((document) => [
    document.display_name,
    document.file_name,
    projectMap.get(document.project_id)?.project_name,
    projectMap.get(document.project_id)?.project_number,
  ].some((value) => normalized(value).includes(query)))

  if (!match) return { found: false, query: args.query }

  const compact = compactDocument(match, projectMap.get(match.project_id))
  return {
    found: true,
    document: {
      ...compact,
      extracted_content: compact.content_indexed ? match.ai_extracted_data : null,
    },
    limitation: compact.content_indexed
      ? null
      : 'Der Dokumentinhalt ist noch nicht indexiert. EMA darf aus Dateiname oder Dokumenttyp keine Inhalte ableiten.',
  }
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: 'Anfrage zu groß.' }, { status: 413 })
  }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  }

  if (!getEmaVoiceUserName(user.email)) {
    return NextResponse.json({ error: 'EMA-Wissen ist für dieses Benutzerkonto nicht freigeschaltet.' }, { status: 403 })
  }

  let body: { tool?: unknown; args?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  const tool = typeof body.tool === 'string' ? body.tool as KnowledgeTool : null
  const args = body.args && typeof body.args === 'object' && !Array.isArray(body.args)
    ? body.args as Record<string, unknown>
    : {}

  if (!tool || ![
    'get_portfolio_summary',
    'search_ema_projects',
    'get_project_details',
    'search_ema_country_list_projects',
    'search_ema_investors',
    'get_investor_details',
    'search_ema_partners',
    'get_partner_details',
    'search_ema_documents',
    'get_document_details',
  ].includes(tool)) {
    return NextResponse.json({ error: 'Unbekanntes EMA-Werkzeug.' }, { status: 400 })
  }

  try {
    const result = tool === 'get_portfolio_summary'
      ? await portfolioSummary(supabase)
      : tool === 'search_ema_projects'
        ? await searchProjects(supabase, args)
        : tool === 'get_project_details'
          ? await projectDetails(supabase, args)
          : tool === 'search_ema_country_list_projects'
            ? await searchCountryListProjects(supabase, args)
          : tool === 'search_ema_investors'
            ? await searchInvestors(supabase, args)
            : tool === 'get_investor_details'
              ? await investorDetails(supabase, args)
              : tool === 'search_ema_partners'
                ? await searchPartners(supabase, args)
                : tool === 'get_partner_details'
                  ? await partnerDetails(supabase, args)
                  : tool === 'search_ema_documents'
                    ? await searchDocuments(supabase, args)
                    : await documentDetails(supabase, args)

    return NextResponse.json({ ok: true, result }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('EMA knowledge tool failed:', tool, error)
    return NextResponse.json({ error: 'EMA konnte die aktuellen EMA-Daten gerade nicht lesen.' }, { status: 500 })
  }
}
