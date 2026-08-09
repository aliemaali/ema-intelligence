import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mergeProjectEconomicSources, resolvePvEconomics } from '@/lib/projects/pv-units'

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (error || !project) {
    return NextResponse.json({ error: error?.message || 'Projekt nicht gefunden' }, { status: 404 })
  }

  const { data: deal } = await supabase
    .from('deals')
    .select('*')
    .eq('project_id', params.id)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  const merged = mergeProjectEconomicSources(
    project as unknown as Record<string, unknown>,
    deal as unknown as Record<string, unknown> | null,
  )
  const economics = resolvePvEconomics(merged)

  return NextResponse.json({
    specificYield: economics.specificYieldKwhPerKwp,
    tariff: economics.tariffEurKwh,
    annualProduction: economics.annualYieldKwh,
    annualRevenue: economics.annualRevenue,
    amortisation: economics.amortisationYears,
  })
}
