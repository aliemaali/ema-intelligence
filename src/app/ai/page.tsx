import { EmaAiAssistantV2 } from '@/components/ai/EmaAiAssistantV2'
import { getProjects } from '@/lib/actions/project.actions'
import { mergeProjectEconomicSources, resolvePvEconomics } from '@/lib/projects/pv-units'

export const metadata = {
  title: 'EMA-AI',
  description: 'Exposé- und Amortisationsassistent von EMA Intelligence',
}

export default async function EmaAiPage() {
  const projects = await getProjects()

  const aiProjects = projects.map((project: any) => {
    const merged = mergeProjectEconomicSources(project as Record<string, unknown>)
    const economics = resolvePvEconomics(merged)
    const dataCenterSiteCheck =
      project.data_center_site_check && typeof project.data_center_site_check === 'object'
        ? project.data_center_site_check
        : {}

    return {
      id: String(project.id),
      projectNumber: project.project_number ?? null,
      projectName: project.project_name ?? 'Unbenanntes Projekt',
      projectType: project.project_type ?? null,
      status: project.status ?? null,
      locationCity: project.location_city ?? null,
      locationState: project.location_state ?? null,
      pvKwp: economics.pvKwp,
      bessMw: project.bess_mw ?? null,
      bessMwh: project.bess_mwh ?? null,
      bessDurationHours: project.bess_duration_h ?? null,
      dataCenterGridMw: project.data_center_grid_mw ?? null,
      dataCenterItMw: project.data_center_it_mw ?? null,
      landAreaSqm: project.land_area_sqm ?? null,
      hvDistanceMeters: dataCenterSiteCheck.hvDistanceMeters ?? null,
      fiberDistanceMeters: dataCenterSiteCheck.fiberDistanceMeters ?? null,
      purchasePrice: economics.purchasePrice,
      feedInType:
        project.feed_in_type ??
        project.einspeiseart ??
        project.feed_in_model ??
        project.offtake_type ??
        null,
      tariff: economics.tariffEurKwh,
      specificYield: economics.specificYieldKwhPerKwp,
      rawProject: merged,
    }
  })

  return (
    <div className="min-h-screen bg-[#F7F9FC]">
      <EmaAiAssistantV2 projects={aiProjects} />
    </div>
  )
}
