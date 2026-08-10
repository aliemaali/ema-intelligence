import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  }

  const body = await request.json()
  const projectId = String(body?.projectId ?? '')
  const purchasePrice = Number(body?.purchasePrice ?? 0) || null
  const pvKwp = Number(body?.pvKwp ?? 0) || null
  const bessMw = Number(body?.bessMw ?? 0) || null
  const bessMwh = Number(body?.bessMwh ?? 0) || null
  const bessDurationHours = Number(body?.bessDurationHours ?? 0) || null
  const specificYield = Number(body?.specificYield ?? 0) || null
  const tariff = Number(body?.tariff ?? 0) || null

  if (!projectId) {
    return NextResponse.json({ error: 'Projekt fehlt' }, { status: 400 })
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('project_type, ai_score_details')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 400 })
  }

  const projectType = String(project.project_type ?? '')
  const isPv = projectType === 'pv_freiflaeche' || projectType === 'pv_dach' || projectType === 'hybrid'
  const hasBess = projectType === 'bess' || projectType === 'hybrid'

  if (isPv && purchasePrice && pvKwp && purchasePrice / pvKwp > 5_000) {
    return NextResponse.json({ error: 'Der Kaufpreis pro kWp ist unplausibel hoch. Bitte Punkt und Komma prüfen.' }, { status: 400 })
  }

  const existingDetails =
    project?.ai_score_details && typeof project.ai_score_details === 'object'
      ? project.ai_score_details as Record<string, unknown>
      : {}

  const projectUpdate: Record<string, unknown> = {
    ai_score_details: {
      ...existingDetails,
      ema_ai: {
        purchase_price: purchasePrice,
        ...(isPv ? { pv_kwp: pvKwp, specific_yield: specificYield, tariff } : {}),
        ...(hasBess ? { bess_mw: bessMw, bess_mwh: bessMwh, bess_duration_h: bessDurationHours } : {}),
        saved_at: new Date().toISOString(),
      },
    },
  }

  if (hasBess) {
    projectUpdate.bess_mw = bessMw
    projectUpdate.bess_mwh = bessMwh
    projectUpdate.bess_duration_h = bessDurationHours
  }

  const { error: updateError } = await supabase
    .from('projects')
    .update(projectUpdate as never)
    .eq('id', projectId)
    .eq('user_id', user.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 })
  }

  const { data: activeDeal } = await supabase
    .from('deals')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (activeDeal?.id && purchasePrice) {
    const dealUpdate: Record<string, unknown> = { purchase_price: purchasePrice }
    if (isPv) dealUpdate.purchase_per_kwp = pvKwp ? purchasePrice / pvKwp : null
    if (hasBess) dealUpdate.purchase_per_mwh = bessMwh ? purchasePrice / bessMwh : null
    await supabase
      .from('deals')
      .update(dealUpdate as never)
      .eq('id', activeDeal.id)
      .eq('user_id', user.id)
  }

  return NextResponse.json({ success: true })
}
