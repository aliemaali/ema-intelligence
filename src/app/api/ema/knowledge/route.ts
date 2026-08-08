import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEmaVoiceUserName } from '@/lib/ema/voiceAccess'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_REQUEST_BYTES = 8 * 1024
const MAX_SEARCH_RESULTS = 20

type KnowledgeTool = 'get_portfolio_summary' | 'search_ema_projects' | 'get_project_details'

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

  if (!tool || !['get_portfolio_summary', 'search_ema_projects', 'get_project_details'].includes(tool)) {
    return NextResponse.json({ error: 'Unbekanntes EMA-Werkzeug.' }, { status: 400 })
  }

  try {
    const result = tool === 'get_portfolio_summary'
      ? await portfolioSummary(supabase)
      : tool === 'search_ema_projects'
        ? await searchProjects(supabase, args)
        : await projectDetails(supabase, args)

    return NextResponse.json({ ok: true, result }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('EMA knowledge tool failed:', tool, error)
    return NextResponse.json({ error: 'EMA konnte die Projektdaten gerade nicht lesen.' }, { status: 500 })
  }
}
