// src/app/capex/[projectId]/page.tsx
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { getProject } from '@/lib/actions/project.actions'
import { getCapexCalculationsForProject } from '@/lib/actions/capex.actions'
import { CapexCalculator } from '@/components/capex/CapexCalculator'
import type { ProjectOption } from '@/lib/types/capex.types'

interface PageProps {
  params: Promise<{ projectId: string }>
}

function firstPositive(...values: unknown[]) {
  for (const value of values) {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return null
}

export default async function CapexProjectPage({ params }: PageProps) {
  const { projectId } = await params

  let projectRow: any
  try {
    projectRow = await getProject(projectId)
  } catch {
    notFound()
  }

  if (!projectRow) notFound()

  const emaAi = projectRow.ai_score_details?.ema_ai ?? {}
  const storedTariff = firstPositive(
    emaAi.tariff,
    projectRow.tariff,
    projectRow.feed_in_tariff,
    projectRow.verguetung,
  ) ?? 0
  const tariffEurKwh = storedTariff > 1 ? storedTariff / 100 : storedTariff

  const projectOption: ProjectOption = {
    id: String(projectRow.id),
    name: projectRow.project_name ?? 'Unbenanntes Projekt',
    pv_mwp: firstPositive(
      projectRow.pv_kwp,
      projectRow.pv_power_kwp,
      projectRow.pv_capacity_kwp,
      projectRow.capacity_kwp,
      projectRow.pv_mwp,
    ),
    pv_ac_mw: projectRow.pv_ac_mw ?? null,
    bess_mw: projectRow.bess_mw ?? null,
    bess_mwh: projectRow.bess_mwh ?? null,
    bess_duration_h: projectRow.bess_duration_h ?? null,
    location_city: projectRow.location_city ?? null,
    location_state: projectRow.location_state ?? null,
    location_country: projectRow.location_country ?? null,
    specific_yield: firstPositive(
      emaAi.specific_yield,
      projectRow.specific_yield,
      projectRow.spezifischer_ertrag,
    ),
    tariff_eur_kwh: tariffEurKwh || null,
  }

  const calculations = await getCapexCalculationsForProject(projectId)

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f5f9f2] via-[#f7f9fc] to-white px-4 pb-28 pt-[max(8.25rem,calc(env(safe-area-inset-top)+6.75rem))] md:pt-10">
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
  )
}
