import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Euro,
  Globe2,
  Mail,
  MapPin,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PrintButton } from '@/components/expose/PrintButton'
import { getExposePresentation } from '@/lib/expose/projectPresentation'

export const dynamic = 'force-dynamic'

function formatNumber(value: unknown, digits = 0) {
  const number = Number(value)
  return Number.isFinite(number)
    ? new Intl.NumberFormat('de-DE', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(number)
    : '—'
}

function formatMoney(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number)
    ? new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
      }).format(number)
    : '—'
}

function tariffDisplay(raw: unknown) {
  const number = Number(raw)
  if (!Number.isFinite(number) || number <= 0) return 'Noch offen'
  return number <= 1 ? `${formatNumber(number, 3)} €/kWh` : `${formatNumber(number, 2)} ct/kWh`
}

function tariffEuroPerKwh(raw: unknown) {
  const number = Number(raw)
  if (!Number.isFinite(number) || number <= 0) return null
  return number <= 1 ? number : number / 100
}

function firstValue(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const current = source[key]
    if (current !== null && current !== undefined && current !== '') return current
  }
  return null
}

async function loadProjectData(projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!project) return null

  const { data: deal } = await supabase
    .from('deals')
    .select('*')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  const emaAi =
    project.ai_score_details && typeof project.ai_score_details === 'object'
      ? (project.ai_score_details as Record<string, unknown>).ema_ai ?? {}
      : {}

  const optionalTables = ['project_financials', 'project_economics', 'capex_calculations']
  const optionalData: Record<string, unknown>[] = []

  for (const table of optionalTables) {
    const { data } = await (supabase as any)
      .from(table)
      .select('*')
      .eq('project_id', projectId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) optionalData.push(data)
  }

  return Object.assign({}, project, deal ?? {}, emaAi, ...optionalData) as Record<string, unknown>
}

export default async function InvestmentMemorandumPage({ params }: { params: { id: string } }) {
  const project = await loadProjectData(params.id)
  if (!project) notFound()

  const location = [project.location_city, project.location_state].filter(Boolean).join(', ') || 'Deutschland'
  const dateLabel = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(new Date())
  const purchasePrice = firstValue(project, ['purchase_price', 'deal_purchase_price', 'total_purchase_price'])
  const pvKwp = firstValue(project, ['pv_kwp', 'pv_mwp', 'capacity_kwp', 'plant_capacity_kwp'])
  const specificYield = firstValue(project, ['specific_yield', 'specific_yield_kwh_kwp', 'yield_kwh_kwp'])
  const tariff = firstValue(project, ['feed_in_tariff', 'feed_in_tariff_ct_kwh', 'tariff_ct_kwh'])
  const storedAnnualYield = firstValue(project, ['annual_yield_kwh', 'annual_energy_kwh', 'annual_production_kwh'])
  const storedAmortisation = firstValue(project, ['amortisation_years', 'amortization_years', 'payback_years'])

  const pv = Number(pvKwp)
  const yieldPerKwp = Number(specificYield)
  const price = Number(purchasePrice)
  const tariffEur = tariffEuroPerKwh(tariff)
  const calculatedAnnualYield = Number.isFinite(pv) && Number.isFinite(yieldPerKwp) ? pv * yieldPerKwp : null
  const annualYield = storedAnnualYield ?? calculatedAnnualYield
  const annualRevenue = Number(annualYield) * (tariffEur ?? 0)
  const calculatedAmortisation = price > 0 && annualRevenue > 0 ? price / annualRevenue : null
  const amortisation = storedAmortisation ?? calculatedAmortisation
  const roi = price > 0 && annualRevenue > 0 ? (annualRevenue / price) * 100 : null

  const enrichedProject = {
    ...project,
    purchase_price: purchasePrice,
    pv_kwp: pvKwp,
    specific_yield: specificYield,
    feed_in_tariff: tariff,
  }

  const presentation = getExposePresentation(enrichedProject, location, {
    number: formatNumber,
    money: formatMoney,
    tariff: tariffDisplay,
  })

  const pdfData = {
    projectName: String(project.project_name || 'Projekt'),
    projectNumber: String(project.project_number || '—'),
    projectType: String(project.project_type || ''),
    typeLabel: presentation.typeLabel,
    location,
    dateLabel,
    status: String(project.status || 'Projektstatus offen'),
    summary: presentation.summary,
    metrics: presentation.metrics,
    profile: presentation.profile,
    highlights: presentation.highlights,
    heroImage: presentation.heroImage,
    showPvEconomics: presentation.showPvEconomics,
    pvEconomics: presentation.showPvEconomics
      ? {
          annualYield: Number(annualYield) || 0,
          annualRevenue: Number(annualRevenue) || 0,
          purchasePrice: Number(price) || 0,
          tariffEurKwh: tariffEur ?? 0,
          roi: Number(roi) || 0,
          amortisation: Number(amortisation) || 0,
        }
      : null,
  }

  return (
    <div className="min-h-screen bg-[#eef2f5] pb-24 print:bg-white print:pb-0">
      <header className="print:hidden border-b border-slate-200 bg-white px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] shadow-sm md:px-8 md:pb-5 md:pt-6">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4">
          <Link href="/dashboard" aria-label="Zum Dashboard">
            <img src="/ema-logo.jpeg" alt="EMA Enterprise" className="h-16 w-auto object-contain md:h-20" />
          </Link>
          <PrintButton data={pdfData} />
        </div>
      </header>

      <div className="print:hidden mx-auto flex max-w-[1480px] px-4 py-4 md:px-8 md:py-5">
        <Link href="/expose" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-[#0B1633] shadow-sm">
          <ArrowLeft className="h-4 w-4" /> Zurück
        </Link>
      </div>

      <article className="memorandum-page mx-auto flex w-full max-w-[1180px] flex-col overflow-hidden bg-white shadow-[0_30px_80px_rgba(15,23,42,0.16)] print:shadow-none">
        <div className="flex items-center justify-between gap-4 px-8 py-5">
          <img src="/ema-logo.jpeg" alt="EMA Enterprise GmbH" className="h-16 w-auto object-contain" />
          <div className="text-right">
            <p className="text-xl font-extrabold tracking-[.08em] text-[#0B1633]">INVESTMENT MEMORANDUM</p>
            <p className="mt-2 text-sm font-extrabold uppercase tracking-[.16em] text-[#5CB800]">{presentation.typeLabel}</p>
          </div>
        </div>

        <section className="relative h-[355px] overflow-hidden bg-[#e8eef2]">
          <img src={presentation.heroImage} alt={presentation.typeLabel} className="absolute inset-0 h-full w-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-r from-white/92 via-white/42 to-transparent" />
          <div className="relative flex h-full flex-col justify-end px-8 pb-8">
            <h1 className="max-w-4xl text-5xl font-extrabold tracking-[-.045em] text-[#0B1633]">{String(project.project_name)}</h1>
            <p className="mt-3 text-sm font-extrabold uppercase tracking-[.18em] text-[#0B1633]">Projekt-Nr. <span className="text-[#5CB800]">{String(project.project_number || '—')}</span></p>
            <div className="mt-5 flex flex-wrap gap-4 text-sm font-bold text-[#0B1633]">
              <span className="inline-flex items-center gap-2"><MapPin className="h-5 w-5" />{location}</span>
              <span className="inline-flex items-center gap-2"><CalendarDays className="h-5 w-5" />{dateLabel}</span>
            </div>
          </div>
        </section>

        <section className="px-8 py-7">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {presentation.metrics.slice(0, 6).map((metric, index) => {
              const Icon = index === 0 ? Zap : index === 1 ? Euro : index === 2 ? Building2 : ClipboardList
              return (
                <div key={`${metric.label}-${index}`} className="rounded-[1.1rem] border border-slate-200 bg-white px-3 py-4 text-center shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
                  <Icon className="mx-auto h-7 w-7 text-[#4DAA00]" />
                  <p className="mt-2 text-[9px] font-extrabold uppercase tracking-[.11em] text-slate-500">{metric.label}</p>
                  <p className="mt-1 text-lg font-extrabold leading-tight text-[#0B1633]">{metric.value}</p>
                </div>
              )
            })}
          </div>

          <div className="mt-8 grid gap-8 md:grid-cols-2">
            <section className="md:border-r md:border-slate-200 md:pr-7">
              <h2 className="text-lg font-extrabold uppercase tracking-[.08em] text-[#0B1633]">Executive Summary</h2>
              <div className="mt-2 h-1 w-9 bg-[#5CB800]" />
              <p className="mt-5 text-sm leading-7 text-slate-700">{presentation.summary}</p>
            </section>

            <section>
              <h2 className="text-lg font-extrabold uppercase tracking-[.08em] text-[#0B1633]">Projektprofil</h2>
              <div className="mt-2 h-1 w-9 bg-[#5CB800]" />
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                {presentation.profile.map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-3 text-sm last:border-b-0">
                    <span className="text-slate-600">{row.label}</span>
                    <span className="text-right font-extrabold text-[#0B1633]">{row.value}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="mt-8 grid gap-8 md:grid-cols-2">
            <section>
              <h2 className="text-lg font-extrabold uppercase tracking-[.08em] text-[#0B1633]">{presentation.showPvEconomics ? 'Wirtschaftliche Kennzahlen' : 'Projektkennzahlen'}</h2>
              <div className="mt-2 h-1 w-9 bg-[#5CB800]" />
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                {(presentation.showPvEconomics
                  ? [
                      ['Jahresproduktion', annualYield ? `${formatNumber(annualYield)} kWh` : 'Noch offen'],
                      ['Jahreserlös', annualRevenue > 0 ? formatMoney(annualRevenue) : 'Noch offen'],
                      ['Kaufpreis', formatMoney(purchasePrice)],
                      ['Vergütung', tariffDisplay(tariff)],
                      ['Rendite p.a.', roi ? `${formatNumber(roi, 2)} %` : 'Noch offen'],
                      ['Amortisation', amortisation ? `${formatNumber(amortisation, 1)} Jahre` : 'Noch offen'],
                    ]
                  : presentation.metrics.map((metric) => [metric.label, metric.value])
                ).map(([label, value]) => (
                  <div key={String(label)} className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-3 text-sm last:border-b-0">
                    <span className="text-slate-600">{label}</span>
                    <span className="text-right font-extrabold text-[#0B1633]">{value}</span>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-lg font-extrabold uppercase tracking-[.08em] text-[#0B1633]">Investment Highlights</h2>
              <div className="mt-2 h-1 w-9 bg-[#5CB800]" />
              <div className="mt-4 rounded-[1.2rem] border border-[#DDECCB] px-5 py-4">
                <div className="space-y-4">
                  {(presentation.highlights.length ? presentation.highlights : ['Projektunterlagen und Kennzahlen werden laufend ergänzt.']).slice(0, 6).map((item) => (
                    <div key={item} className="flex items-start gap-3 text-sm text-slate-700">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#5CB800]" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </section>

        <footer className="mt-auto grid grid-cols-1 gap-5 border-t border-slate-300 px-8 py-5 text-xs text-[#0B1633] sm:grid-cols-4">
          <img src="/ema-logo.jpeg" alt="EMA Enterprise GmbH" className="h-14 w-auto object-contain" />
          <div className="leading-5"><p className="font-bold">EMA Enterprise GmbH</p><p>Gabriel-von-Seidl-Str. 56</p><p>67550 Worms, Germany</p></div>
          <div className="space-y-2"><p className="flex items-center gap-2"><Globe2 className="h-4 w-4" />www.ema-enterprise.de</p><p className="flex items-center gap-2"><Mail className="h-4 w-4" />info@ema-enterprise.de</p></div>
          <div className="border-l border-slate-300 pl-5 leading-5"><p>Stand: {dateLabel}</p><p>Version 4.0</p></div>
        </footer>
      </article>
    </div>
  )
}
