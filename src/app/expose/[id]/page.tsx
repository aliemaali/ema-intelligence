import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  BarChart3,
  BatteryCharging,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Euro,
  Gauge,
  Globe2,
  Mail,
  MapPin,
  Network,
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
  return Number.isFinite(number)
    ? new Intl.NumberFormat('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(number)
    : '—'
}

function formatMoney(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number)
    ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(number)
    : '—'
}

function tariffDisplay(raw: unknown) {
  const number = Number(raw)
  if (!Number.isFinite(number) || number <= 0) return ''
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
  return raw ? 'In Planung' : ''
}

function metricIcon(label: string) {
  if (label.includes('Amortisation')) return Clock3
  if (label.includes('Kaufpreis') || label.includes('Investitionsvolumen')) return Euro
  if (label.includes('Vergütung')) return Zap
  if (label.includes('Kapazität')) return BatteryCharging
  if (label.includes('Netzanschluss')) return Network
  if (label.includes('Ertrag')) return Gauge
  if (label.includes('Leistung')) return BarChart3
  return Building2
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

  const emaAi = project.ai_score_details && typeof project.ai_score_details === 'object'
    ? (project.ai_score_details as Record<string, unknown>).ema_ai ?? {}
    : {}
  const optionalData: Record<string, unknown>[] = []

  for (const table of ['project_financials', 'project_economics', 'capex_calculations']) {
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
  const calculatedAnnualYield = Number.isFinite(pv) && pv > 0 && Number.isFinite(yieldPerKwp) && yieldPerKwp > 0
    ? pv * yieldPerKwp
    : null
  const annualYield = storedAnnualYield ?? calculatedAnnualYield
  const annualRevenue = Number(annualYield) > 0 && tariffEur ? Number(annualYield) * tariffEur : null
  const amortisation = storedAmortisation ?? (price > 0 && annualRevenue ? price / annualRevenue : null)
  const roi = price > 0 && annualRevenue ? (annualRevenue / price) * 100 : null

  const presentation = getExposePresentation({
    ...project,
    purchase_price: purchasePrice,
    pv_kwp: pvKwp,
    specific_yield: specificYield,
    feed_in_tariff: tariff,
    amortisation_years: amortisation,
  }, location, { number: formatNumber, money: formatMoney, tariff: tariffDisplay })

  const status = stageLabel(project.project_stage)
  const economicCards = [
    annualYield ? { label: 'Jahresproduktion', value: `${formatNumber(annualYield)} kWh` } : null,
    annualRevenue ? { label: 'Jahreserlös', value: formatMoney(annualRevenue) } : null,
    roi ? { label: 'Rendite p.a.', value: `${formatNumber(roi, 2)} %` } : null,
    amortisation ? { label: 'Amortisation', value: `${formatNumber(amortisation, 1)} Jahre` } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>

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
    showPvEconomics: presentation.showPvEconomics && Boolean(economicCards.length),
    pvEconomics: presentation.showPvEconomics && economicCards.length ? {
      annualYield: Number(annualYield) || 0,
      annualRevenue: Number(annualRevenue) || 0,
      purchasePrice: Number(price) || 0,
      tariffEurKwh: tariffEur ?? 0,
      roi: Number(roi) || 0,
      amortisation: Number(amortisation) || 0,
    } : null,
  }

  return (
    <div className="min-h-screen bg-[#e9eef2] pb-16 print:bg-white print:pb-0">
      <header className="print:hidden border-b border-slate-200 bg-white px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] shadow-sm md:px-8 md:py-4">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4">
          <Link href="/dashboard" className="shrink-0">
            <img src="/ema-logo.jpeg" alt="EMA Enterprise" className="h-14 w-auto sm:h-16" />
          </Link>
          <PrintButton data={pdfData} />
        </div>
      </header>

      <div className="print:hidden mx-auto flex max-w-[1180px] px-4 py-4">
        <Link href="/expose" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-[#0B1633] shadow-sm">
          <ArrowLeft className="h-4 w-4" /> Zurück
        </Link>
      </div>

      <article className="memorandum-page mx-auto w-full max-w-[1180px] overflow-hidden rounded-[28px] bg-white shadow-[0_35px_100px_rgba(15,23,42,0.18)] print:rounded-none print:shadow-none">
        <div className="flex items-center justify-between border-b border-slate-100 px-8 py-5">
          <img src="/ema-logo.jpeg" alt="EMA Enterprise GmbH" className="h-14 w-auto" />
          <div className="text-right">
            <p className="text-xl font-black tracking-[.14em] text-[#0B1633]">INVESTMENT MEMORANDUM</p>
            <p className="mt-1 text-[11px] font-extrabold uppercase tracking-[.22em] text-[#5CB800]">Institutional Project Overview</p>
          </div>
        </div>

        <section className="relative min-h-[330px] overflow-hidden bg-[#0B1633]">
          <img src={presentation.heroImage} alt={presentation.typeLabel} className="absolute inset-0 h-full w-full object-cover opacity-80" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#071225] via-[#071225]/88 to-[#071225]/10" />
          <div className="relative flex min-h-[330px] max-w-3xl flex-col justify-end px-8 py-9 text-white md:px-12">
            <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-extrabold uppercase tracking-[.16em] backdrop-blur">
              <Building2 className="h-4 w-4 text-[#83d22a]" /> {presentation.typeLabel}
            </div>
            <h1 className="text-4xl font-black tracking-[-.05em] md:text-6xl">{String(project.project_name)}</h1>
            <p className="mt-4 text-xs font-extrabold uppercase tracking-[.22em] text-[#9ce54d]">Projekt-Nr. {String(project.project_number || '—')}</p>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm font-bold text-white/90">
              <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-[#9ce54d]" />{location}</span>
              <span className="inline-flex items-center gap-2">{countryFlag ? <img src={countryFlag} alt={country} className="h-4 w-6 rounded-sm object-cover" /> : <Globe2 className="h-4 w-4 text-[#9ce54d]" />}{country}</span>
              <span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[#9ce54d]" />{dateLabel}</span>
            </div>
          </div>
        </section>

        <section className="px-8 py-8 md:px-12">
          {presentation.metrics.length > 0 && (
            <div className={`grid gap-3 ${presentation.metrics.length >= 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
              {presentation.metrics.slice(0, 5).map((metric) => {
                const Icon = metricIcon(metric.label)
                const emphasis = metric.label === 'Amortisation'
                return (
                  <div key={metric.label} className={`rounded-2xl border p-5 ${emphasis ? 'border-[#5CB800] bg-[#f4fbe9] shadow-[0_12px_30px_rgba(92,184,0,0.13)]' : 'border-slate-200 bg-white'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className={`rounded-xl p-2.5 ${emphasis ? 'bg-[#5CB800] text-white' : 'bg-slate-100 text-[#0B1633]'}`}><Icon className="h-5 w-5" /></div>
                      {emphasis && <span className="rounded-full bg-[#0B1633] px-2.5 py-1 text-[9px] font-black uppercase tracking-[.14em] text-white">Key Metric</span>}
                    </div>
                    <p className="mt-5 text-[10px] font-black uppercase tracking-[.16em] text-slate-500">{metric.label}</p>
                    <p className="mt-2 text-2xl font-black tracking-[-.035em] text-[#0B1633]">{metric.value}</p>
                  </div>
                )
              })}
            </div>
          )}

          <div className="mt-9 grid gap-8 lg:grid-cols-[1.05fr_.95fr]">
            <section className="rounded-3xl bg-[#0B1633] p-7 text-white">
              <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#9ce54d]">Executive Summary</p>
              <h2 className="mt-3 text-2xl font-black tracking-[-.035em]">Investment Case auf einen Blick</h2>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-white/78">{presentation.summary}</p>
              {presentation.highlights.length > 0 && (
                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  {presentation.highlights.slice(0, 4).map((item) => (
                    <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/90">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#9ce54d]" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {presentation.profile.length > 0 && (
              <section>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#5CB800]">Project Profile</p>
                    <h2 className="mt-2 text-2xl font-black tracking-[-.035em] text-[#0B1633]">Projektprofil</h2>
                  </div>
                </div>
                <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white">
                  {presentation.profile.map((row) => (
                    <div key={row.label} className="grid grid-cols-[1fr_auto] gap-5 border-b border-slate-100 px-5 py-4 text-sm last:border-b-0">
                      <span className="font-semibold text-slate-500">{row.label}</span>
                      <span className="max-w-[240px] text-right font-black text-[#0B1633]">{row.value}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {economicCards.length > 0 && (
            <section className="mt-9 rounded-3xl border border-slate-200 bg-slate-50 p-7">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#5CB800]">Economics</p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-.035em] text-[#0B1633]">Wirtschaftlichkeit</h2>
                </div>
                {amortisation && (
                  <div className="rounded-2xl bg-[#5CB800] px-5 py-3 text-white shadow-lg shadow-[#5CB800]/20">
                    <p className="text-[9px] font-black uppercase tracking-[.18em] text-white/75">Amortisation</p>
                    <p className="mt-1 text-2xl font-black">{formatNumber(amortisation, 1)} Jahre</p>
                  </div>
                )}
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {economicCards.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5">
                    <p className="text-[9px] font-black uppercase tracking-[.15em] text-slate-500">{item.label}</p>
                    <p className="mt-2 text-xl font-black text-[#0B1633]">{item.value}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </section>

        <footer className="grid gap-4 border-t border-slate-200 bg-[#f8fafb] px-8 py-5 text-[10px] text-[#0B1633] sm:grid-cols-4 md:px-12">
          <img src="/ema-logo.jpeg" alt="EMA Enterprise GmbH" className="h-10 w-auto" />
          <div><p className="font-black">EMA Enterprise GmbH</p><p>Gabriel-von-Seidl-Str. 56 · 67550 Worms</p></div>
          <div><p className="flex items-center gap-1"><Globe2 className="h-3 w-3" />www.ema-enterprise.de</p><p className="flex items-center gap-1"><Mail className="h-3 w-3" />info@ema-enterprise.de</p></div>
          <div className="sm:text-right"><p>Stand: {dateLabel}</p>{status && <p>Projektstatus: {status}</p>}</div>
        </footer>
      </article>
    </div>
  )
}
