// src/app/capex/[projectId]/page.tsx
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCapexCalculationsForProject } from '@/lib/actions/capex.actions'
import { CapexCalculator } from '@/components/capex/CapexCalculator'
import type { ProjectOption } from '@/lib/types/capex.types'

interface PageProps {
  params: Promise<{ projectId: string }>
}

export default async function CapexProjectPage({ params }: PageProps) {
  const { projectId } = await params

  const supabase = await createClient()
  const { data: projectRow, error } = await supabase
    .from('projects')
    .select('id, project_name, pv_mwp, pv_ac_mw, bess_mw, bess_mwh, bess_duration_h, location_city, location_state, location_country')
    .eq('id', projectId)
    .single()

  if (error || !projectRow) notFound()

  const projectOption: ProjectOption = {
    id: projectRow.id,
    name: projectRow.project_name,
    pv_mwp: projectRow.pv_mwp,
    pv_ac_mw: projectRow.pv_ac_mw,
    bess_mw: projectRow.bess_mw,
    bess_mwh: projectRow.bess_mwh,
    bess_duration_h: projectRow.bess_duration_h,
    location_city: projectRow.location_city,
    location_state: projectRow.location_state,
    location_country: projectRow.location_country,
  }

  const calculations = await getCapexCalculationsForProject(projectId)

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f5f9f2] via-[#f7f9fc] to-white px-4 pb-28 pt-[max(6rem,calc(env(safe-area-inset-top)+4.5rem))]">
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
