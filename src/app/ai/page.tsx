import { EmaAiAssistantV2 } from '@/components/ai/EmaAiAssistantV2'
import { TopHeader } from '@/components/layout/TopHeader'
import { getProjects } from '@/lib/actions/project.actions'

export const metadata = {
  title: 'EMA-AI',
  description: 'Exposé- und Amortisationsassistent von EMA Intelligence',
}

function firstPositive(...values: unknown[]) {
  for (const value of values) {
    const number = Number(value)
    if (Number.isFinite(number) && number > 0) return number
  }
  return null
}

export default async function EmaAiPage() {
  const projects = await getProjects()

  const aiProjects = projects.map((project: any) => {
    const emaAi = project.ai_score_details?.ema_ai ?? {}

    return {
      id: String(project.id),
      projectNumber: project.project_number ?? null,
      projectName: project.project_name ?? 'Unbenanntes Projekt',
      projectType: project.project_type ?? null,
      status: project.status ?? null,
      locationCity: project.location_city ?? null,
      locationState: project.location_state ?? null,
      pvKwp: firstPositive(
        emaAi.pv_kwp,
        project.pv_kwp,
        project.anlagenleistung_kwp,
        project.pv_mwp,
      ),
      bessMw: project.bess_mw ?? null,
      bessMwh: project.bess_mwh ?? null,
      purchasePrice:
        project.purchase_price ??
        project.deal_purchase_price ??
        project.active_deal_purchase_price ??
        emaAi.purchase_price ??
        null,
      feedInType:
        project.feed_in_type ??
        project.einspeiseart ??
        project.feed_in_model ??
        project.offtake_type ??
        null,
      tariff: firstPositive(
        emaAi.tariff,
        project.tariff,
        project.feed_in_tariff,
        project.verguetung,
      ),
      specificYield: firstPositive(
        emaAi.specific_yield,
        project.specific_yield,
        project.spezifischer_ertrag,
      ),
      rawProject: project,
    }
  })

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f7f9fc] via-white to-[#f4f8f1]">
      <TopHeader />
      <EmaAiAssistantV2 projects={aiProjects} />
    </div>
  )
}
