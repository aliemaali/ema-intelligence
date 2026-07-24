import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  Building2,
  CalendarDays,
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
    const value = source[key]
    if (value !== null && value !== undefined && value !== '') return value
  }
  return null
}

function stageLabel(raw: unknown) {
  if (raw === 'rtb') return 'RTB'
  return 'In Planung'
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

function Chart({ purchasePrice, annualRevenue, years = 20 }: { purchasePrice: number; annualRevenue: number; years?: number }) {
  const values = Array.from({ length: years + 1 }, (_, year) => ({
    year,
    cashflow: year === 0 ? -purchasePrice : annualRevenue,
    cumulative: -purchasePrice + annualRevenue * year,
  }))
  const maxAbs = Math.max(purchasePrice, annualRevenue * years - purchasePrice, annualRevenue, 1)
  const zeroY = 58
  const chartHeight = 48
  const chartWidth = 100
  const cumulativePoints = values.map((item, index) => {
    const x = (index / years) * chartWidth
    const y = zeroY - (item.cumulative / maxAbs) * chartHeight
    return `${x},${Math.max(6, Math.min(108, y))}`
  }).join(' ')

  return (
    <div className="relative h-40 overflow-hidden rounded-2xl border border-slate-200 bg-white px-3 pb-3 pt-6">
      <svg viewBox="0 0 100 112" className="h-full w-full" preserveAspectRatio="none" aria-label="Cashflow und Amortisation">
        {[18, 38, 58, 78, 98].map((y) => <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#e5e7eb" strokeWidth="0.6" />)}
        {values.map((item, index) => {
          const x = (index / years) * 100
          const barHeight = Math.max(2, Math.abs(item.cashflow / maxAbs) * 44)
          const y = item.cashflow >= 0 ? zeroY - barHeight : zeroY
          return <rect key={item.year} x={Math.max(0, x - 1.2)} y={y} width="2.4" height={barHeight} rx="0.7" fill="#5CB800" opacity={item.year === 0 ? 0.45 : 0.9} />
        })}
        <line x1="0" y1={zeroY} x2="100" y2={zeroY} stroke="#94a3b8" strokeWidth="0.9" />
        <polyline points={cumulativePoints} fill="none" stroke="#1F2A44" strokeWidth="1.7" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="absolute left-3 top-2 flex items-center gap-4 text-[9px] font-bold text-slate-500">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#5CB800]" />Jährlicher Cashflow</span>
        <span className="inline-flex items-center gap-1"><span className="h-0.5 w-4 bg-[#1F2A44]" />Kumuliert</span>
      </div>
      <div className="absolute inset-x-3 bottom-1 flex justify-between text-[8px] text-slate-400"><span>0</span><span>5</span><span>10</span><span>15</span><span>20 Jahre</span></div>
    </div>
  )
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
  const leaseTerm = firstValue(project, ['lease_term_years', 'lease_years', 'pachtlaufzeit'])
  const storedAnnualYield = firstValue(project, ['annual_yield_kwh', 'annual_energy_kwh', 'annual_production_kwh'])
  const storedAmortisation = firstValue(project, ['amortisation_years', 'amortization_years', 'payback_years'])
  const pv = Number(pvKwp)
  const yieldPerKwp = Number(specificYield)
  const price = Number(purchasePrice)
  const tariffEur = tariffEuroPerKwh(tariff)
  const calculatedAnnualYield = Number.isFinite(pv) && Number.isFinite(yieldPerKwp) ? pv * yieldPerKwp : null
  const annualYield = Number(storedAnnualYield ?? calculatedAnnualYield ?? 0)
  const annualRevenue = annualYield * (tariffEur ?? 0)
  const amortisation = Number(storedAmortisation ?? (price > 0 && annualRevenue > 0 ? price / annualRevenue : 0))
  const roi = price > 0 && annualRevenue > 0 ? (annualRevenue / price) * 100 : 0
  const presentation = getExposePresentation(
    { ...project, purchase_price: purchasePrice, pv_kwp: pvKwp, specific_yield: specificYield, feed_in_tariff: tariff },
    location,
    { number: formatNumber, money: formatMoney, tariff: tariffDisplay },
  )
  const status = stageLabel(project.project_stage)
  const heroImage = String(project.project_image_url || presentation.heroImage)

  const profile = [
    ['Projekttyp', presentation.typeLabel],
    ['PV-Leistung', pvKwp ? `${formatNumber(pvKwp, 2)} kWp` : 'Noch offen'],
    ['Spezifischer Ertrag', specificYield ? `${formatNumber(specificYield)} kWh/kWp` : 'Noch offen'],
    ['Vergütung', tariffDisplay(tariff)],
    ['Einspeiseart', String(project.feed_in_type || project.einspeiseart || 'Noch offen')],
    ['Netzanschluss', project.grid_connection_status || project.grid_connection_confirmed ? 'Zusage vorhanden' : 'Noch offen'],
    ['Pachtdauer', leaseTerm ? `${formatNumber(leaseTerm)} Jahre` : 'Noch offen'],
    ['Projektstand', status],
    ['Kaufpreis', price > 0 ? formatMoney(price) : 'Noch offen'],
  ]

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
    metrics: [
      { label: 'Projekttyp', value: presentation.typeLabel },
      { label: 'PV-Leistung', value: pvKwp ? `${formatNumber(pvKwp, 2)} kWp` : 'Noch offen' },
      { label: 'Kaufpreis', value: price > 0 ? formatMoney(price) : 'Noch offen' },
      { label: 'Spez. Ertrag', value: specificYield ? `${formatNumber(specificYield)} kWh/kWp` : 'Noch offen' },
      { label: 'Vergütung', value: tariffDisplay(tariff) },
      { label: 'Pachtdauer', value: leaseTerm ? `${formatNumber(leaseTerm)} Jahre` : 'Noch offen' },
    ],
    profile: profile.map(([label, value]) => ({ label, value })),
    highlights: presentation.highlights,
    heroImage,
    showPvEconomics: presentation.showPvEconomics,
    pvEconomics: presentation.showPvEconomics ? {
      annualYield,
      annualRevenue,
      purchasePrice: price,
      tariffEurKwh: tariffEur ?? 0,
      roi,
      amortisation,
    } : null,
  }

  return (
    <div className="min-h-screen bg-[#eef2f5] pb-16 print:bg-white print:pb-0">
      <header className="border-b border-slate-200 bg-white px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] shadow-sm print:hidden md:px-8 md:py-4">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4">
          <Link href="/dashboard" className="shrink-0"><img src="/ema-logo.jpeg" alt="EMA Enterprise" className="h-14 w-auto sm:h-16" /></Link>
          <PrintButton data={pdfData} />
        </div>
      </header>

      <div className="mx-auto flex max-w-[1180px] px-4 py-4 print:hidden md:px-8">
        <Link href="/expose" className="inline-flex items-center gap-2 rounded-2xl border bg-white px-4 py-3 text-sm font-extrabold"><ArrowLeft className="h-4 w-4" /> Zurück</Link>
      </div>

      <article className="mx-auto w-full max-w-[794px] overflow-hidden bg-white shadow-[0_30px_80px_rgba(15,23,42,0.16)] print:shadow-none">
        <div className="flex items-center justify-between px-8 py-5">
          <img src="/ema-logo.jpeg" alt="EMA Enterprise GmbH" className="h-14 w-auto" />
          <div className="text-right"><p className="text-xl font-extrabold tracking-[.05em] text-[#0B1633]">INVESTMENT<br />MEMORANDUM</p><p className="mt-2 text-xs font-extrabold uppercase tracking-[.16em] text-[#5CB800]">{presentation.typeLabel}</p></div>
        </div>

        <section className="relative h-[330px] overflow-hidden bg-[#e8eef2]">
          <img src={heroImage} alt={presentation.typeLabel} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/75 to-transparent" />
          <div className="relative flex h-full max-w-[54%] flex-col justify-end px-8 pb-8">
            <p className="text-5xl font-extrabold leading-[.95] tracking-[-.045em] text-[#0B1633]">INVESTMENT<br />MEMORANDUM</p>
            <p className="mt-4 text-sm font-extrabold uppercase tracking-[.18em] text-[#5CB800]">{presentation.typeLabel}</p>
            <div className="my-5 h-1 w-9 bg-[#5CB800]" />
            <h1 className="text-4xl font-extrabold tracking-[-.045em] text-[#0B1633]">{String(project.project_name)}</h1>
            <p className="mt-3 text-xs font-extrabold uppercase tracking-[.18em] text-[#0B1633]">Projekt-Nr. <span className="text-[#5CB800]">{String(project.project_number || '—')}</span></p>
            <div className="mt-4 space-y-2 text-sm font-bold text-[#0B1633]">
              <span className="flex items-center gap-2"><MapPin className="h-4 w-4" />{location}</span>
              <span className="flex items-center gap-2">{countryFlag ? <img src={countryFlag} alt={country} className="h-4 w-6 rounded-sm object-cover shadow" /> : <Globe2 className="h-4 w-4" />}{country}</span>
              <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4" />{dateLabel}</span>
            </div>
          </div>
        </section>

        <section className="px-8 py-6">
          <div className="grid grid-cols-3 gap-3">
            {pdfData.metrics.map((metric, index) => {
              const Icon = index === 0 ? Building2 : index === 1 ? Zap : index === 2 ? Euro : index === 3 ? TrendingUp : Building2
              return <div key={metric.label} className="rounded-2xl border border-slate-200 p-4"><Icon className="h-6 w-6 text-[#5CB800]" /><p className="mt-3 text-[9px] font-extrabold uppercase tracking-[.11em] text-slate-500">{metric.label}</p><p className="mt-1 text-base font-extrabold leading-tight text-[#0B1633]">{metric.value}</p></div>
            })}
          </div>

          <div className="mt-7 grid grid-cols-[0.9fr_1.1fr] gap-7">
            <div className="space-y-7">
              <section><h2 className="text-sm font-extrabold uppercase tracking-[.08em] text-[#0B1633]">Executive Summary</h2><div className="mt-2 h-1 w-8 bg-[#5CB800]" /><p className="mt-4 text-xs leading-5 text-slate-700">{presentation.summary}</p></section>
              <section><h2 className="text-sm font-extrabold uppercase tracking-[.08em] text-[#0B1633]">Standort</h2><div className="mt-2 h-1 w-8 bg-[#5CB800]" /><div className="relative mt-4 h-44 overflow-hidden rounded-2xl border bg-[#eef3e8]">
                <div className="absolute inset-0 opacity-80" style={{ backgroundImage: 'linear-gradient(32deg, transparent 47%, #cbd5c0 48%, #cbd5c0 52%, transparent 53%), linear-gradient(-24deg, transparent 47%, #d8dfcf 48%, #d8dfcf 52%, transparent 53%)', backgroundSize: '54px 54px' }} />
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-lg"><MapPin className="h-7 w-7 text-[#5CB800]" /></span></div>
                <div className="absolute inset-x-3 bottom-3 rounded-xl bg-white/95 p-3 text-xs shadow"><p className="font-extrabold text-[#0B1633]">{location}</p><p className="mt-1 text-slate-500">{country}</p></div>
              </div></section>
            </div>

            <section><h2 className="text-sm font-extrabold uppercase tracking-[.08em] text-[#0B1633]">Projektprofil</h2><div className="mt-2 h-1 w-8 bg-[#5CB800]" /><div className="mt-4 overflow-hidden rounded-2xl border">{profile.map(([label, value]) => <div key={label} className="flex justify-between gap-4 border-b px-4 py-2.5 text-xs last:border-b-0"><span className="text-slate-600">{label}</span><span className="text-right font-extrabold text-[#0B1633]">{value}</span></div>)}</div></section>
          </div>

          <section className="mt-7 rounded-2xl border p-5"><div className="grid grid-cols-[0.85fr_1.45fr] gap-6"><div><h2 className="text-sm font-extrabold uppercase tracking-[.08em] text-[#0B1633]">Wirtschaftliche Kennzahlen</h2><div className="mt-2 h-1 w-8 bg-[#5CB800]" /><div className="mt-5 grid grid-cols-3 gap-3 text-center"><div><p className="text-[9px] font-extrabold uppercase text-slate-500">Jahreserlös</p><p className="mt-2 text-lg font-extrabold text-[#5CB800]">{annualRevenue > 0 ? formatMoney(annualRevenue) : 'Noch offen'}</p></div><div><p className="text-[9px] font-extrabold uppercase text-slate-500">Amortisation</p><p className="mt-2 text-lg font-extrabold text-[#5CB800]">{amortisation > 0 ? `${formatNumber(amortisation, 1)} Jahre` : 'Noch offen'}</p></div><div><p className="text-[9px] font-extrabold uppercase text-slate-500">Rendite</p><p className="mt-2 text-lg font-extrabold text-[#5CB800]">{roi > 0 ? `${formatNumber(roi, 1)} %` : 'Noch offen'}</p></div></div></div><div><h2 className="text-sm font-extrabold uppercase tracking-[.08em] text-[#0B1633]">Cashflow & Amortisation</h2><div className="mt-2 h-1 w-8 bg-[#5CB800]" /><div className="mt-4"><Chart purchasePrice={price} annualRevenue={annualRevenue} /></div></div></div></section>
        </section>

        <footer className="grid grid-cols-[auto_1fr_1fr] items-center gap-5 bg-[#0B1633] px-8 py-5 text-[10px] text-white"><img src="/ema-logo.jpeg" alt="EMA Enterprise GmbH" className="h-12 w-auto rounded bg-white p-1" /><div><p className="font-bold">EMA Enterprise GmbH</p><p>Gabriel-von-Seidl-Str. 56 · 67550 Worms</p></div><div className="text-right"><p className="flex items-center justify-end gap-1"><Globe2 className="h-3 w-3" />www.ema-enterprise.de</p><p className="flex items-center justify-end gap-1"><Mail className="h-3 w-3" />info@ema-enterprise.de</p></div></footer>
      </article>
    </div>
  )
}
