import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  BadgeEuro,
  BatteryCharging,
  Bell,
  CalendarDays,
  CheckCircle2,
  FileText,
  Gauge,
  MapPin,
  Search,
  ShieldCheck,
  SunMedium,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PrintButton } from '@/components/expose/PrintButton'

export const dynamic = 'force-dynamic'

function formatNumber(value: unknown, digits = 0) {
  const n = Number(value)
  return Number.isFinite(n)
    ? new Intl.NumberFormat('de-DE', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(n)
    : '—'
}

function formatMoney(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n)
    ? new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
      }).format(n)
    : '—'
}

function firstValue(source: any, keys: string[]) {
  for (const key of keys) {
    const current = source?.[key]
    if (current !== null && current !== undefined && current !== '') return current
  }
  return null
}

function typeLabel(type?: string | null) {
  if (type === 'pv_freiflaeche') return 'PV-Freiflächenanlage'
  if (type === 'pv_dach') return 'PV-Dachprojekt'
  if (type === 'bess') return 'Batteriespeicherprojekt'
  if (type === 'hybrid') return 'PV- & BESS-Hybridprojekt'
  return 'Energieinfrastrukturprojekt'
}

function tariffDisplay(raw: unknown) {
  const n = Number(raw)
  if (!Number.isFinite(n)) return 'Noch offen'
  if (n <= 1) return `${formatNumber(n, 3)} €/kWh`
  return `${formatNumber(n, 2)} ct/kWh`
}

function tariffEuroPerKwh(raw: unknown) {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return null
  return n <= 1 ? n : n / 100
}

async function loadProjectData(projectId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

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

  return Object.assign({}, project, deal ?? {}, ...optionalData)
}

export default async function InvestmentMemorandumPage({ params }: { params: { id: string } }) {
  const project: any = await loadProjectData(params.id)
  if (!project) notFound()

  const pvKwp = firstValue(project, ['pv_kwp', 'pv_mwp', 'capacity_kwp', 'capacity_mwp', 'plant_capacity_kwp', 'anlagenleistung_kwp'])
  const bessMwh = firstValue(project, ['bess_mwh', 'storage_capacity_mwh'])
  const purchasePrice = firstValue(project, ['purchase_price', 'total_purchase_price', 'deal_purchase_price', 'kaufpreis', 'purchase_price_eur'])
  const tariff = firstValue(project, [
    'feed_in_tariff',
    'feed_in_tariff_eur_kwh',
    'feed_in_tariff_ct_kwh',
    'tariff',
    'tariff_ct_kwh',
    'remuneration',
    'verguetung',
    'vergutung',
    'vergütung',
  ])
  const specificYield = firstValue(project, [
    'specific_yield',
    'specific_yield_kwh_kwp',
    'yield_kwh_kwp',
    'annual_specific_yield',
    'ertrag_kwh_kwp',
    'spezifischer_ertrag',
  ])
  const storedAnnualYield = firstValue(project, ['annual_yield_kwh', 'annual_energy_kwh', 'annual_production_kwh', 'jahresproduktion_kwh'])
  const storedAmortisation = firstValue(project, [
    'amortisation_years',
    'amortization_years',
    'payback_years',
    'payback_period_years',
    'amortisation',
  ])

  const pv = Number(pvKwp)
  const yieldPerKwp = Number(specificYield)
  const calculatedAnnualYield = Number.isFinite(pv) && Number.isFinite(yieldPerKwp) ? pv * yieldPerKwp : null
  const annualYield = storedAnnualYield ?? calculatedAnnualYield
  const annualRevenue = Number(annualYield) * (tariffEuroPerKwh(tariff) ?? 0)
  const calculatedAmortisation = Number(purchasePrice) > 0 && annualRevenue > 0 ? Number(purchasePrice) / annualRevenue : null
  const amortisation = storedAmortisation ?? calculatedAmortisation

  const location = [project.location_city, project.location_state].filter(Boolean).join(', ') || 'Deutschland'
  const isPv = project.project_type !== 'bess'
  const dateLabel = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(new Date())

  const metrics = [
    {
      icon: isPv ? Zap : BatteryCharging,
      label: isPv ? 'Installierte Leistung' : 'Speicherkapazität',
      value: isPv ? `${formatNumber(pvKwp, 2)} kWp` : `${formatNumber(bessMwh, 2)} MWh`,
    },
    { icon: BadgeEuro, label: 'Kaufpreis', value: formatMoney(purchasePrice) },
    {
      icon: SunMedium,
      label: 'Spezifischer Ertrag',
      value: specificYield ? `${formatNumber(specificYield)} kWh/kWp` : 'Noch offen',
    },
    { icon: Gauge, label: 'Vergütung', value: tariffDisplay(tariff) },
    {
      icon: CalendarDays,
      label: 'Amortisation',
      value: amortisation ? `${formatNumber(amortisation, 1)} Jahre` : 'Noch offen',
    },
  ]

  return (
    <div className="min-h-screen bg-[#eef2f5] pb-28 print:bg-white print:pb-0">
      <header className="print:hidden border-b border-slate-200 bg-white px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] shadow-sm md:px-8 md:pb-5 md:pt-6">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4">
          <Link href="/dashboard" aria-label="Zum Dashboard">
            <img src="/ema-logo.jpeg" alt="EMA Enterprise" className="h-16 w-auto object-contain md:h-20" />
          </Link>
          <div className="flex items-center gap-2">
            <button className="mobile-header-action hidden sm:flex" type="button" aria-label="Suche"><Search className="h-5 w-5" /></button>
            <Link href="/calendar" className="mobile-header-action" aria-label="Kalender"><CalendarDays className="h-5 w-5" /></Link>
            <button className="mobile-header-action relative" type="button" aria-label="Benachrichtigungen"><Bell className="h-5 w-5" /><span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#5CB800]" /></button>
          </div>
        </div>
      </header>

      <div className="print:hidden mx-auto flex max-w-[1480px] flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-8 md:py-5">
        <Link href="/expose" className="inline-flex w-fit items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-[#0B1633] shadow-sm"><ArrowLeft className="h-4 w-4" /> Zurück</Link>
        <PrintButton />
      </div>

      <article className="mx-auto w-full max-w-[1180px] overflow-hidden bg-white shadow-[0_30px_80px_rgba(15,23,42,0.16)] print:max-w-none print:shadow-none">
        <section className="relative overflow-hidden bg-[#07142F] text-white print:break-after-page">
          <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-[#07142F] px-5 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] md:px-10 md:py-5 print:pt-5">
            <div className="text-lg font-black tracking-[-.04em] md:text-2xl">EMA<span className="text-[#78D400]">I</span><span className="ml-2 text-[10px] font-extrabold tracking-[.2em] text-white/70 md:text-xs">INTELLIGENCE</span></div>
            <div className="flex items-center gap-3 text-xs font-bold text-white/80 md:gap-5 md:text-sm">
              <span className="hidden items-center gap-2 sm:flex"><CalendarDays className="h-4 w-4" /> {dateLabel}</span>
              <span className="rounded-full border border-white/20 px-3 py-2 text-[#87D33B]">Vertraulich</span>
            </div>
          </div>

          <div className="relative min-h-[560px] md:min-h-[620px]">
            <img src="/hero-dashboard.png" alt="Photovoltaik-Freiflächenanlage aus der Luft" className="absolute inset-0 h-full w-full object-cover object-center" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#07142F]/94 via-[#07142F]/54 to-[#07142F]/10" />
            <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/75 via-[#07142F]/45 to-transparent" />
            <div className="relative flex min-h-[560px] flex-col justify-between px-6 py-8 md:min-h-[620px] md:px-10 md:py-10">
              <span className="inline-flex w-fit rounded-full bg-[#07142F]/80 px-4 py-2 text-xs font-extrabold uppercase tracking-[.18em] text-[#87D33B] ring-1 ring-white/15">Vertraulich</span>
              <div className="max-w-4xl pb-2">
                <p className="text-sm font-extrabold uppercase tracking-[.25em] text-[#87D33B]">Investment Memorandum</p>
                <h1 className="mt-4 text-5xl font-extrabold leading-[.95] tracking-[-.045em] md:text-7xl">{project.project_name}</h1>
                <p className="mt-5 text-2xl font-bold text-white/95 md:text-3xl">{typeLabel(project.project_type)}</p>
                <div className="mt-7 flex items-center gap-3 text-lg font-semibold text-white/90"><MapPin className="h-6 w-6 text-[#87D33B]" /> {location}</div>
                <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/20 pt-5 text-sm font-semibold text-white/70"><span>Projekt-Nr. {project.project_number || '—'}</span><span>Stand: {dateLabel}</span></div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 py-8 md:px-10 md:py-10 print:break-after-page">
          <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#0B1633]">Executive Summary</p>
          <div className="mt-2 h-1 w-12 rounded-full bg-[#5CB800]" />
          <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600">Attraktives {typeLabel(project.project_type)} mit zentral gepflegten Projektdaten und klarer wirtschaftlicher Einordnung für professionelle Investoren.</p>

          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-4">
            {metrics.map(({ icon: Icon, label, value: metricValue }) => (
              <div key={label} className="rounded-[1.35rem] border border-slate-200 bg-white p-4 text-center shadow-sm md:p-5">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#F1F9E8] text-[#3D9200]"><Icon className="h-5 w-5" /></div>
                <p className="mt-4 text-[9px] font-extrabold uppercase tracking-[.1em] text-slate-500 md:text-[11px]">{label}</p>
                <p className="mt-2 text-lg font-extrabold leading-tight text-[#0B1633] md:text-2xl">{metricValue}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-[1.4rem] border border-slate-200 p-6">
              <h3 className="text-lg font-extrabold text-[#0B1633]">Projektübersicht</h3>
              <div className="mt-5 space-y-3">{[
                ['Projekttyp', typeLabel(project.project_type)],
                ['Standort', location],
                ['Bundesland', project.location_state || '—'],
                ['Netzanschluss', project.grid_connection_status || project.netzanschluss || 'Zu prüfen'],
                ['Vergütung', tariffDisplay(tariff)],
                ['Projektstatus', project.status || '—'],
              ].map(([label, val]) => <div key={label} className="grid grid-cols-[1fr_auto] gap-4 border-b border-slate-100 pb-3 text-sm"><span className="flex items-center gap-2 font-semibold text-slate-500"><span className="h-2 w-2 rounded-full bg-[#5CB800]" />{label}</span><span className="text-right font-extrabold text-[#0B1633]">{val}</span></div>)}</div>
            </div>

            <div className="rounded-[1.4rem] border border-slate-200 p-6">
              <h3 className="text-lg font-extrabold text-[#0B1633]">Standort Highlights</h3>
              <div className="mt-5 rounded-[1.2rem] bg-[#F7FCEB] p-5"><div className="flex items-center gap-3"><MapPin className="h-8 w-8 text-[#5CB800]" /><div><p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#5CB800]">Projektstandort</p><p className="mt-1 text-xl font-extrabold text-[#0B1633]">{location}</p></div></div></div>
              <div className="mt-5 space-y-4">{[
                specificYield ? `Spezifischer Ertrag: ${formatNumber(specificYield)} kWh/kWp` : 'Standortbasierte Ertragsanalyse vorbereitet',
                tariff ? `Vergütungsniveau: ${tariffDisplay(tariff)}` : 'Vergütung wird zentral ergänzt',
                amortisation ? `Amortisation: ca. ${formatNumber(amortisation, 1)} Jahre` : 'Amortisation wird nach Datenergänzung berechnet',
                'Projekt- und Wirtschaftsdaten zentral synchronisiert',
              ].map(item => <div key={item} className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#5CB800]" /><p className="text-sm leading-6 text-slate-600">{item}</p></div>)}</div>
            </div>
          </div>

          <div className="mt-7 flex gap-3 rounded-[1.3rem] bg-slate-50 p-5 text-xs leading-5 text-slate-500"><ShieldCheck className="h-6 w-6 shrink-0 text-[#5CB800]" /><p>Dieses Investment Memorandum wurde durch EMA Intelligence erstellt und übernimmt ausschließlich zentral gespeicherte oder eindeutig berechenbare Projektdaten.</p></div>
        </section>

        <section className="px-6 py-8 md:px-10 md:py-10 print:break-after-page">
          <div className="border-b border-slate-200 pb-5"><p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#5CB800]">02</p><h2 className="mt-2 text-3xl font-extrabold text-[#0B1633]">Wirtschaftlichkeit & Ertrag</h2></div>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-[1.7rem] bg-[#0B1633] p-7 text-white">
              <h3 className="text-xl font-extrabold">Vergütung & Ertrag</h3>
              <div className="mt-6 space-y-5">{[
                ['Vergütung', tariffDisplay(tariff)],
                ['Spezifischer Ertrag', specificYield ? `${formatNumber(specificYield)} kWh/kWp` : 'Noch offen'],
                ['Jährlicher Ertrag', annualYield ? `${formatNumber(annualYield)} kWh` : 'Noch offen'],
                ['Jahreserlös', annualRevenue > 0 ? formatMoney(annualRevenue) : 'Noch offen'],
                ['Kaufpreis', formatMoney(purchasePrice)],
              ].map(([label, val]) => <div key={label} className="flex items-end justify-between gap-4 border-b border-white/10 pb-4"><span className="text-sm font-bold text-white/60">{label}</span><span className="text-xl font-extrabold text-[#87D33B]">{val}</span></div>)}</div>
            </div>

            <div className="rounded-[1.7rem] border border-slate-200 p-7">
              <h3 className="text-xl font-extrabold text-[#0B1633]">Amortisationsanalyse</h3>
              <div className="mt-8 flex h-56 items-end gap-3">{[12,20,30,42,55,68,82,100].map((height, i) => <div key={i} className="flex-1 rounded-t-lg bg-gradient-to-t from-[#0B1633] to-[#5CB800]" style={{ height: `${height}%` }} />)}</div>
              <div className="mt-3 flex justify-between text-[10px] font-bold text-slate-400"><span>Start</span><span>{amortisation ? `Break-even ca. ${formatNumber(amortisation, 1)} Jahre` : 'Berechnung nach Datenergänzung'}</span></div>
            </div>
          </div>
        </section>

        <section className="px-6 py-8 md:px-10 md:py-10 print:min-h-[277mm]">
          <div className="border-b border-slate-200 pb-5"><p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#5CB800]">03</p><h2 className="mt-2 text-3xl font-extrabold text-[#0B1633]">Risiken & Ansprechpartner</h2></div>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-[1.7rem] border border-slate-200 p-7"><ShieldCheck className="h-9 w-9 text-[#5CB800]" /><h3 className="mt-5 text-xl font-extrabold text-[#0B1633]">Risikodarstellung</h3><div className="mt-6 space-y-4">{['Genehmigungs- und Planungsrisiken','Netzanschlussrisiken','Bau- und Lieferkettenrisiken','Ertrags- und Betriebsrisiken','Markt- und Regulierungsrisiken'].map(item => <div key={item} className="flex items-center justify-between gap-4"><span className="text-sm font-bold text-slate-600">{item}</span><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-extrabold text-amber-700">Zu prüfen</span></div>)}</div></div>
            <div className="rounded-[1.7rem] bg-[#0B1633] p-7 text-white"><p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#87D33B]">Ihr Ansprechpartner</p><h3 className="mt-4 text-3xl font-extrabold">Ali Ünlüer</h3><p className="mt-2 font-bold text-white/70">Managing Director · EMA Enterprise GmbH</p><div className="mt-8 space-y-4 text-sm text-slate-200"><p className="flex items-center gap-3"><CalendarDays className="h-5 w-5 text-[#87D33B]" /> Persönliche Projektbesprechung nach Vereinbarung</p><p className="flex items-center gap-3"><MapPin className="h-5 w-5 text-[#87D33B]" /> Deutschland</p></div></div>
          </div>
          <div className="mt-10 border-t border-slate-200 pt-6 text-xs leading-5 text-slate-400">Dieses Investment Memorandum wird automatisiert aus den in EMA Intelligence gespeicherten Projektdaten erzeugt und dient ausschließlich Informationszwecken. Vor einer Investitionsentscheidung sind sämtliche technischen, rechtlichen und wirtschaftlichen Angaben eigenständig zu prüfen.</div>
        </section>
      </article>
    </div>
  )
}
