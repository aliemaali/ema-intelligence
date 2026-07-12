import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return null
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const { data: project, error } = await supabase
    .from('projects')
    .select('id, pv_mwp, ai_score_details')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (error || !project) {
    return NextResponse.json({ error: error?.message || 'Projekt nicht gefunden' }, { status: 404 })
  }

  const details = project.ai_score_details && typeof project.ai_score_details === 'object'
    ? project.ai_score_details as Record<string, unknown>
    : {}
  const emaAi = details.ema_ai && typeof details.ema_ai === 'object'
    ? details.ema_ai as Record<string, unknown>
    : {}

  const { data: deal } = await supabase
    .from('deals')
    .select('purchase_price')
    .eq('project_id', params.id)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  const pvKwp = firstNumber(emaAi.pv_kwp, project.pv_mwp)
  const purchasePrice = firstNumber(emaAi.purchase_price, deal?.purchase_price)
  const specificYield = firstNumber(emaAi.specific_yield)
  const tariffRaw = firstNumber(emaAi.tariff)
  const tariffEuro = tariffRaw ? (tariffRaw <= 1 ? tariffRaw : tariffRaw / 100) : null
  const annualProduction = pvKwp && specificYield ? pvKwp * specificYield : null
  const annualRevenue = annualProduction && tariffEuro ? annualProduction * tariffEuro : null
  const amortisation = purchasePrice && annualRevenue ? purchasePrice / annualRevenue : null

  return NextResponse.json({
    specificYield,
    tariff: tariffRaw,
    annualProduction,
    annualRevenue,
    amortisation,
  })
}
