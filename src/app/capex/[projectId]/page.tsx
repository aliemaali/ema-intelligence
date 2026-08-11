// src/app/capex/[projectId]/page.tsx
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCapexCalculationsForProject } from '@/lib/actions/capex.actions'
import { CapexCalculator } from '@/components/capex/CapexCalculator'
import { TopHeader } from '@/components/layout/TopHeader'
import type { ProjectOption } from '@/lib/types/capex.types'

interface PageProps {
  params: Promise<{ projectId: string }>
}

function firstPositive(...values: unknown[]) {
  for (const value of values) {
    const number = Number(value)
    if (Number.isFinite(number) && number > 0) return number
  }
  return null
}

export default async function CapexProjectPage({ params }: PageProps) {
  const { projectId } = await params

  const supabase = await createClient()
  const [projectResult, dealResult, calculations] = await Promise.all([
    supabase
      .from('projects')
      .select('id, project_name, project_type, pv_mwp, pv_ac_mw, bess_mw, bess_mwh, bess_duration_h, location_address, location_city, location_state, location_country, location_lat, location_lng, specific_yield_kwh_kwp, feed_in_tariff_ct_kwh, lease_term_years, ai_score_details')
      .eq('id', projectId)
      .single(),
    supabase
      .from('deals')
      .select('purchase_price, purchase_per_kwp, purchase_price_type')
      .eq('project_id', projectId)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    getCapexCalculationsForProject(projectId),
  ])

  const { data: projectRow, error } = projectResult
  const deal = dealResult.data

  if (error || !projectRow) notFound()

  const emaAi = (projectRow.ai_score_details as any)?.ema_ai ?? {}
  const storedTariff = firstPositive(emaAi.tariff, projectRow.feed_in_tariff_ct_kwh)
  const tariffEurKwh = storedTariff && storedTariff > 1 ? storedTariff / 100 : storedTariff

  const projectOption: ProjectOption = {
    id: projectRow.id,
    name: projectRow.project_name,
    pv_mwp: firstPositive(emaAi.pv_kwp, projectRow.pv_mwp),
    pv_ac_mw: projectRow.pv_ac_mw,
    bess_mw: projectRow.bess_mw,
    bess_mwh: projectRow.bess_mwh,
    bess_duration_h: projectRow.bess_duration_h,
    location_city: projectRow.location_city,
    location_state: projectRow.location_state,
    location_country: projectRow.location_country,
    location_address: projectRow.location_address,
    location_lat: projectRow.location_lat,
    location_lng: projectRow.location_lng,
    project_type: projectRow.project_type,
    specific_yield: firstPositive(emaAi.specific_yield, projectRow.specific_yield_kwh_kwp),
    tariff_eur_kwh: tariffEurKwh,
    lease_term_years: firstPositive(projectRow.lease_term_years),
    purchase_price: firstPositive(deal?.purchase_price),
    purchase_per_kwp: firstPositive(deal?.purchase_per_kwp),
    purchase_price_type: deal?.purchase_price_type ?? null,
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f5f9f2] via-[#f7f9fc] to-white">
      <TopHeader />
      <main className="px-4 pb-28 pt-6">
        <div className="mx-auto w-full max-w-5xl">
          <Link
            href="/capex"
            className="mb-5 inline-flex min-h-12 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-[#07142F] shadow-sm"
          >
            <ArrowLeft className="h-5 w-5" /> Zurück zur Projektauswahl
          </Link>

          <CapexCalculator projectOption={projectOption} initialCalculations={calculations} />
        </div>
      </main>
    </div>
  )
}
