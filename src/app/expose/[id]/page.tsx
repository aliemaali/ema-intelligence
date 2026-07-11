import Link from 'next/link'
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
import { getProject } from '@/lib/actions/project.actions'
import { PrintButton } from '@/components/expose/PrintButton'

export const dynamic = 'force-dynamic'

function number(value: unknown, digits = 0) {
  const n = Number(value)
  return Number.isFinite(n)
    ? new Intl.NumberFormat('de-DE', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(n)
    : '—'
}

function money(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n)
    ? new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
      }).format(n)
    : '—'
}

function value(project: any, keys: string[]) {
  for (const key of keys) {
    const current = project?.[key]
    if (current !== null && current !== undefined && current !== '') return current
  }
  return null
}

function typeLabel(type?: string | null) {
  if (type === 'pv_freiflaeche') return 'PV-Freiflächenprojekt'
  if (type === 'pv_dach') return 'PV-Dachprojekt'
  if (type === 'bess') return 'Batteriespeicherprojekt'
  if (type === 'hybrid') return 'PV- & BESS-Hybridprojekt'
  return 'Energieinfrastrukturprojekt'
}

function tariffDisplay(raw: unknown) {
  const n = Number(raw)
  if (!Number.isFinite(n)) return '—'
  if (n <= 1) return `${number(n, 3)} €/kWh`
  return `${number(n, 2)} ct/kWh`
}

export default async function InvestmentMemorandumPage({ params }: { params: { id: string } }) {
  const project: any = await getProject(params.id)
  const pvKwp = value(project, ['pv_kwp', 'pv_mwp', 'capacity_kwp', 'capacity_mwp'])
  const bessMwh = value(project, ['bess_mwh', 'storage_capacity_mwh'])
  const purchasePrice = value(project, ['purchase_price', 'total_purchase_price', 'deal_purchase_price'])
  const tariff = value(project, ['feed_in_tariff', 'tariff', 'tariff_ct_kwh', 'vergütung'])
  const specificYield = value(project, ['specific_yield', 'specific_yield_kwh_kwp', 'spezifischer_ertrag'])
  const annualYield = value(project, ['annual_yield_kwh', 'annual_energy_kwh'])
  const amortisation = value(project, ['amortisation_years', 'payback_years'])
  const location = [project.location_city, project.location_state].filter(Boolean).join(', ') || 'Deutschland'
  const isPv = project.project_type !== 'bess'
  const dateLabel = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(new Date())

  const metrics = [
    {
      icon: isPv ? Zap : BatteryCharging,
      label: isPv ? 'Installierte Leistung' : 'Speicherkapazität',
      value: isPv ? `${number(pvKwp, 2)} kWp` : `${number(bessMwh, 2)} MWh`,
    },
    { icon: BadgeEuro, label: 'Kaufpreis', value: money(purchasePrice) },
    {
      icon: SunMedium,
      label: 'Spezifischer Ertrag',
      value: specificYield ? `${number(specificYield)} kWh/kWp` : 'Noch offen',
    },
    { icon: Gauge, label: 'Vergütung', value: tariffDisplay(tariff) },
    {
      icon: CalendarDays,
      label: 'Amortisation',
      value: amortisation ? `${number(amortisation, 1)} Jahre` : 'Noch offen',
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
        <section className="relative overflow-hidden bg-[#07142F] text-white print:min-h-[277mm] print:break-after-page">
          <div className="flex items-center justify-between border-b border-white/10 bg-[#07142F]/95 px-6 py-5 md:px-10">
            <img src="/ema-logo.jpeg" alt="EMA Enterprise" className="h-14 w-auto rounded-xl bg-white p-1.5 object-contain md:h-16" />
            <div className="flex items-center gap-5 text-sm font-bold text-white/80"><span>{dateLabel}</span><span className="rounded-full border border-white/20 px-4 py-2 text-[#87D33B]">Vertraulich</span></div>
          </div>

          <div className="relative min-h-[640px]">
            <img src="/ema-pv-freiflaeche-default.svg" alt="PV-Projektvisualisierung" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#07142F]/95 via-[#07142F]/68 to-[#07142F]/15" />
            <div className="absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-[#07142F] via-[#07142F]/60 to-transparent" />

            <div className="relative flex min-h-[640px] flex-col justify-between px-6 py-8 md:px-10 md:py-10">
              <div><span className="inline-flex rounded-full bg-[#07142F]/75 px-4 py-2 text-xs font-extrabold uppercase tracking-[.18em] text-[#87D33B] ring-1 ring-white/15">Investment Memorandum</span></div>
              <div className="max-w-4xl pb-5">
                <p className="text-sm font-extrabold uppercase tracking-[.25em] text-[#87D33B]">EMA Intelligence</p>
                <h1 className="mt-4 text-5xl font-extrabold leading-[.95] tracking-[-.04em] md:text-7xl">{project.project_name}</h1>
                <p className="mt-5 text-2xl font-bold text-white/90 md:text-3xl">{typeLabel(project.project_type)}</p>
                <div className="mt-7 flex items-center gap-3 text-lg font-semibold text-white/85"><MapPin className="h-6 w-6 text-[#87D33B]" /> {location}</div>
                <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-white/65"><span>Projekt-Nr. {project.project_number || '—'}</span><span>Stand: {dateLabel}</span></div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 py-8 md:px-10 md:py-10 print:min-h-[277mm] print:break-after-page">
          <div className="border-b border-slate-200 pb-5"><p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#5CB800]">Executive Summary</p><h2 className="mt-2 text-3xl font-extrabold text-[#0B1633]">Investment auf einen Blick</h2></div>
          <p className="mt-6 max-w-4xl text-base leading-7 text-slate-600">{project.project_name} ist ein {typeLabel(project.project_type).toLowerCase()} am Standort {location}. Dieses Memorandum bündelt ausschließlich vorhandene oder berechenbare Projektdaten und stellt sie in einer institutionell lesbaren Form dar.</p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {metrics.map(({ icon: Icon, label, value: metricValue }) => (
              <div key={label} className="rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F1F9E8] text-[#3D9200]"><Icon className="h-5 w-5" /></div>
                <p className="mt-4 text-[11px] font-extrabold uppercase tracking-[.12em] text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-extrabold leading-tight text-[#0B1633]">{metricValue}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-[1.6rem] border border-slate-200 p-6">
              <h3 className="text-lg font-extrabold text-[#0B1633]">Projektübersicht</h3>
              <div className="mt-5 space-y-3">{[
                ['Projekttyp', typeLabel(project.project_type)],
                ['Standort', location],
                ['Bundesland', project.location_state || '—'],
                ['Projektstatus', project.status || '—'],
                ['Priorität', project.priority || '—'],
                ['Netzanschluss', project.grid_connection_status || project.netzanschluss || 'Zu prüfen'],
                ['Vermarktungsmodell', project.feed_in_type || project.marketing_status || '—'],
              ].map(([label, val]) => <div key={label} className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 text-sm"><span className="font-semibold text-slate-500">{label}</span><span className="text-right font-extrabold text-[#0B1633]">{val}</span></div>)}</div>
            </div>

            <div className="rounded-[1.6rem] border border-slate-200 p-6">
              <h3 className="text-lg font-extrabold text-[#0B1633]">Standort Highlights</h3>
              <div className="mt-5 rounded-[1.2rem] bg-[#F7FCEB] p-5">
                <div className="flex items-center gap-3"><MapPin className="h-7 w-7 text-[#5CB800]" /><div><p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#5CB800]">Projektstandort</p><p className="mt-1 text-xl font-extrabold text-[#0B1633]">{location}</p></div></div>
              </div>
              <div className="mt-5 space-y-4">{[
                'Standortbasierte Ertragsanalyse vorbereitet',
                specificYield ? `Spezifischer Ertrag: ${number(specificYield)} kWh/kWp` : 'Spezifischer Ertrag noch offen',
                'Projekt- und Wirtschaftsdaten zentral synchronisiert',
                'Investorengerechte Dokumentenstruktur',
              ].map(item => <div key={item} className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#5CB800]" /><p className="text-sm leading-6 text-slate-600">{item}</p></div>)}</div>
            </div>
          </div>

          <div className="mt-7 rounded-[1.4rem] border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-600"><strong className="text-[#0B1633]">Hinweis:</strong> Fehlende Werte werden bewusst als offen ausgewiesen und nicht durch Annahmen ersetzt.</div>
        </section>

        <section className="px-6 py-8 md:px-10 md:py-10 print:min-h-[277mm] print:break-after-page">
          <div className="border-b border-slate-200 pb-5"><p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#5CB800]">02</p><h2 className="mt-2 text-3xl font-extrabold text-[#0B1633]">Wirtschaftlichkeit & Ertrag</h2></div>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-[1.7rem] bg-[#0B1633] p-7 text-white">
              <h3 className="text-xl font-extrabold">Vergütung & Ertrag</h3>
              <div className="mt-6 space-y-5">{[
                ['Vergütung', tariffDisplay(tariff)],
                ['Spezifischer Ertrag', specificYield ? `${number(specificYield)} kWh/kWp` : 'Noch offen'],
                ['Jährlicher Ertrag', annualYield ? `${number(annualYield)} kWh` : 'Noch offen'],
                ['Kaufpreis', money(purchasePrice)],
              ].map(([label, val]) => <div key={label} className="flex items-end justify-between gap-4 border-b border-white/10 pb-4"><span className="text-sm font-bold text-white/60">{label}</span><span className="text-xl font-extrabold text-[#87D33B]">{val}</span></div>)}</div>
            </div>

            <div className="rounded-[1.7rem] border border-slate-200 p-7">
              <h3 className="text-xl font-extrabold text-[#0B1633]">Amortisationsanalyse</h3>
              <div className="mt-8 flex h-56 items-end gap-3">{[12,20,30,42,55,68,82,100].map((height, i) => <div key={i} className="flex-1 rounded-t-lg bg-gradient-to-t from-[#0B1633] to-[#5CB800]" style={{ height: `${height}%` }} />)}</div>
              <div className="mt-3 flex justify-between text-[10px] font-bold text-slate-400"><span>Start</span><span>{amortisation ? `Break-even ca. ${number(amortisation, 1)} Jahre` : 'Berechnung nach Datenergänzung'}</span></div>
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
