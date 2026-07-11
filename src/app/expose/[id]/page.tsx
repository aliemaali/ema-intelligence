import Link from 'next/link'
import { ArrowLeft, BadgeEuro, BatteryCharging, CalendarDays, CheckCircle2, Gauge, MapPin, ShieldCheck, SunMedium, Zap } from 'lucide-react'
import { getProject } from '@/lib/actions/project.actions'
import { PrintButton } from '@/components/expose/PrintButton'

export const dynamic = 'force-dynamic'

function number(value: unknown, digits = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? new Intl.NumberFormat('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n) : '—'
}
function money(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n) : '—'
}
function value(project: any, keys: string[]) {
  for (const key of keys) if (project?.[key] !== null && project?.[key] !== undefined && project?.[key] !== '') return project[key]
  return null
}
function typeLabel(type?: string | null) {
  if (type === 'pv_freiflaeche') return 'PV-Freiflächenprojekt'
  if (type === 'pv_dach') return 'PV-Dachprojekt'
  if (type === 'bess') return 'Batteriespeicherprojekt'
  if (type === 'hybrid') return 'PV- & BESS-Hybridprojekt'
  return 'Energieinfrastrukturprojekt'
}

export default async function InvestmentMemorandumPage({ params }: { params: { id: string } }) {
  const project: any = await getProject(params.id)
  const pvMwp = value(project, ['pv_mwp', 'capacity_mwp'])
  const bessMwh = value(project, ['bess_mwh', 'storage_capacity_mwh'])
  const purchasePrice = value(project, ['purchase_price', 'total_purchase_price', 'deal_purchase_price'])
  const tariff = value(project, ['feed_in_tariff', 'tariff_ct_kwh', 'vergütung'])
  const specificYield = value(project, ['specific_yield', 'specific_yield_kwh_kwp', 'spezifischer_ertrag'])
  const annualYield = value(project, ['annual_yield_kwh', 'annual_energy_kwh'])
  const amortisation = value(project, ['amortisation_years', 'payback_years'])
  const location = [project.location_city, project.location_state].filter(Boolean).join(', ') || 'Deutschland'
  const isPv = project.project_type !== 'bess'

  const metrics = [
    { icon: isPv ? Zap : BatteryCharging, label: isPv ? 'Installierte Leistung' : 'Speicherkapazität', value: isPv ? `${number(pvMwp, 2)} MWp` : `${number(bessMwh, 2)} MWh` },
    { icon: BadgeEuro, label: 'Kaufpreis', value: money(purchasePrice) },
    { icon: SunMedium, label: 'Spezifischer Ertrag', value: specificYield ? `${number(specificYield)} kWh/kWp` : 'Noch offen' },
    { icon: Gauge, label: 'Amortisation', value: amortisation ? `${number(amortisation, 1)} Jahre` : 'Noch offen' },
  ]

  return (
    <div className="min-h-screen bg-[#EEF2F5] pb-28 print:bg-white print:pb-0">
      <div className="print:hidden mx-auto flex max-w-[1480px] items-center justify-between gap-4 px-4 py-5 md:px-8">
        <Link href="/expose" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-[#0B1633] shadow-sm"><ArrowLeft className="h-4 w-4" /> Zurück</Link>
        <PrintButton />
      </div>

      <article className="mx-auto max-w-[1180px] overflow-hidden bg-white shadow-2xl print:max-w-none print:shadow-none">
        <section className="relative min-h-[620px] overflow-hidden bg-[#0B1633] text-white print:min-h-[277mm] print:break-after-page">
          <img src="/ema-pv-freiflaeche-default.svg" alt="Premium Visualisierung einer PV-Freiflächenanlage" className="absolute inset-0 h-full w-full object-cover opacity-90" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#07142F] via-[#07142F]/88 to-[#07142F]/15" />
          <div className="relative flex min-h-[620px] flex-col justify-between p-7 md:p-12 print:min-h-[277mm] print:p-12">
            <div className="flex items-start justify-between gap-6">
              <img src="/ema-logo.jpeg" alt="EMA Enterprise" className="h-20 w-auto rounded-xl bg-white/95 object-contain p-2 md:h-24" />
              <div className="text-right"><p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#87D33B]">Vertraulich</p><p className="mt-2 text-sm font-bold text-white/80">{new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(new Date())}</p></div>
            </div>
            <div className="max-w-3xl py-16">
              <p className="text-sm font-extrabold uppercase tracking-[.24em] text-[#87D33B]">Investment Memorandum</p>
              <h1 className="mt-5 text-5xl font-extrabold leading-[1.02] tracking-tight md:text-7xl">{project.project_name}</h1>
              <p className="mt-5 text-2xl font-bold text-white/90">{typeLabel(project.project_type)}</p>
              <div className="mt-7 flex items-center gap-3 text-lg font-semibold text-white/80"><MapPin className="h-6 w-6 text-[#87D33B]" /> {location}</div>
            </div>
            <div className="grid gap-px overflow-hidden rounded-2xl bg-white/20 backdrop-blur md:grid-cols-4">
              {metrics.map(({ icon: Icon, label, value: metricValue }) => <div key={label} className="bg-[#07142F]/75 p-5"><Icon className="h-6 w-6 text-[#87D33B]" /><p className="mt-4 text-xs font-bold uppercase tracking-wider text-white/60">{label}</p><p className="mt-1 text-xl font-extrabold">{metricValue}</p></div>)}
            </div>
          </div>
        </section>

        <section className="p-7 md:p-12 print:min-h-[277mm] print:break-after-page print:p-12">
          <div className="flex items-center justify-between border-b border-slate-200 pb-5"><div><p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#5CB800]">01</p><h2 className="mt-1 text-3xl font-extrabold text-[#0B1633]">Executive Summary</h2></div><span className="rounded-full bg-[#F1F9E8] px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-[#4C9800]">{project.project_number || 'Projekt'}</span></div>
          <p className="mt-8 max-w-4xl text-lg leading-8 text-slate-600">EMA Intelligence präsentiert mit <strong className="text-[#0B1633]">{project.project_name}</strong> ein {typeLabel(project.project_type).toLowerCase()} am Standort {location}. Das Projekt wird auf Basis der zentral gespeicherten Projekt-, Standort- und Wirtschaftlichkeitsdaten bewertet. Nicht vorhandene Werte bleiben bewusst offen und werden nicht künstlich ergänzt.</p>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {[['Projektstatus', project.status || 'Nicht hinterlegt'], ['Standort', location], ['Projektart', typeLabel(project.project_type)], ['Priorität', project.priority || 'Nicht hinterlegt'], ['Vergütung', tariff ? `${number(tariff, 2)} ct/kWh` : 'Noch nicht hinterlegt'], ['Jahresertrag', annualYield ? `${number(annualYield)} kWh` : 'Noch nicht hinterlegt']].map(([label, val]) => <div key={label} className="rounded-2xl border border-slate-200 bg-[#FAFBFC] p-5"><p className="text-xs font-extrabold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-2 text-lg font-extrabold text-[#0B1633]">{val}</p></div>)}
          </div>
          <div className="mt-10 rounded-[2rem] bg-[#0B1633] p-7 text-white"><h3 className="text-xl font-extrabold">Investment Highlights</h3><div className="mt-6 grid gap-4 md:grid-cols-2">{['Zentrale, konsistente Projektdaten ohne doppelte Datenhaltung', project.status ? `Aktueller Projektstatus: ${project.status}` : 'Projektstatus wird zentral gepflegt', specificYield ? `Spezifischer Ertrag: ${number(specificYield)} kWh/kWp` : 'Standortbasierte Ertragsanalyse vorbereitet', 'Automatisierte Erstellung institutioneller Projektunterlagen', 'Nachvollziehbare technische und wirtschaftliche Kennzahlen', 'EMA Premium-Design für Investoren und Projektpartner'].map(item => <div key={item} className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#87D33B]" /><p className="text-sm leading-6 text-slate-200">{item}</p></div>)}</div></div>
        </section>

        <section className="p-7 md:p-12 print:min-h-[277mm] print:break-after-page print:p-12">
          <div className="border-b border-slate-200 pb-5"><p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#5CB800]">02</p><h2 className="mt-1 text-3xl font-extrabold text-[#0B1633]">Projektübersicht & Standort</h2></div>
          <div className="mt-8 grid gap-6 lg:grid-cols-[.85fr_1.15fr]">
            <div className="space-y-3">{[['Projektname', project.project_name], ['Projektnummer', project.project_number], ['Standort', location], ['Land', project.location_country || 'Deutschland'], ['PV-Leistung', pvMwp ? `${number(pvMwp, 2)} MWp` : '—'], ['BESS-Kapazität', bessMwh ? `${number(bessMwh, 2)} MWh` : '—']].map(([label, val]) => <div key={label} className="flex items-center justify-between gap-4 border-b border-slate-100 py-3"><span className="text-sm font-bold text-slate-500">{label}</span><span className="text-right text-sm font-extrabold text-[#0B1633]">{val || '—'}</span></div>)}</div>
            <div className="overflow-hidden rounded-[1.75rem] border border-slate-200"><img src="/ema-pv-freiflaeche-default.svg" alt="Projektvisualisierung" className="h-full min-h-[360px] w-full object-cover" /></div>
          </div>
          <div className="mt-8 rounded-2xl border border-[#5CB800]/20 bg-[#F7FCEB] p-5 text-sm leading-6 text-slate-600"><strong className="text-[#0B1633]">Bildhinweis:</strong> Da aktuell keine eigenen Projektfotos hinterlegt sind, verwendet EMA Intelligence automatisch ein hochwertiges, neutrales Projektmotiv. Sobald echte Bilder vorhanden sind, können sie dieses Motiv ersetzen.</div>
        </section>

        <section className="p-7 md:p-12 print:min-h-[277mm] print:break-after-page print:p-12">
          <div className="border-b border-slate-200 pb-5"><p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#5CB800]">03</p><h2 className="mt-1 text-3xl font-extrabold text-[#0B1633]">Wirtschaftlichkeit</h2></div>
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">{metrics.map(({ icon: Icon, label, value: metricValue }) => <div key={label} className="rounded-[1.5rem] border border-slate-200 p-5"><Icon className="h-7 w-7 text-[#5CB800]" /><p className="mt-5 text-xs font-extrabold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-2 text-2xl font-extrabold text-[#0B1633]">{metricValue}</p></div>)}</div>
          <div className="mt-8 grid gap-6 lg:grid-cols-2"><div className="rounded-[1.75rem] bg-[#0B1633] p-7 text-white"><h3 className="text-xl font-extrabold">Vergütung & Ertrag</h3><div className="mt-6 space-y-5">{[['Vergütung', tariff ? `${number(tariff, 2)} ct/kWh` : 'Noch offen'], ['Spezifischer Ertrag', specificYield ? `${number(specificYield)} kWh/kWp` : 'Noch offen'], ['Jährlicher Ertrag', annualYield ? `${number(annualYield)} kWh` : 'Noch offen']].map(([label, val]) => <div key={label} className="flex items-end justify-between gap-4 border-b border-white/10 pb-4"><span className="text-sm font-bold text-white/60">{label}</span><span className="text-xl font-extrabold text-[#87D33B]">{val}</span></div>)}</div></div><div className="rounded-[1.75rem] border border-slate-200 p-7"><h3 className="text-xl font-extrabold text-[#0B1633]">Amortisationsanalyse</h3><div className="mt-8 flex h-56 items-end gap-3">{[12,20,30,42,55,68,82,100].map((height, i) => <div key={i} className="flex-1 rounded-t-lg bg-gradient-to-t from-[#0B1633] to-[#5CB800]" style={{ height: `${height}%` }} />)}</div><div className="mt-3 flex justify-between text-[10px] font-bold text-slate-400"><span>Start</span><span>{amortisation ? `Break-even ca. ${number(amortisation, 1)} Jahre` : 'Berechnung nach Datenergänzung'}</span></div></div></div>
        </section>

        <section className="p-7 md:p-12 print:min-h-[277mm] print:p-12">
          <div className="border-b border-slate-200 pb-5"><p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#5CB800]">04</p><h2 className="mt-1 text-3xl font-extrabold text-[#0B1633]">Risiken, Hinweise & Ansprechpartner</h2></div>
          <div className="mt-8 grid gap-6 lg:grid-cols-2"><div className="rounded-[1.75rem] border border-slate-200 p-7"><ShieldCheck className="h-9 w-9 text-[#5CB800]" /><h3 className="mt-5 text-xl font-extrabold text-[#0B1633]">Risikodarstellung</h3><div className="mt-6 space-y-4">{['Genehmigungs- und Planungsrisiken', 'Netzanschlussrisiken', 'Bau- und Lieferkettenrisiken', 'Ertrags- und Betriebsrisiken', 'Markt- und Regulierungsrisiken'].map(item => <div key={item} className="flex items-center justify-between gap-4"><span className="text-sm font-bold text-slate-600">{item}</span><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-extrabold text-amber-700">Zu prüfen</span></div>)}</div></div><div className="rounded-[1.75rem] bg-[#0B1633] p-7 text-white"><p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#87D33B]">Ihr Ansprechpartner</p><h3 className="mt-4 text-3xl font-extrabold">Ali Ünlüer</h3><p className="mt-2 font-bold text-white/70">Managing Director · EMA Enterprise GmbH</p><div className="mt-8 space-y-4 text-sm text-slate-200"><p className="flex items-center gap-3"><CalendarDays className="h-5 w-5 text-[#87D33B]" /> Persönliche Projektbesprechung nach Vereinbarung</p><p className="flex items-center gap-3"><MapPin className="h-5 w-5 text-[#87D33B]" /> Deutschland</p></div></div></div>
          <div className="mt-10 border-t border-slate-200 pt-6 text-xs leading-5 text-slate-400">Dieses Investment Memorandum wird automatisiert aus den in EMA Intelligence gespeicherten Projektdaten erzeugt und dient ausschließlich Informationszwecken. Fehlende Daten werden als offen gekennzeichnet. Vor einer Investitionsentscheidung sind sämtliche technischen, rechtlichen und wirtschaftlichen Angaben eigenständig zu prüfen.</div>
        </section>
      </article>
    </div>
  )
}
