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
  TrendingUp,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PrintButton } from '@/components/expose/PrintButton'
import { getExposePresentation } from '@/lib/expose/projectPresentation'

export const dynamic = 'force-dynamic'

const COUNTRY_CODES: Record<string, string> = {
  Deutschland: 'de', Germany: 'de', Italien: 'it', Italy: 'it', Türkei: 'tr', Turkey: 'tr',
  Österreich: 'at', Austria: 'at', Schweiz: 'ch', Switzerland: 'ch', Frankreich: 'fr', France: 'fr',
  Spanien: 'es', Spain: 'es', Niederlande: 'nl', Netherlands: 'nl', Polen: 'pl', Poland: 'pl',
  Griechenland: 'gr', Greece: 'gr', Portugal: 'pt', Belgien: 'be', Belgium: 'be',
}

function flagUrl(country: string) {
  const code = COUNTRY_CODES[country]
  return code ? `https://flagcdn.com/w80/${code}.png` : null
}

function formatNumber(value: unknown, digits = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? new Intl.NumberFormat('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(number) : '—'
}

function formatMoney(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(number) : '—'
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

function stageLabel(raw: unknown) {
  if (raw === 'rtb') return 'RTB'
  if (raw === 'betrieb') return 'Im Betrieb'
  return 'In Planung'
}

async function loadProjectData(projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).eq('user_id', user.id).single()
  if (!project) return null
  const { data: deal } = await supabase.from('deals').select('*').eq('project_id', projectId).eq('user_id', user.id).eq('is_active', true).maybeSingle()
  const emaAi = project.ai_score_details && typeof project.ai_score_details === 'object' ? (project.ai_score_details as Record<string, unknown>).ema_ai ?? {} : {}
  const optionalData: Record<string, unknown>[] = []
  for (const table of ['project_financials', 'project_economics', 'capex_calculations']) {
    const { data } = await (supabase as any).from(table).select('*').eq('project_id', projectId).order('updated_at', { ascending: false }).limit(1).maybeSingle()
    if (data) optionalData.push(data)
  }
  return Object.assign({}, project, deal ?? {}, emaAi, ...optionalData) as Record<string, unknown>
}

export default async function InvestmentMemorandumPage({ params }: { params: { id: string } }) {
  const project = await loadProjectData(params.id)
  if (!project) notFound()

  const country = String(project.location_country || 'Deutschland')
  const countryFlag = flagUrl(country)
  const location = [project.location_city, project.location_state].filter(Boolean).join(', ') || country
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
  const amortisation = storedAmortisation ?? (price > 0 && annualRevenue > 0 ? price / annualRevenue : null)
  const roi = price > 0 && annualRevenue > 0 ? (annualRevenue / price) * 100 : null
  const presentation = getExposePresentation({ ...project, purchase_price: purchasePrice, pv_kwp: pvKwp, specific_yield: specificYield, feed_in_tariff: tariff }, location, { number: formatNumber, money: formatMoney, tariff: tariffDisplay })
  const status = stageLabel(project.project_stage)

  const pdfData = {
    projectName: String(project.project_name || 'Projekt'),
    projectNumber: String(project.project_number || '—'),
    projectType: String(project.project_type || ''),
    typeLabel: presentation.typeLabel,
    location,
    country,
    countryFlag: countryFlag || '',
    dateLabel,
    status,
    summary: presentation.summary,
    metrics: presentation.metrics,
    profile: presentation.profile,
    highlights: presentation.highlights,
    heroImage: presentation.heroImage,
    showPvEconomics: presentation.showPvEconomics,
    pvEconomics: presentation.showPvEconomics ? {
      annualYield: Number(annualYield) || 0,
      annualRevenue: Number(annualRevenue) || 0,
      purchasePrice: Number(price) || 0,
      tariffEurKwh: tariffEur ?? 0,
      roi: Number(roi) || 0,
      amortisation: Number(amortisation) || 0,
    } : null,
  }

  const economyBars = [
    { label: 'Rendite p.a.', value: roi ? `${formatNumber(roi, 2)} %` : 'Noch offen', width: Math.min(100, Math.max(0, Number(roi) * 7)) },
    { label: 'Amortisation', value: amortisation ? `${formatNumber(amortisation, 1)} Jahre` : 'Noch offen', width: amortisation ? Math.min(100, Math.max(8, 100 - Number(amortisation) * 4)) : 0 },
    { label: 'Jahreserlös', value: annualRevenue > 0 ? formatMoney(annualRevenue) : 'Noch offen', width: price > 0 ? Math.min(100, (annualRevenue / price) * 700) : 0 },
  ]

  return (
    <div className="min-h-screen bg-[#eef2f5] pb-16 print:bg-white print:pb-0">
      <header className="print:hidden border-b border-slate-200 bg-white px-4 py-4 shadow-sm md:px-8"><div className="mx-auto flex max-w-[1480px] items-center justify-between"><Link href="/dashboard"><img src="/ema-logo.jpeg" alt="EMA Enterprise" className="h-16 w-auto" /></Link><PrintButton data={pdfData} /></div></header>
      <div className="print:hidden mx-auto flex max-w-[1480px] px-4 py-4 md:px-8"><Link href="/expose" className="inline-flex items-center gap-2 rounded-2xl border bg-white px-4 py-3 text-sm font-extrabold"><ArrowLeft className="h-4 w-4" /> Zurück</Link></div>

      <article className="memorandum-page mx-auto w-full max-w-[1180px] overflow-hidden bg-white shadow-[0_30px_80px_rgba(15,23,42,0.16)] print:shadow-none">
        <div className="flex items-center justify-between px-7 py-3"><img src="/ema-logo.jpeg" alt="EMA Enterprise GmbH" className="h-12 w-auto" /><div className="text-right"><p className="text-lg font-extrabold tracking-[.08em] text-[#0B1633]">INVESTMENT MEMORANDUM</p><p className="mt-1 text-xs font-extrabold uppercase tracking-[.16em] text-[#5CB800]">{presentation.typeLabel}</p></div></div>

        <section className="relative h-[235px] overflow-hidden bg-[#e8eef2]">
          <img src={presentation.heroImage} alt={presentation.typeLabel} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/52 to-transparent" />
          <div className="relative flex h-full flex-col justify-end px-8 pb-6">
            <div className="mb-3 inline-flex w-fit items-center rounded-xl bg-[#5CB800] px-3 py-1.5 text-xs font-extrabold uppercase tracking-[.12em] text-white"><Building2 className="mr-2 h-4 w-4" />{presentation.typeLabel}</div>
            <h1 className="max-w-4xl text-4xl font-extrabold tracking-[-.045em] text-[#0B1633]">{String(project.project_name)}</h1>
            <p className="mt-2 text-xs font-extrabold uppercase tracking-[.18em] text-[#0B1633]">Projekt-Nr. <span className="text-[#5CB800]">{String(project.project_number || '—')}</span></p>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm font-bold text-[#0B1633]">
              <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4" />{location}</span>
              <span className="inline-flex items-center gap-2">{countryFlag ? <img src={countryFlag} alt={country} className="h-4 w-6 rounded-sm object-cover shadow" /> : <Globe2 className="h-4 w-4" />}{country}</span>
              <span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4" />{dateLabel}</span>
            </div>
          </div>
        </section>

        <section className="px-7 py-5">
          <div className="grid grid-cols-3 gap-2 lg:grid-cols-6">
            {presentation.metrics.slice(0, 6).map((metric, index) => {
              const Icon = index === 0 ? Building2 : index === 1 ? Zap : index === 2 ? Euro : ClipboardList
              return <div key={`${metric.label}-${index}`} className="rounded-xl border border-slate-200 px-2 py-3 text-center"><Icon className="mx-auto h-5 w-5 text-[#4DAA00]" /><p className="mt-1 text-[8px] font-extrabold uppercase tracking-[.1em] text-slate-500">{metric.label}</p><p className="mt-1 text-sm font-extrabold leading-tight text-[#0B1633]">{metric.value}</p></div>
            })}
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-[0.9fr_1.1fr_1fr]">
            <section><h2 className="text-sm font-extrabold uppercase tracking-[.08em] text-[#0B1633]">Executive Summary</h2><div className="mt-1 h-1 w-8 bg-[#5CB800]" /><p className="mt-3 text-xs leading-5 text-slate-700">{presentation.summary}</p></section>
            <section><h2 className="text-sm font-extrabold uppercase tracking-[.08em] text-[#0B1633]">Projektprofil</h2><div className="mt-1 h-1 w-8 bg-[#5CB800]" /><div className="mt-3 overflow-hidden rounded-xl border">{presentation.profile.slice(0, 5).map((row) => <div key={row.label} className="flex justify-between gap-3 border-b px-3 py-2 text-xs last:border-b-0"><span className="text-slate-600">{row.label}</span><span className="text-right font-extrabold text-[#0B1633]">{row.value}</span></div>)}</div></section>
            <section><h2 className="text-sm font-extrabold uppercase tracking-[.08em] text-[#0B1633]">Visuelle Wirtschaftlichkeit</h2><div className="mt-1 h-1 w-8 bg-[#5CB800]" /><div className="mt-3 space-y-3 rounded-xl border p-3">{presentation.showPvEconomics ? economyBars.map((item) => <div key={item.label}><div className="mb-1 flex justify-between text-[11px]"><span className="text-slate-600">{item.label}</span><strong className="text-[#0B1633]">{item.value}</strong></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#5CB800]" style={{ width: `${item.width}%` }} /></div></div>) : <p className="text-xs leading-5 text-slate-600">Wirtschaftliche Kennzahlen werden angezeigt, sobald Erlös- und Investitionsdaten vorliegen.</p>}</div></section>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <section><h2 className="text-sm font-extrabold uppercase tracking-[.08em] text-[#0B1633]">Wirtschaftliche Kennzahlen</h2><div className="mt-1 h-1 w-8 bg-[#5CB800]" /><div className="mt-3 grid grid-cols-2 gap-2">{[
              ['Jahresproduktion', annualYield ? `${formatNumber(annualYield)} kWh` : 'Noch offen'], ['Jahreserlös', annualRevenue > 0 ? formatMoney(annualRevenue) : 'Noch offen'], ['Rendite p.a.', roi ? `${formatNumber(roi, 2)} %` : 'Noch offen'], ['Amortisation', amortisation ? `${formatNumber(amortisation, 1)} Jahre` : 'Noch offen'],
            ].map(([label, value]) => <div key={label} className="rounded-lg bg-slate-50 p-2"><p className="text-[9px] uppercase text-slate-500">{label}</p><p className="mt-1 text-xs font-extrabold text-[#0B1633]">{value}</p></div>)}</div></section>
            <section><h2 className="text-sm font-extrabold uppercase tracking-[.08em] text-[#0B1633]">Investment Highlights</h2><div className="mt-1 h-1 w-8 bg-[#5CB800]" /><div className="mt-3 grid grid-cols-2 gap-2">{(presentation.highlights.length ? presentation.highlights : ['Projektunterlagen werden laufend ergänzt.']).slice(0, 4).map((item) => <div key={item} className="flex items-start gap-2 rounded-lg border border-[#DDECCB] p-2 text-[11px] text-slate-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#5CB800]" /><span>{item}</span></div>)}</div></section>
          </div>
        </section>

        <footer className="grid grid-cols-1 gap-3 border-t px-7 py-3 text-[10px] text-[#0B1633] sm:grid-cols-4"><img src="/ema-logo.jpeg" alt="EMA Enterprise GmbH" className="h-10 w-auto" /><div><p className="font-bold">EMA Enterprise GmbH</p><p>Gabriel-von-Seidl-Str. 56 · 67550 Worms</p></div><div><p className="flex items-center gap-1"><Globe2 className="h-3 w-3" />www.ema-enterprise.de</p><p className="flex items-center gap-1"><Mail className="h-3 w-3" />info@ema-enterprise.de</p></div><div className="text-right"><p>Stand: {dateLabel}</p><p>Projektstatus: {status}</p></div></footer>
      </article>
    </div>
  )
}