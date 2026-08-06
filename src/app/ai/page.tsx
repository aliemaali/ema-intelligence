import { Bot, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react'
import { EmaAiAssistantV2 } from '@/components/ai/EmaAiAssistantV2'
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
    <div className="min-h-screen overflow-x-hidden bg-[#F4F6F8] pb-28 text-[#172033]">
      <section className="relative isolate overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(92,184,0,0.16),transparent_34%),linear-gradient(135deg,#F4F6F8_0%,#FFFFFF_58%,#F4F6F8_100%)]" />
        <div className="absolute -right-20 top-0 h-64 w-64 rounded-full bg-[#5CB800]/10 blur-3xl" />
        <div className="relative mx-auto max-w-[1480px] px-5 pb-8 pt-8 md:px-8 md:pb-10 md:pt-12">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/[0.055] px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.16em] text-[#76d22a] backdrop-blur-xl">
                <Sparkles className="h-4 w-4" /> EMA Intelligence
              </div>
              <h1 className="mt-5 text-4xl font-extrabold leading-[0.98] tracking-[-0.055em] text-[#172033] sm:text-5xl md:text-6xl">Frag EMA.</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-[#667085] md:text-base">Analysiere vorhandene Projekte, finde Kennzahlen und bereite Entscheidungen schneller vor – mit deinen echten EMA-Daten.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:min-w-[540px]">
              <div className="rounded-[1.25rem] border border-slate-200 bg-white/[0.045] p-4 backdrop-blur-xl"><Bot className="h-5 w-5 text-[#76d22a]" /><p className="mt-3 text-2xl font-extrabold text-[#172033]">{aiProjects.length}</p><p className="mt-1 text-xs text-[#667085]">verfügbare Projekte</p></div>
              <div className="rounded-[1.25rem] border border-slate-200 bg-white/[0.045] p-4 backdrop-blur-xl"><ShieldCheck className="h-5 w-5 text-[#76d22a]" /><p className="mt-3 text-sm font-extrabold text-[#172033]">Kontrolliert</p><p className="mt-1 text-xs text-[#667085]">Schreibaktionen nur nach Bestätigung</p></div>
              <div className="rounded-[1.25rem] border border-slate-200 bg-white/[0.045] p-4 backdrop-blur-xl"><CheckCircle2 className="h-5 w-5 text-[#76d22a]" /><p className="mt-3 text-sm font-extrabold text-[#172033]">Echte Daten</p><p className="mt-1 text-xs text-[#667085]">Keine erfundenen Projekte</p></div>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-[1480px] px-3 pt-5 md:px-8 md:pt-7">
        <div className="overflow-hidden rounded-[1.7rem] border border-slate-200 bg-[#FFFFFF]/96 shadow-[0_14px_40px_rgba(31,42,68,0.10)] [&_.bg-\[\#F7F9FC\]]:!bg-transparent [&_.bg-white]:!bg-[#FFFFFF] [&_.text-\[\#07142F\]]:!text-[#172033] [&_.text-muted-foreground]:!text-[#667085] [&_.border-slate-200]:!border-slate-200">
          <EmaAiAssistantV2 projects={aiProjects} />
        </div>
      </main>
    </div>
  )
}
