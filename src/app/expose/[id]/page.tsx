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
  const price = Number(purchasePrice)
  const tariffEur = tariffEuroPerKwh(tariff)
  const calculatedAnnualYield = Number.isFinite(pv) && Number.isFinite(yieldPerKwp) ? pv * yieldPerKwp : null
  const annualYield = storedAnnualYield ?? calculatedAnnualYield
  const annualRevenue = Number(annualYield) * (tariffEur ?? 0)
  const calculatedAmortisation = price > 0 && annualRevenue > 0 ? price / annualRevenue : null
  const amortisation = storedAmortisation ?? calculatedAmortisation
  const roi = price > 0 && annualRevenue > 0 ? (annualRevenue / price) * 100 : null

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

  const baseOpexRate = 7
  const optimisticOpexRate = 5
  const baseOpex = Number.isFinite(pv) ? pv * baseOpexRate : 0
  const optimisticOpex = Number.isFinite(pv) ? pv * optimisticOpexRate : 0
  const baseNet = Math.max(annualRevenue - baseOpex, 0)
  const optimisticNet = Math.max(annualRevenue - optimisticOpex, 0)
  const baseYield = price > 0 ? (baseNet / price) * 100 : 0
  const optimisticYield = price > 0 ? (optimisticNet / price) * 100 : 0
  const basePayback = baseNet > 0 ? price / baseNet : 0
  const optimisticPayback = optimisticNet > 0 ? price / optimisticNet : 0

  const baseTariff = tariffEur ?? 0
  const tariffs = [Math.max(baseTariff - 0.005, 0), baseTariff, baseTariff + 0.005]
  const yieldFactors = [0.95, 1, 1.05]
  const sensitivity = yieldFactors.map((factor) =>
    tariffs.map((rate) => {
      const revenue = Number(annualYield) * factor * rate
      return price > 0 ? (revenue / price) * 100 : 0
    }),
  )

  const processSteps = [
    ['Interessenbekundung & NDA', 'Unterzeichnung der Vertraulichkeitsvereinbarung und Freischaltung des Datenraums.'],
    ['Datenraum & Q&A', 'Prüfung von Netzanschluss, Vergütungsnachweis, Dachnutzungsvertrag und technischer Dokumentation.'],
    ['Indikatives Angebot', 'Abgabe eines nicht bindenden Angebots auf Basis der bereitgestellten Projektunterlagen.'],
    ['Bestätigende Due Diligence', 'Technische, rechtliche und steuerliche Prüfung sowie Standortbegehung nach Abstimmung.'],
    ['Signing & Closing', 'Kaufvertragsverhandlung, Vollzugsbedingungen und Übergang von Nutzen und Lasten.'],
  ]

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

      <div className="space-y-8 print:space-y-0">
        <article className="memorandum-page mx-auto flex w-full max-w-[1180px] flex-col overflow-hidden bg-white shadow-[0_30px_80px_rgba(15,23,42,0.16)] print:h-[297mm] print:w-[210mm] print:max-w-none print:overflow-hidden print:shadow-none [print-color-adjust:exact] [-webkit-print-color-adjust:exact]">
          <div className="flex items-center justify-between gap-4 px-8 py-5 print:px-7 print:py-3">
            <img src="/ema-logo.jpeg" alt="EMA Enterprise GmbH" className="h-16 w-auto object-contain print:h-11" />
            <div className="text-right">
              <p className="text-xl font-extrabold tracking-[.08em] text-[#0B1633] print:text-base">INVESTMENT MEMORANDUM</p>
              <p className="mt-2 text-sm font-extrabold uppercase tracking-[.16em] text-[#5CB800] print:text-[10px]">{typeLabel(project.project_type)}</p>
            </div>
          </div>

          <section className="relative h-[355px] overflow-hidden bg-[#e8eef2] print:h-[210px]">
            <img src={heroImage} alt="Hochwertiges Projektmotiv" className="absolute inset-0 h-full w-full object-cover object-center brightness-[1.12] saturate-[1.08] contrast-[1.02] print:block" />
            <div className="absolute inset-0 bg-gradient-to-r from-white/88 via-white/30 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/65 to-transparent" />
            <div className="relative flex h-full flex-col justify-end px-8 pb-7 print:px-7 print:pb-4">
              <h1 className="text-5xl font-extrabold tracking-[-.045em] text-[#0B1633] print:text-[28px]">{project.project_name}</h1>
              <p className="mt-3 text-sm font-extrabold uppercase tracking-[.18em] text-[#0B1633] print:mt-2 print:text-[9px]">Projekt-Nr. <span className="text-[#5CB800]">{project.project_number || '—'}</span></p>
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-base font-semibold text-[#0B1633] print:mt-2 print:text-[9px]">
                <span className="inline-flex items-center gap-2"><MapPin className="h-5 w-5 print:h-3.5 print:w-3.5" />{location}</span>
                <span className="inline-flex items-center gap-2"><CalendarDays className="h-5 w-5 print:h-3.5 print:w-3.5" />{dateLabel}</span>
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

        <article className="memorandum-page mx-auto flex w-full max-w-[1180px] flex-col overflow-hidden bg-[#F7F7F5] px-8 py-8 shadow-[0_30px_80px_rgba(15,23,42,0.16)] print:h-[297mm] print:w-[210mm] print:max-w-none print:px-[12mm] print:py-[10mm] print:shadow-none [print-color-adjust:exact] [-webkit-print-color-adjust:exact]">
          <header className="flex items-start justify-between">
            <img src="/ema-logo.jpeg" alt="EMA Enterprise GmbH" className="h-14 w-auto object-contain print:h-9" />
            <div className="text-right">
              <p className="text-xl font-extrabold tracking-[.07em] text-[#0B1633] print:text-[15px]">INVESTMENT MEMORANDUM</p>
              <p className="mt-2 text-xs font-extrabold uppercase tracking-[.18em] text-[#5CB800] print:text-[8px]">{project.project_number || '—'} · {project.project_name}</p>
            </div>
          </header>

          <div className="mt-12 print:mt-7">
            <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#5CB800] print:text-[8px]">Wirtschaftlichkeit & Prozess</p>
            <h2 className="mt-3 text-3xl font-extrabold text-[#0B1633] print:text-[21px]">Indikative Netto-Betrachtung & Transaktionsprozess</h2>
            <p className="mt-3 text-sm tracking-[.08em] text-slate-500 print:text-[8px]">Alle Werte indikativ · Stand {dateLabel} · vorbehaltlich bestätigender Due Diligence</p>
          </div>

          <div className="mt-10 grid grid-cols-[1fr_1.02fr] gap-8 print:mt-6 print:gap-5">
            <div>
              <section>
                <h3 className="text-xl font-extrabold uppercase tracking-[.07em] text-[#0B1633] print:text-[12px]">OPEX-Szenarien (indikativ)</h3>
                <div className="mt-2 h-1 w-12 rounded-full bg-[#5CB800] print:h-0.5" />
                <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white print:mt-3 print:rounded-xl">
                  <div className="grid grid-cols-[1.25fr_0.85fr_0.85fr] border-b-2 border-[#0B1633] px-5 py-4 text-xs font-extrabold uppercase tracking-[.08em] text-slate-500 print:px-3 print:py-2 print:text-[7px]">
                    <span>Position</span><span className="text-right">Basis</span><span className="text-right">Optimistisch</span>
                  </div>
                  {[
                    ['Jahreserlös', formatMoney(annualRevenue), formatMoney(annualRevenue)],
                    ['OPEX-Annahme', `${formatNumber(baseOpexRate)} €/kWp`, `${formatNumber(optimisticOpexRate)} €/kWp`],
                    ['OPEX p.a.', `−${formatMoney(baseOpex)}`, `−${formatMoney(optimisticOpex)}`],
                    ['Nettoerlös p.a.', formatMoney(baseNet), formatMoney(optimisticNet)],
                    ['Nettoanfangsrendite', `${formatNumber(baseYield, 2)} %`, `${formatNumber(optimisticYield, 2)} %`],
                    ['Amortisation (netto)', `${formatNumber(basePayback, 1)} Jahre`, `${formatNumber(optimisticPayback, 1)} Jahre`],
                  ].map(([label, a, b], index) => (
                    <div key={label} className={`grid grid-cols-[1.25fr_0.85fr_0.85fr] px-5 py-4 text-sm print:px-3 print:py-2 print:text-[8px] ${index === 3 || index === 4 ? 'bg-[#F1F9E8] font-extrabold text-[#0B1633]' : 'border-b border-slate-100 text-slate-600'}`}>
                      <span>{label}</span><span className="text-right">{a}</span><span className="text-right">{b}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-9 print:mt-5">
                <h3 className="text-xl font-extrabold uppercase tracking-[.07em] text-[#0B1633] print:text-[12px]">Sensitivität Bruttorendite</h3>
                <div className="mt-2 h-1 w-12 rounded-full bg-[#5CB800] print:h-0.5" />
                <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white print:mt-3 print:rounded-xl">
                  <div className="grid grid-cols-4 border-b-2 border-[#0B1633] px-5 py-4 text-xs font-extrabold uppercase tracking-[.06em] text-slate-500 print:px-3 print:py-2 print:text-[7px]">
                    <span>Ertrag / Vergütung</span>
                    {tariffs.map((rate) => <span key={rate} className="text-right">{formatNumber(rate * 100, 1)} ct</span>)}
                  </div>
                  {['−5 % Ertrag', 'P50-Ertrag', '+5 % Ertrag'].map((label, row) => (
                    <div key={label} className={`grid grid-cols-4 px-5 py-4 text-sm print:px-3 print:py-2 print:text-[8px] ${row === 1 ? 'bg-[#F1F9E8] font-extrabold text-[#0B1633]' : 'border-b border-slate-100 text-slate-600'}`}>
                      <span>{label}</span>
                      {sensitivity[row].map((value, col) => <span key={`${row}-${col}`} className="text-right">{formatNumber(value, 2)} %</span>)}
                    </div>
                  ))}
                </div>
              </section>

              <div className="mt-8 rounded-xl border-l-4 border-[#5CB800] bg-white p-5 text-sm leading-6 text-slate-600 print:mt-5 print:p-3 print:text-[7px] print:leading-3.5">
                <strong className="text-[#0B1633]">Annahmen:</strong> OPEX umfasst Wartung, Versicherung, Monitoring und Rücklagen (indikativ, ohne Dachpacht). Degradation, steuerliche Effekte und Finanzierungskosten sind nicht berücksichtigt. Finale Werte nach technischer und rechtlicher Due Diligence.
              </div>
            </div>

            <div>
              <section>
                <h3 className="text-xl font-extrabold uppercase tracking-[.07em] text-[#0B1633] print:text-[12px]">Transaktionsprozess</h3>
                <div className="mt-2 h-1 w-12 rounded-full bg-[#5CB800] print:h-0.5" />
                <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white px-6 py-2 print:mt-3 print:rounded-xl print:px-4">
                  {processSteps.map(([title, description], index) => (
                    <div key={title} className="flex gap-4 border-b border-slate-100 py-5 last:border-b-0 print:gap-3 print:py-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0B1633] text-sm font-extrabold text-white print:h-6 print:w-6 print:text-[8px]">{index + 1}</span>
                      <div>
                        <h4 className="font-extrabold text-[#0B1633] print:text-[8px]">{title}</h4>
                        <p className="mt-1 text-sm leading-6 text-slate-600 print:text-[7px] print:leading-3.5">{description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-8 grid grid-cols-[1.25fr_0.75fr] gap-5 rounded-2xl bg-[#0B1633] p-7 text-white print:mt-5 print:rounded-xl print:p-4">
                <div>
                  <h3 className="text-2xl font-extrabold print:text-[14px]">Datenraumzugang <span className="text-[#87D33B]">anfragen</span></h3>
                  <p className="mt-3 text-sm leading-6 text-white/75 print:text-[7px] print:leading-3.5">Qualifizierte Investoren erhalten nach NDA-Unterzeichnung Zugang zur vollständigen Projektdokumentation.</p>
                </div>
                <div className="text-right text-sm leading-6 text-white/75 print:text-[7px] print:leading-3.5">
                  <p className="font-extrabold text-[#87D33B]">EMA Enterprise GmbH</p>
                  <p>Gabriel-von-Seidl-Str. 56</p>
                  <p>67550 Worms</p>
                  <p>info@ema-enterprise.de</p>
                </div>
              </section>

              <p className="mt-8 text-[11px] leading-5 text-slate-400 print:mt-5 print:text-[6px] print:leading-3">
                <strong>Disclaimer:</strong> Dieses Investment Memorandum dient ausschließlich der unverbindlichen Erstinformation professioneller und semiprofessioneller Investoren und stellt weder ein Angebot noch eine Aufforderung zur Abgabe eines Angebots dar. Sämtliche Angaben – insbesondere zu Netzanschluss, Einspeiseart, Vergütung und Wirtschaftlichkeit – beruhen auf Angaben des Verkäufers bzw. Projektinhabers und stehen unter dem Vorbehalt der bestätigenden Due Diligence. Renditeangaben sind indikativ und stellen keine Zusicherung künftiger Erträge dar. EMA Enterprise GmbH übernimmt keine Gewähr für Vollständigkeit und Richtigkeit der überlassenen Informationen. Weitergabe nur mit schriftlicher Zustimmung.
              </p>
            </div>
          </div>
        </article>
      </div>
    </div>
  )
}
