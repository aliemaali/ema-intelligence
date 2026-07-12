import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  ArrowLeftRight,
  BadgeEuro,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Coins,
  Globe2,
  Mail,
  MapPin,
  Plug,
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
  if (!Number.isFinite(n) || n <= 0) return 'Noch offen'
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
      ? (project.ai_score_details as any).ema_ai ?? {}
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

  return Object.assign({}, project, deal ?? {}, emaAi, ...optionalData)
}

export default async function InvestmentMemorandumPage({ params }: { params: { id: string } }) {
  const project: any = await loadProjectData(params.id)
  if (!project) notFound()

  const pvKwp = firstValue(project, ['pv_kwp', 'pv_mwp', 'capacity_kwp', 'capacity_mwp', 'plant_capacity_kwp', 'anlagenleistung_kwp'])
  const purchasePrice = firstValue(project, ['purchase_price', 'total_purchase_price', 'deal_purchase_price', 'kaufpreis', 'purchase_price_eur'])
  const tariff = firstValue(project, ['feed_in_tariff', 'feed_in_tariff_eur_kwh', 'feed_in_tariff_ct_kwh', 'tariff', 'tariff_ct_kwh', 'remuneration', 'verguetung', 'vergutung', 'vergütung'])
  const specificYield = firstValue(project, ['specific_yield', 'specific_yield_kwh_kwp', 'yield_kwh_kwp', 'annual_specific_yield', 'ertrag_kwh_kwp', 'spezifischer_ertrag'])
  const storedAnnualYield = firstValue(project, ['annual_yield_kwh', 'annual_energy_kwh', 'annual_production_kwh', 'jahresproduktion_kwh'])
  const storedAmortisation = firstValue(project, ['amortisation_years', 'amortization_years', 'payback_years', 'payback_period_years', 'amortisation'])

  const pv = Number(pvKwp)
  const yieldPerKwp = Number(specificYield)
  const calculatedAnnualYield = Number.isFinite(pv) && Number.isFinite(yieldPerKwp) ? pv * yieldPerKwp : null
  const annualYield = storedAnnualYield ?? calculatedAnnualYield
  const annualRevenue = Number(annualYield) * (tariffEuroPerKwh(tariff) ?? 0)
  const calculatedAmortisation = Number(purchasePrice) > 0 && annualRevenue > 0 ? Number(purchasePrice) / annualRevenue : null
  const amortisation = storedAmortisation ?? calculatedAmortisation
  const roi = Number(purchasePrice) > 0 && annualRevenue > 0 ? (annualRevenue / Number(purchasePrice)) * 100 : null

  const location = [project.location_city, project.location_state].filter(Boolean).join(', ') || 'Deutschland'
  const dateLabel = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(new Date())
  const heroImage = '/hero-dashboard.png'

  const metrics = [
    { icon: Zap, label: 'Leistung', value: `${formatNumber(pvKwp, 2)} kWp` },
    { icon: BadgeEuro, label: 'Kaufpreis', value: formatMoney(purchasePrice) },
    { icon: SunMedium, label: 'Spez. Ertrag', value: specificYield ? `${formatNumber(specificYield)} kWh/kWp` : 'Noch offen' },
    { icon: BadgeEuro, label: 'Vergütung', value: tariffDisplay(tariff) },
    { icon: Coins, label: 'Jahreserlös', value: annualRevenue > 0 ? formatMoney(annualRevenue) : 'Noch offen' },
    { icon: CalendarDays, label: 'Amortisation', value: amortisation ? `${formatNumber(amortisation, 1)} Jahre` : 'Noch offen' },
  ]

  const highlights = [
    specificYield ? `Hoher spezifischer Ertrag von ${formatNumber(specificYield)} kWh/kWp` : null,
    amortisation ? `Amortisation nach ca. ${formatNumber(amortisation, 1)} Jahren` : null,
    tariff ? `Attraktive Vergütung von ${tariffDisplay(tariff)}` : null,
    'Solides Ertragspotenzial und stabile Einnahmen',
    project.status ? `Projektstatus: ${project.status}` : null,
  ].filter(Boolean) as string[]

  return (
    <div className="min-h-screen bg-[#eef2f5] pb-24 print:bg-white print:pb-0">
      <header className="print:hidden border-b border-slate-200 bg-white px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] shadow-sm md:px-8 md:pb-5 md:pt-6">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4">
          <Link href="/dashboard" aria-label="Zum Dashboard">
            <img src="/ema-logo.jpeg" alt="EMA Enterprise" className="h-16 w-auto object-contain md:h-20" />
          </Link>
          <PrintButton />
        </div>
      </header>

      <div className="print:hidden mx-auto flex max-w-[1480px] px-4 py-4 md:px-8 md:py-5">
        <Link href="/expose" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-[#0B1633] shadow-sm">
          <ArrowLeft className="h-4 w-4" /> Zurück
        </Link>
      </div>

      <article className="mx-auto flex w-full max-w-[1180px] flex-col overflow-hidden bg-white shadow-[0_30px_80px_rgba(15,23,42,0.16)] print:h-[292mm] print:w-[210mm] print:max-w-none print:overflow-hidden print:shadow-none [print-color-adjust:exact] [-webkit-print-color-adjust:exact]">
        <div className="flex items-center justify-between gap-4 px-8 py-5 print:px-7 print:py-3">
          <img src="/ema-logo.jpeg" alt="EMA Enterprise GmbH" className="h-16 w-auto object-contain print:h-11" />
          <div className="text-right">
            <p className="text-xl font-extrabold tracking-[.08em] text-[#0B1633] print:text-base">INVESTMENT MEMORANDUM</p>
            <p className="mt-2 text-sm font-extrabold uppercase tracking-[.16em] text-[#5CB800] print:text-[10px]">{typeLabel(project.project_type)}</p>
          </div>
        </div>

        <section className="relative h-[355px] overflow-hidden bg-[#e8eef2] print:h-[210px]">
          <img
            src={heroImage}
            alt="Hochwertiges Projektmotiv"
            className="absolute inset-0 h-full w-full object-cover object-center brightness-[1.12] saturate-[1.08] contrast-[1.02] print:block"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white/88 via-white/30 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/65 to-transparent" />
          <div className="relative flex h-full flex-col justify-end px-8 pb-7 print:px-7 print:pb-4">
            <h1 className="text-5xl font-extrabold tracking-[-.045em] text-[#0B1633] print:text-[28px]">{project.project_name}</h1>
            <p className="mt-3 text-sm font-extrabold uppercase tracking-[.18em] text-[#0B1633] print:mt-2 print:text-[9px]">Projekt-Nr. <span className="text-[#5CB800]">{project.project_number || '—'}</span></p>
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-base font-semibold text-[#0B1633] print:mt-2 print:text-[9px]">
              <span className="inline-flex items-center gap-2"><MapPin className="h-5 w-5 text-[#0B1633] print:h-3.5 print:w-3.5" />{location}</span>
              <span className="inline-flex items-center gap-2"><CalendarDays className="h-5 w-5 text-[#0B1633] print:h-3.5 print:w-3.5" />{dateLabel}</span>
            </div>
            <span className="absolute bottom-7 right-8 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-4 py-2 text-xs font-extrabold uppercase tracking-[.08em] text-[#0B1633] shadow-sm print:bottom-4 print:right-7 print:px-3 print:py-1.5 print:text-[8px]">
              <span className="h-2.5 w-2.5 rounded-full bg-[#5CB800]" />
              {project.status || 'Projektstatus offen'}
            </span>
          </div>
        </section>

        <section className="px-8 py-6 print:px-7 print:py-3.5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6 print:grid-cols-6 print:gap-2">
            {metrics.map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-[1.1rem] border border-slate-200 bg-white px-3 py-4 text-center shadow-[0_8px_24px_rgba(15,23,42,0.04)] print:rounded-xl print:px-1.5 print:py-2">
                <div className="mx-auto flex h-10 w-10 items-center justify-center text-[#4DAA00] print:h-7 print:w-7"><Icon className="h-7 w-7 print:h-4 print:w-4" /></div>
                <p className="mt-2 text-[9px] font-extrabold uppercase tracking-[.11em] text-slate-500 print:mt-1 print:text-[6.5px]">{label}</p>
                <p className="mt-1 text-lg font-extrabold leading-tight text-[#0B1633] print:text-[10px]">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-7 grid gap-7 md:grid-cols-2 print:mt-4 print:grid-cols-2 print:gap-5">
            <section className="pr-5 md:border-r md:border-slate-200 print:border-r print:border-slate-200 print:pr-4">
              <h2 className="text-lg font-extrabold uppercase tracking-[.08em] text-[#0B1633] print:text-[11px]">Executive Summary</h2>
              <div className="mt-2 h-1 w-9 bg-[#5CB800] print:h-0.5" />
              <p className="mt-5 text-sm leading-7 text-slate-700 print:mt-3 print:text-[8px] print:leading-4">
                {typeLabel(project.project_type)} in {location} mit {formatNumber(pvKwp, 2)} kWp installierter Leistung. Auf Basis des spezifischen Ertrags von {specificYield ? `${formatNumber(specificYield)} kWh/kWp` : 'noch zu ergänzenden Ertragsdaten'} und der Vergütung von {tariffDisplay(tariff)} ergibt sich eine klare wirtschaftliche Einordnung für professionelle Investoren.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-extrabold uppercase tracking-[.08em] text-[#0B1633] print:text-[11px]">Projektprofil</h2>
              <div className="mt-2 h-1 w-9 bg-[#5CB800] print:h-0.5" />
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 print:mt-3 print:rounded-lg">
                {[
                  [MapPin, 'Standort', location],
                  [ClipboardList, 'Projektstatus', project.status || '—'],
                  [Plug, 'Netzanschluss', project.grid_connection_status || 'Zu prüfen'],
                  [ArrowLeftRight, 'Einspeiseart', project.feed_in_type || '—'],
                ].map(([Icon, label, value]: any) => (
                  <div key={label} className="grid grid-cols-[44px_1fr_auto] items-center border-b border-slate-200 last:border-b-0 print:grid-cols-[28px_1fr_auto]">
                    <span className="flex h-full items-center justify-center border-r border-slate-200 py-3 print:py-1.5"><Icon className="h-5 w-5 text-[#0B1633] print:h-3 print:w-3" /></span>
                    <span className="px-4 text-sm text-slate-600 print:px-2 print:text-[8px]">{label}</span>
                    <span className="px-4 text-right text-sm font-extrabold text-[#0B1633] print:px-2 print:text-[8px]">{value}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="mt-8 grid gap-7 md:grid-cols-2 print:mt-4 print:grid-cols-2 print:gap-5">
            <section>
              <h2 className="text-lg font-extrabold uppercase tracking-[.08em] text-[#0B1633] print:text-[11px]">Wirtschaftliche Kennzahlen</h2>
              <div className="mt-2 h-1 w-9 bg-[#5CB800] print:h-0.5" />
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 print:mt-3 print:rounded-lg">
                {[
                  ['Jahresproduktion', annualYield ? `${formatNumber(annualYield)} kWh` : 'Noch offen'],
                  ['Jahreserlös', annualRevenue > 0 ? formatMoney(annualRevenue) : 'Noch offen'],
                  ['Kaufpreis', formatMoney(purchasePrice)],
                  ['Vergütung', tariffDisplay(tariff)],
                  ['Rendite p.a.', roi ? `${formatNumber(roi, 2)} %` : 'Noch offen'],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between border-b border-slate-200 px-4 py-3 text-sm last:border-b-0 print:px-2.5 print:py-1.5 print:text-[8px]">
                    <span className="text-slate-600">{label}</span>
                    <span className="font-extrabold text-[#0B1633]">{value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between rounded-xl border border-[#DDECCB] bg-[#F4FAEC] px-4 py-3 print:mt-2 print:px-2.5 print:py-1.5">
                <span className="text-sm font-extrabold uppercase tracking-[.08em] text-[#3D9200] print:text-[8px]">Amortisation</span>
                <span className="text-2xl font-extrabold text-[#3D9200] print:text-[13px]">{amortisation ? `${formatNumber(amortisation, 1)} Jahre` : 'Noch offen'}</span>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-extrabold uppercase tracking-[.08em] text-[#0B1633] print:text-[11px]">Investment Highlights</h2>
              <div className="mt-2 h-1 w-9 bg-[#5CB800] print:h-0.5" />
              <div className="mt-4 rounded-[1.2rem] border border-[#DDECCB] px-5 py-4 print:mt-3 print:rounded-lg print:px-3 print:py-2">
                <div className="space-y-4 print:space-y-2">
                  {highlights.slice(0, 5).map((item) => (
                    <div key={item} className="flex items-start gap-3 text-sm text-slate-700 print:gap-2 print:text-[8px]">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#5CB800] print:h-3 print:w-3" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </section>

        <footer className="mt-auto grid grid-cols-[1.05fr_1.2fr_1.15fr_0.7fr] items-center gap-5 border-t border-slate-300 px-8 py-5 text-xs text-[#0B1633] print:px-7 print:py-2.5 print:text-[7px]">
          <img src="/ema-logo.jpeg" alt="EMA Enterprise GmbH" className="h-14 w-auto object-contain print:h-8" />
          <div className="leading-5 print:leading-3.5">
            <p className="font-bold">EMA Enterprise GmbH</p>
            <p>Gabriel-von-Seidl-Str. 56</p>
            <p>67550 Worms, Germany</p>
          </div>
          <div className="space-y-2 print:space-y-1">
            <p className="flex items-center gap-2"><Globe2 className="h-4 w-4 print:h-2.5 print:w-2.5" />www.ema-enterprise.de</p>
            <p className="flex items-center gap-2"><Mail className="h-4 w-4 print:h-2.5 print:w-2.5" />info@ema-enterprise.de</p>
          </div>
          <div className="border-l border-slate-300 pl-5 leading-5 print:pl-3 print:leading-3.5">
            <p>Stand: {dateLabel}</p>
            <p>Version 3.0</p>
          </div>
        </footer>
      </article>
    </div>
  )
}
