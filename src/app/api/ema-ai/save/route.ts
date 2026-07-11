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
  const specificYield = Number(body?.specificYield ?? 0) || null
  const tariff = Number(body?.tariff ?? 0) || null

  if (!projectId) {
    return NextResponse.json({ error: 'Projekt fehlt' }, { status: 400 })
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('ai_score_details')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 400 })
  }

  const existingDetails =
    project?.ai_score_details && typeof project.ai_score_details === 'object'
      ? project.ai_score_details as Record<string, unknown>
      : {}

  const { error: updateError } = await supabase
    .from('projects')
    .update({
      ai_score_details: {
        ...existingDetails,
        ema_ai: {
          purchase_price: purchasePrice,
          specific_yield: specificYield,
          tariff,
          saved_at: new Date().toISOString(),
        },
      },
    } as never)
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
    await supabase
      .from('deals')
      .update({ purchase_price: purchasePrice } as never)
      .eq('id', activeDeal.id)
      .eq('user_id', user.id)
  }

  return NextResponse.json({ success: true })
}
