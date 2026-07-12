import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  BadgeEuro,
  CalendarDays,
  CheckCircle2,
  FileText,
  MapPin,
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
    { icon: Zap, label: 'Installierte Leistung', value: `${formatNumber(pvKwp, 2)} kWp` },
    { icon: BadgeEuro, label: 'Kaufpreis', value: formatMoney(purchasePrice) },
    { icon: SunMedium, label: 'Spezifischer Ertrag', value: specificYield ? `${formatNumber(specificYield)} kWh/kWp` : 'Noch offen' },
    { icon: BadgeEuro, label: 'Vergütung', value: tariffDisplay(tariff) },
    { icon: CalendarDays, label: 'Amortisation', value: amortisation ? `${formatNumber(amortisation, 2)} Jahre` : 'Noch offen' },
  ]

  const highlights = [
    specificYield ? `Standort mit ${formatNumber(specificYield)} kWh/kWp spezifischem Ertrag` : null,
    amortisation ? `Klare Wirtschaftlichkeit mit ca. ${formatNumber(amortisation, 2)} Jahren Amortisation` : null,
    tariff ? `Langfristige Erlöse auf Basis von ${tariffDisplay(tariff)}` : null,
    project.grid_connection_status ? `Netzanschlussstatus: ${project.grid_connection_status}` : null,
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

      <article className="mx-auto w-full max-w-[1180px] overflow-hidden bg-white shadow-[0_30px_80px_rgba(15,23,42,0.16)] print:h-[297mm] print:w-[210mm] print:max-w-none print:shadow-none [print-color-adjust:exact] [-webkit-print-color-adjust:exact]">
        <div className="flex items-center justify-between gap-4 px-6 py-4 md:px-8 print:px-7 print:py-3">
          <img src="/ema-logo.jpeg" alt="EMA Enterprise GmbH" className="h-16 w-auto object-contain print:h-12" />
          <div className="text-right">
            <p className="text-xl font-extrabold tracking-[.08em] text-[#0B1633] print:text-base">INVESTMENT MEMORANDUM</p>
            <p className="mt-1 text-sm font-extrabold uppercase tracking-[.16em] text-[#5CB800] print:text-[10px]">{typeLabel(project.project_type)}</p>
          </div>
        </div>

        <section className="relative h-[300px] overflow-hidden bg-[#dfe8ef] print:h-[205px]">
          <img
            src={heroImage}
            alt="Hochwertiges Projektmotiv"
            className="absolute inset-0 h-full w-full object-cover object-center saturate-[1.08] contrast-[1.02] brightness-[1.08] print:block"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white/78 via-white/28 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#0B1633]/12 to-transparent" />
          <div className="relative flex h-full items-end px-6 pb-6 md:px-8 print:px-7 print:pb-4">
            <div className="max-w-[420px] rounded-[1.25rem] border border-white/70 bg-white/92 p-5 text-[#0B1633] shadow-[0_12px_40px_rgba(15,23,42,0.16)] backdrop-blur-md print:bg-white print:p-4">
              <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#5CB800]">Projekt-Nr.</p>
              <h1 className="mt-2 text-4xl font-extrabold tracking-tight print:text-2xl">{project.project_number || '—'}</h1>
              <p className="mt-4 text-sm font-semibold text-slate-600 print:mt-2 print:text-[10px]">{project.project_name} · {dateLabel}</p>
            </div>
          </div>
        </section>

        <section className="px-6 py-6 md:px-8 print:px-7 print:py-4">
          <div className="grid gap-6 md:grid-cols-2 print:grid-cols-2 print:gap-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F1F9E8] text-[#3D9200] print:h-7 print:w-7"><FileText className="h-4 w-4" /></span>
                <h2 className="text-lg font-extrabold text-[#0B1633] print:text-sm">Executive Summary</h2>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600 print:mt-2 print:text-[10px] print:leading-4">Attraktives {typeLabel(project.project_type)} mit zentral gepflegten Projektdaten und klarer wirtschaftlicher Einordnung für professionelle Investoren.</p>
            </div>
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F1F9E8] text-[#3D9200] print:h-7 print:w-7"><MapPin className="h-4 w-4" /></span>
                <h2 className="text-lg font-extrabold text-[#0B1633] print:text-sm">Standort</h2>
              </div>
              <div className="mt-4 space-y-2 text-sm print:mt-2 print:space-y-1 print:text-[10px]">
                <div className="flex justify-between gap-4"><span className="text-slate-500">Standort</span><span className="font-extrabold text-[#0B1633]">{location}</span></div>
                <div className="flex justify-between gap-4"><span className="text-slate-500">Netzanschluss</span><span className="font-extrabold text-[#0B1633]">{project.grid_connection_status || 'Zu prüfen'}</span></div>
                <div className="flex justify-between gap-4"><span className="text-slate-500">Einspeiseart</span><span className="font-extrabold text-[#0B1633]">{project.feed_in_type || '—'}</span></div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 rounded-[1.4rem] border border-slate-200 p-3 md:grid-cols-5 print:mt-4 print:grid-cols-5 print:gap-2 print:p-2">
            {metrics.map(({ icon: Icon, label, value }) => (
              <div key={label} className="border-slate-200 px-2 py-3 text-center md:border-r md:last:border-r-0 print:border-r print:last:border-r-0 print:px-1 print:py-2">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#F1F9E8] text-[#3D9200] print:h-7 print:w-7"><Icon className="h-5 w-5 print:h-3.5 print:w-3.5" /></div>
                <p className="mt-3 text-[9px] font-extrabold uppercase tracking-[.08em] text-slate-500 print:mt-2 print:text-[7px]">{label}</p>
                <p className="mt-1 text-lg font-extrabold leading-tight text-[#0B1633] print:text-xs">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2 print:mt-4 print:grid-cols-2 print:gap-4">
            <div className="rounded-[1.3rem] border border-slate-200 p-5 print:p-3">
              <h3 className="text-lg font-extrabold text-[#0B1633] print:text-sm">Projektübersicht</h3>
              <div className="mt-4 space-y-2 print:mt-2 print:space-y-1">{[
                ['Projekttyp', typeLabel(project.project_type)],
                ['Projekt-Nr.', project.project_number || '—'],
                ['Stand', dateLabel],
                ['Projektstatus', project.status || '—'],
                ['Bundesland', project.location_state || '—'],
                ['Netzanschluss', project.grid_connection_status || 'Zu prüfen'],
              ].map(([label, value]) => <div key={label} className="flex justify-between gap-4 border-b border-slate-100 pb-2 text-sm print:pb-1 print:text-[9px]"><span className="text-slate-500">{label}</span><span className="text-right font-extrabold text-[#0B1633]">{value}</span></div>)}</div>
            </div>

            <div className="rounded-[1.3rem] border border-slate-200 p-5 print:p-3">
              <h3 className="text-lg font-extrabold text-[#0B1633] print:text-sm">Wirtschaftliche Kennzahlen</h3>
              <div className="mt-4 space-y-2 print:mt-2 print:space-y-1">{[
                ['Jahresproduktion', annualYield ? `${formatNumber(annualYield)} kWh` : 'Noch offen'],
                ['Jahreserlös', annualRevenue > 0 ? formatMoney(annualRevenue) : 'Noch offen'],
                ['Kaufpreis', formatMoney(purchasePrice)],
                ['Amortisation', amortisation ? `${formatNumber(amortisation, 2)} Jahre` : 'Noch offen'],
                ['Rendite p.a.', roi ? `${formatNumber(roi, 2)} %` : 'Noch offen'],
              ].map(([label, value]) => <div key={label} className="flex justify-between gap-4 border-b border-slate-100 pb-2 text-sm print:pb-1 print:text-[9px]"><span className="text-slate-500">{label}</span><span className="text-right font-extrabold text-[#0B1633]">{value}</span></div>)}</div>
              <div className="mt-4 flex items-center justify-between rounded-xl bg-[#F1F9E8] px-4 py-3 print:mt-2 print:px-3 print:py-2"><span className="font-extrabold uppercase tracking-[.08em] text-[#3D9200] print:text-[8px]">Amortisation</span><span className="text-xl font-extrabold text-[#3D9200] print:text-sm">{amortisation ? `${formatNumber(amortisation, 2)} Jahre` : 'Noch offen'}</span></div>
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2 print:mt-4 print:grid-cols-2 print:gap-4">
            <div className="rounded-[1.3rem] bg-[#0B1633] p-5 text-white print:p-3">
              <h3 className="text-lg font-extrabold print:text-sm">Wirtschaftliche Zusammenfassung</h3>
              <div className="mt-4 space-y-2 print:mt-2 print:space-y-1">{[
                ['Jahresproduktion', annualYield ? `${formatNumber(annualYield)} kWh` : 'Noch offen'],
                ['Jahreserlös', annualRevenue > 0 ? formatMoney(annualRevenue) : 'Noch offen'],
                ['Kaufpreis', formatMoney(purchasePrice)],
                ['Amortisation', amortisation ? `${formatNumber(amortisation, 2)} Jahre` : 'Noch offen'],
                ['Rendite vor Steuern (p.a.)', roi ? `${formatNumber(roi, 2)} %` : 'Noch offen'],
              ].map(([label, value]) => <div key={label} className="flex justify-between gap-4 border-b border-white/10 pb-2 text-sm print:pb-1 print:text-[9px]"><span className="text-white/65">{label}</span><span className="text-right font-extrabold text-white">{value}</span></div>)}</div>
            </div>

            <div className="rounded-[1.3rem] border border-slate-200 p-5 print:p-3">
              <h3 className="text-lg font-extrabold text-[#0B1633] print:text-sm">Investment Highlights</h3>
              <div className="mt-4 space-y-3 print:mt-2 print:space-y-1.5">
                {(highlights.length ? highlights : ['Zentral gepflegte Projektdaten', 'Klare wirtschaftliche Kennzahlen', 'Automatisierte Exposé-Erstellung']).map((item) => (
                  <div key={item} className="flex gap-3 text-sm text-slate-600 print:text-[9px]"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#5CB800] print:h-3 print:w-3" /><span>{item}</span></div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <footer className="mt-auto flex items-center justify-between border-t border-[#5CB800]/40 px-6 py-4 text-xs text-slate-500 md:px-8 print:px-7 print:py-2 print:text-[8px]">
          <div className="flex items-center gap-3"><img src="/ema-logo.jpeg" alt="EMA Enterprise GmbH" className="h-7 w-auto object-contain print:h-5" /><span>EMA Enterprise GmbH</span></div>
          <span className="font-semibold text-[#5CB800]">Connecting Capital with Energy Infrastructure.</span>
          <span>www.ema-enterprise.de</span>
        </footer>
      </article>
    </div>
  )
}
