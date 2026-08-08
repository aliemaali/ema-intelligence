import { revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEmaVoiceUserName } from '@/lib/ema/voiceAccess'
import type { ProjectType } from '@/lib/types/database.types'

export const dynamic = 'force-dynamic'

const PROJECT_TYPES: ProjectType[] = [
  'pv_freiflaeche',
  'pv_dach',
  'bess',
  'hybrid',
  'wind',
  'rechenzentrum',
  'sonstiges',
]

const MAX_REQUEST_BYTES = 32 * 1024

function stringValue(value: unknown, maxLength = 500) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function nullableString(value: unknown, maxLength = 500) {
  const parsed = stringValue(value, maxLength)
  return parsed || null
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'string'
    ? Number(value.replace(',', '.'))
    : Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

export async function POST(request: NextRequest) {
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
    return NextResponse.json({ error: 'EMA-Aktionen sind für dieses Benutzerkonto nicht freigeschaltet.' }, { status: 403 })
  }

  let body: { action?: unknown; data?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  if (body.action !== 'create_project') {
    return NextResponse.json({ error: 'Unbekannte EMA-Aktion.' }, { status: 400 })
  }

  const input = body.data && typeof body.data === 'object' && !Array.isArray(body.data)
    ? body.data as Record<string, unknown>
    : {}

  const projectName = stringValue(input.project_name, 160)
  const projectType = stringValue(input.project_type, 40) as ProjectType

  if (!projectName) {
    return NextResponse.json({ error: 'Projektname fehlt.' }, { status: 400 })
  }
  if (!PROJECT_TYPES.includes(projectType)) {
    return NextResponse.json({ error: 'Ungültiger Projekttyp.' }, { status: 400 })
  }

  const payload = {
    user_id: user.id,
    project_name: projectName,
    project_type: projectType,
    status: 'lead',
    project_stage: 'planung',
    priority: 'mittel',
    marketing_status: 'nicht_gestartet',
    partner_id: null,
    contact_name: nullableString(input.contact_name, 160),
    contact_email: nullableString(input.contact_email, 254),
    contact_phone: nullableString(input.contact_phone, 80),
    location_city: nullableString(input.location_city, 160),
    location_state: nullableString(input.location_state, 160),
    location_country: nullableString(input.location_country, 160) ?? 'Deutschland',
    investment_volume_eur: nullableNumber(input.investment_volume_eur),
    lease_term_years: nullableNumber(input.lease_term_years),
    pv_mwp: nullableNumber(input.pv_kwp),
    pv_ac_mw: null,
    bess_mw: nullableNumber(input.bess_mw),
    bess_mwh: nullableNumber(input.bess_mwh),
    bess_duration_h: nullableNumber(input.bess_duration_h),
    data_center_grid_mw: projectType === 'rechenzentrum' ? nullableNumber(input.data_center_grid_mw) : null,
    data_center_it_mw: projectType === 'rechenzentrum' ? nullableNumber(input.data_center_it_mw) : null,
    land_area_sqm: projectType === 'rechenzentrum' ? nullableNumber(input.land_area_sqm) : null,
    transformer_status: projectType === 'rechenzentrum' ? nullableString(input.transformer_status, 300) : null,
    data_center_status: projectType === 'rechenzentrum' ? 'in_entwicklung' : null,
    hybrid_config: null,
    dev_status: {
      netzanschluss: null,
      baugenehmigung: null,
      pachtvertrag: null,
      eeg_faehigkeit: null,
      gutachten: null,
      umweltpruefung: null,
    },
    notes: nullableString(input.notes, 3000),
    tags: [],
    is_archived: false,
  }

  const { data: project, error } = await supabase
    .from('projects')
    .insert(payload as never)
    .select('id, project_number, project_name, project_type')
    .single()

  if (error || !project) {
    console.error('EMA project creation failed:', error)
    return NextResponse.json({ error: 'Projekt konnte nicht erstellt werden.' }, { status: 500 })
  }

  await supabase.from('activity_log').insert({
    user_id: user.id,
    project_id: project.id,
    activity_type: 'manual',
    title: 'Projekt per EMA erstellt',
    description: `${project.project_number} – ${project.project_name}`,
    metadata: { source: 'ema_voice' },
  } as never)

  revalidatePath('/projects')
  revalidatePath('/dashboard')

  return NextResponse.json({
    ok: true,
    result: {
      id: project.id,
      project_number: project.project_number,
      project_name: project.project_name,
      project_type: project.project_type,
      href: `/projects/${project.id}/overview`,
    },
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
