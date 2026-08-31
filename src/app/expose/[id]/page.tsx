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
  Coins,
  Euro,
  FileText,
  Globe2,
  Mail,
  MapPin,
  Network,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PrintButton } from '@/components/expose/PrintButton'
import { getExposePresentation } from '@/lib/expose/projectPresentation'
import { mergeProjectEconomicSources, resolvePvEconomics } from '@/lib/projects/pv-units'

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

function stageLabel(raw: unknown) {
  if (raw === 'rtb') return 'RTB'
  if (raw === 'betrieb') return 'Im Betrieb'
  return raw ? 'In Planung' : ''
}

function metricIcon(label: string) {
  const key = label.toLowerCase()
  if (key.includes('amort')) return Clock3
  if (key.includes('kaufpreis') || key.includes('investitions')) return Building2
  if (key.includes('vergütung')) return Coins
  if (key.includes('kapazität')) return BatteryCharging
  if (key.includes('netzanschluss')) return Network
  if (key.includes('ertrag')) return TrendingUp
  if (key.includes('leistung')) return Zap
  return BarChart3
}

async function loadProjectData(projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).eq('user_id', user.id).single()
  if (!project) return null

  const { data: deal } = await supabase.from('deals').select('*').eq('project_id', projectId).eq('user_id', user.id).eq('is_active', true).maybeSingle()
  const optionalData: Record<string, unknown>[] = []

  for (const table of ['project_financials', 'project_economics', 'capex_calculations']) {
    const { data } = await (supabase as any).from(table).select('*').eq('project_id', projectId).order('updated_at', { ascending: false }).limit(1).maybeSingle()
    if (data) optionalData.push(data)
  }

  return mergeProjectEconomicSources(
    project as unknown as Record<string, unknown>,
    deal as unknown as Record<string, unknown> | null,
    optionalData,
  )
}

export default async function InvestmentMemorandumPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const project = await loadProjectData(params.id)
  if (!project) notFound()

  const country = String(project.location_country || 'Deutschland')
  const countryFlag = flagUrl(country)
  const location = [project.location_city, project.location_state].filter(Boolean).join(', ') || country
  const dateLabel = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(new Date())
  const economics = resolvePvEconomics(project)
  const purchasePrice = economics.purchasePrice
  const pvKwp = economics.pvKwp
  const specificYield = economics.specificYieldKwhPerKwp
  const tariff = economics.tariffEurKwh
  const price = economics.purchasePrice ?? 0
  const tariffEur = economics.tariffEurKwh
  const annualYield = economics.annualYieldKwh
  const displaySpecificYield = economics.specificYieldKwhPerKwp
  const annualRevenue = economics.annualRevenue
  const amortisation = economics.amortisationYears
  const roi = economics.roiPercent

  const presentation = getExposePresentation({
    ...project,
    purchase_price: purchasePrice,
    pv_kwp: pvKwp,
    specific_yield: displaySpecificYield,
    feed_in_tariff: tariff,
    amortisation_years: amortisation,
  }, location, { number: formatNumber, money: formatMoney, tariff: tariffDisplay })

  const status = stageLabel(project.project_stage)
  const metrics = presentation.metrics.filter((item) => item.value && item.value !== '—' && !item.label.toLowerCase().includes('pachtdauer')).slice(0, 5)
  const economicCards = [
    annualYield ? { label: 'Jahresproduktion', value: `${formatNumber(annualYield)} kWh`, icon: Zap } : null,
    annualRevenue ? { label: 'Jahreserlös', value: formatMoney(annualRevenue), icon: Euro } : null,
    price > 0 ? { label: 'Kaufpreis', value: formatMoney(price), icon: Coins } : null,
    tariffEur ? { label: 'Vergütung', value: `${formatNumber(tariffEur, 3)} €/kWh`, icon: FileText } : null,
    roi ? { label: 'Rendite p.a.', value: `${formatNumber(roi, 2)} %`, icon: TrendingUp } : null,
    amortisation ? { label: 'Amortisation', value: `${formatNumber(amortisation, 1)} Jahre`, icon: Clock3 } : null,
  ].filter(Boolean) as Array<{ label: string; value: string; icon: typeof Zap }>

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
    dataCenterDetails: presentation.dataCenterDetails,
    bessPortfolioDetails: presentation.bessPortfolioDetails,
    heroImage: '/pdf/hero-solarpark.jpg',
    projectImage: presentation.heroImage,
    language: 'de' as const,
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

  const bars = [
    roi ? { label: 'Rendite p.a.', value: `${formatNumber(roi, 2)} %`, width: Math.min(100, Number(roi) * 7), icon: TrendingUp } : null,
    amortisation ? { label: 'Amortisation', value: `${formatNumber(amortisation, 1)} Jahre`, width: Math.max(15, 100 - Number(amortisation) * 4), icon: Clock3 } : null,
    annualRevenue ? { label: 'Jahreserlös', value: formatMoney(annualRevenue), width: price > 0 ? Math.min(100, Number(annualRevenue) / price * 700) : 65, icon: Euro } : null,
  ].filter(Boolean) as Array<{ label: string; value: string; width: number; icon: typeof Zap }>
  const hasSecondPage = Boolean(presentation.dataCenterDetails || presentation.bessPortfolioDetails)

  return (
    <div className="min-h-screen bg-[#edf1f4] pb-16 print:bg-white print:pb-0">
      <header className="print:hidden border-b border-slate-200 bg-white px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] shadow-sm md:px-8 md:py-4">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4">
          <Link href="/dashboard"><img src="/brand/ema-logo.png" alt="EMA Enterprise" className="h-14 w-auto" /></Link>
          <PrintButton data={pdfData} />
        </div>
      </header>
      <div className="print:hidden mx-auto flex max-w-[900px] px-4 py-4">
        <Link href="/expose" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-[#0B1633] shadow-sm"><ArrowLeft className="h-4 w-4" /> Zurück</Link>
      </div>

      <article className="memorandum-page mx-auto w-full max-w-[900px] overflow-hidden bg-white px-5 py-5 font-sans text-[#0B1633] shadow-[0_24px_70px_rgba(15,23,42,.16)] sm:px-7 sm:py-7 print:max-w-none print:shadow-none">
        <header className="flex items-start justify-between gap-6 pb-5">
          <img src="/brand/ema-logo.png" alt="EMA Enterprise GmbH" className="h-16 w-auto object-contain" />
          <div className="text-right">
            <h1 className="text-lg font-black tracking-[-.02em] sm:text-2xl">EXPOSÉ</h1>
            <p className="mt-2 text-[10px] font-extrabold uppercase tracking-[.06em] text-[#5CB800]">{String(project.project_number || '')}{project.project_number ? ' · ' : ''}{presentation.typeLabel}</p>
          </div>
        </header>

        <section className="relative min-h-[330px] overflow-hidden rounded-2xl bg-[#07162f] sm:min-h-[370px]">
          <img src={presentation.heroImage} alt={presentation.typeLabel} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#07162f] via-[#07162f]/92 to-transparent" />
          <div className="relative flex min-h-[330px] max-w-[56%] flex-col px-6 py-7 text-white sm:min-h-[370px] sm:px-8 sm:py-9">
            <div className="inline-flex w-fit rounded-lg bg-[#5CB800] px-5 py-2 text-[10px] font-black uppercase tracking-[.06em]">{presentation.typeLabel}</div>
            <h2 className="mt-8 text-4xl font-black leading-none tracking-[-.045em] sm:text-5xl">{String(project.project_name)}</h2>
            <div className="mt-8 h-1 w-16 rounded-full bg-[#5CB800]" />
            <div className="mt-auto flex items-center gap-3 text-sm font-bold leading-6">
              {countryFlag ? <img src={countryFlag} alt={country} className="h-5 w-8 rounded-sm object-cover" /> : <Globe2 className="h-5 w-5 text-[#5CB800]" />}
              <span>{location}<br />{country}{status ? ` · ${status}` : ''}</span>
            </div>
          </div>
        </section>

        {metrics.length > 0 && (
          <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {metrics.map((metric) => {
              const Icon = metricIcon(metric.label)
              const emphasis = metric.label.toLowerCase().includes('amort')
              const compactValue = metric.value.length > 13
              return (
                <div key={metric.label} className={`flex min-h-[150px] flex-col items-center justify-center rounded-2xl border px-3 py-5 text-center ${emphasis ? 'border-[#5CB800] bg-gradient-to-br from-[#72cf16] to-[#087032] text-white shadow-[0_12px_28px_rgba(49,137,38,.22)]' : 'border-slate-200 bg-white'}`}>
                  <Icon strokeWidth={1.8} className={`h-11 w-11 ${emphasis ? 'text-white' : 'text-[#2f841f]'}`} />
                  <p className={`mt-4 text-[10px] font-extrabold uppercase tracking-[.04em] ${emphasis ? 'text-white/90' : 'text-[#27334a]'}`}>{metric.label}</p>
                  <p className={`mt-2 max-w-full break-words font-black leading-tight ${compactValue ? 'text-base sm:text-lg' : 'text-xl'} ${emphasis ? 'text-white' : 'text-[#0B1633]'}`}>{metric.value}</p>
                </div>
              )
            })}
          </section>
        )}

        <section className="mt-8 grid gap-9 border-b border-slate-200 pb-7 md:grid-cols-2">
          <div>
            <SectionTitle>Executive Summary</SectionTitle>
            <p className="mt-5 max-w-md text-sm leading-6 text-[#27334a]">{presentation.summary}</p>
          </div>
          {presentation.profile.length > 0 && (
            <div>
              <SectionTitle>Projektprofil</SectionTitle>
              <div className="mt-3">
                {presentation.profile.filter((row) => row.value && row.value !== '—').slice(0, 5).map((row, index) => {
                  const ProfileIcon = index === 0 ? MapPin : index === 1 ? Building2 : index === 2 ? Network : index === 3 ? CalendarDays : Zap
                  return <div key={row.label} className="grid grid-cols-[22px_1fr_auto] items-center gap-3 border-b border-slate-200 py-2.5 text-xs"><ProfileIcon className="h-4 w-4 text-[#2f841f]" /><span className="text-[#4b5565]">{row.label}</span><strong className="text-right text-[#0B1633]">{row.value}</strong></div>
                })}
              </div>
            </div>
          )}
        </section>

        <section className={`grid gap-8 border-b border-slate-200 py-7 ${bars.length ? 'md:grid-cols-2' : ''}`}>
          {bars.length > 0 && <div>
            <SectionTitle>Visuelle Wirtschaftlichkeit</SectionTitle>
            <div className="mt-5 space-y-5">
              {bars.map((bar) => <div key={bar.label} className="grid grid-cols-[40px_1fr] gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white"><bar.icon className="h-5 w-5 text-[#2f841f]" /></div><div><div className="mb-1.5 flex justify-between text-xs"><span>{bar.label}</span><strong>{bar.value}</strong></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-gradient-to-r from-[#5CB800] to-[#2d8b18]" style={{ width: `${bar.width}%` }} /></div></div></div>)}
            </div>
          </div>}
          <div>
            <SectionTitle>Investment Highlights</SectionTitle>
            <div className="mt-4 space-y-2">
              {presentation.highlights.filter(Boolean).slice(0, 4).map((item) => <div key={item} className="flex items-center gap-3 rounded-xl border border-[#dce8d7] bg-[#fbfdf9] px-3 py-3 text-xs"><CheckCircle2 className="h-5 w-5 shrink-0 fill-[#1e7a32] text-white" /><span>{item}</span></div>)}
            </div>
          </div>
        </section>

        {economicCards.length > 0 && (
          <section className="pt-6">
            <SectionTitle>Wirtschaftliche Kennzahlen</SectionTitle>
            <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-2xl border border-slate-200 sm:grid-cols-3">
              {economicCards.map((item) => <div key={item.label} className="flex min-h-[92px] items-center gap-3 border-b border-r border-slate-200 px-4 py-3 last:border-r-0"><item.icon className="h-8 w-8 shrink-0 text-[#2f841f]" /><div><p className="text-[9px] font-extrabold uppercase tracking-[.04em] text-[#4b5565]">{item.label}</p><p className="mt-1 text-lg font-black leading-tight">{item.value}</p></div></div>)}
            </div>
          </section>
        )}

        <footer className="mt-6 grid items-center gap-4 border-t border-[#5CB800] pt-4 text-[9px] text-[#4b5565] sm:grid-cols-[1.3fr_1fr_1fr_auto]">
          <div className="flex items-center gap-3"><Building2 className="h-6 w-6 text-[#0B1633]" /><span>EMA Enterprise GmbH<br />Gabriel-von-Seidl-Str. 56<br />67550 Worms</span></div>
          <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-[#0B1633]" />info@ema-enterprise.de</div>
          <div className="flex items-center gap-2"><Globe2 className="h-4 w-4 text-[#0B1633]" />www.ema-enterprise.de</div>
          <div className="text-right">{String(project.project_number || '')}<br />{hasSecondPage ? 'Seite 1 / 2' : dateLabel}</div>
        </footer>
      </article>

      {presentation.bessPortfolioDetails && (
        <article className="memorandum-page mx-auto mt-8 w-full max-w-[900px] bg-white px-5 py-5 font-sans text-[#0B1633] shadow-[0_24px_70px_rgba(15,23,42,.16)] sm:px-7 sm:py-7 print:mt-0 print:max-w-none print:break-before-page print:shadow-none">
          <header className="flex items-start justify-between gap-6 border-b border-slate-200 pb-5">
            <div className="flex items-center gap-4"><img src="/brand/ema-logo.png" alt="EMA Enterprise GmbH" className="h-12 w-auto object-contain" /><div><p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#5CB800]">BESS-Portfolio · Standortübersicht</p><h2 className="mt-1 text-2xl font-black tracking-[-.03em]">Ein Paket, vier Standortprüfungen</h2></div></div>
            <div className="text-right text-[10px] font-bold uppercase tracking-[.08em] text-slate-500">{String(project.project_number || '')}<br />{dateLabel}</div>
          </header>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <PortfolioKpi label="Standorte" value={String(presentation.bessPortfolioDetails.siteCount)} />
            <PortfolioKpi label="Leistung" value={`${formatNumber(presentation.bessPortfolioDetails.totalMw, 2)} MW`} />
            <PortfolioKpi label="Kapazität" value={`${formatNumber(presentation.bessPortfolioDetails.totalMwh, 2)} MWh`} />
            <PortfolioKpi label="Ø Dauer" value={presentation.bessPortfolioDetails.averageDurationH ? `${formatNumber(presentation.bessPortfolioDetails.averageDurationH, 2)} h` : '—'} />
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {presentation.bessPortfolioDetails.sites.map((site) => <section key={site.name} className="overflow-hidden rounded-2xl border border-slate-200"><div className="flex items-start justify-between gap-3 bg-[#0B1633] px-4 py-3 text-white"><div><h3 className="font-black">{site.name}</h3><p className="mt-1 text-xs text-white/65">{site.state || 'Deutschland'}</p></div><BatteryCharging className="h-6 w-6 text-[#72cf16]" /></div><div className="p-4"><div className="grid grid-cols-3 gap-2 text-center"><MiniMetric label="MW" value={site.mw} /><MiniMetric label="MWh" value={site.mwh} /><MiniMetric label="Dauer" value={site.durationH} suffix="h" /></div><div className="mt-3 space-y-2 text-xs"><SiteRow label="Netz" value={[site.gridOperator, site.gridStatus].filter(Boolean).join(' · ')} /><SiteRow label="Fläche" value={site.landStatus} /><SiteRow label="Genehmigung" value={site.permitStatus} warning /></div></div></section>)}
          </div>
          <div className="mt-6 rounded-2xl bg-[#0B1633] px-5 py-4 text-xs leading-5 text-white/80"><strong className="text-white">Hinweis:</strong> Das Portfolio wird gemeinsam vermarktet. Die Angaben basieren auf Partnerunterlagen und sind je Standort im Rahmen der technischen, rechtlichen, steuerlichen und wirtschaftlichen Due Diligence zu bestätigen.</div>
          <footer className="mt-7 grid items-center gap-4 border-t border-[#5CB800] pt-4 text-[9px] text-[#4b5565] sm:grid-cols-[1.3fr_1fr_1fr_auto]"><div className="flex items-center gap-3"><Building2 className="h-6 w-6 text-[#0B1633]" /><span>EMA Enterprise GmbH<br />Gabriel-von-Seidl-Str. 56<br />67550 Worms</span></div><div className="flex items-center gap-2"><Mail className="h-4 w-4 text-[#0B1633]" />info@ema-enterprise.de</div><div className="flex items-center gap-2"><Globe2 className="h-4 w-4 text-[#0B1633]" />www.ema-enterprise.de</div><div className="text-right">{String(project.project_number || '')}<br />Seite 2 / 2</div></footer>
        </article>
      )}

      {presentation.dataCenterDetails && (
        <article className="memorandum-page mx-auto mt-8 w-full max-w-[900px] bg-white px-5 py-5 font-sans text-[#0B1633] shadow-[0_24px_70px_rgba(15,23,42,.16)] sm:px-7 sm:py-7 print:mt-0 print:max-w-none print:break-before-page print:shadow-none">
          <header className="flex items-start justify-between gap-6 border-b border-slate-200 pb-5">
            <div className="flex items-center gap-4">
              <img src="/brand/ema-logo.png" alt="EMA Enterprise GmbH" className="h-12 w-auto object-contain" />
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#5CB800]">Rechenzentrum · Standortdaten</p>
                <h2 className="mt-1 text-2xl font-black tracking-[-.03em]">Standortprüfung</h2>
              </div>
            </div>
            <div className="text-right text-[10px] font-bold uppercase tracking-[.08em] text-slate-500">
              {String(project.project_number || '')}<br />
              {presentation.dataCenterDetails.sourceDate ? `Prüfstand ${presentation.dataCenterDetails.sourceDate}` : dateLabel}
            </div>
          </header>

          <div className="mt-6 rounded-2xl border border-[#dce8d7] bg-[#f8fbf5] px-5 py-4 text-sm leading-6 text-[#27334a]">
            Die folgenden Angaben stammen aus den hinterlegten Standort- und Prüfdaten. Nicht belegte Werte werden ausdrücklich als „Nicht bekannt“ oder „Muss geprüft werden“ ausgewiesen.
          </div>

          <div className="mt-6 grid items-start gap-5 md:grid-cols-2">
            {presentation.dataCenterDetails.sections.map((section, sectionIndex) => (
              <section key={section.title} className={`overflow-hidden rounded-2xl border border-slate-200 bg-white ${sectionIndex === 4 ? 'md:col-span-2' : ''}`}>
                <div className="border-b border-slate-200 bg-[#0B1633] px-5 py-3 text-sm font-black uppercase tracking-[.05em] text-white">
                  <span className="mr-2 text-[#72cf16]">●</span>{section.title}
                </div>
                <div className={sectionIndex === 4 ? 'grid px-5 md:grid-cols-2 md:gap-x-6' : 'px-5'}>
                  {section.rows.map((row) => {
                    const pending = row.value === 'Nicht bekannt' || row.value === 'Muss geprüft werden' || row.value === 'Nicht vorhanden'
                    return <div key={`${section.title}-${row.label}`} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-4 border-b border-slate-100 py-3 text-xs last:border-b-0"><span className="text-slate-500">{row.label}</span><strong className={`text-right leading-5 ${pending ? 'text-amber-700' : 'text-[#0B1633]'}`}>{row.value}</strong></div>
                  })}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-6 rounded-2xl bg-[#0B1633] px-5 py-4 text-xs leading-5 text-white/80">
            <strong className="text-white">Hinweis:</strong> Die Angaben dienen der ersten Standortbewertung. Technische Verfügbarkeit, Genehmigungsfähigkeit, Grundstückssicherung und Telekommunikationsanbindung sind im Rahmen der Due Diligence zu bestätigen.
          </div>

          <footer className="mt-7 grid items-center gap-4 border-t border-[#5CB800] pt-4 text-[9px] text-[#4b5565] sm:grid-cols-[1.3fr_1fr_1fr_auto]">
            <div className="flex items-center gap-3"><Building2 className="h-6 w-6 text-[#0B1633]" /><span>EMA Enterprise GmbH<br />Gabriel-von-Seidl-Str. 56<br />67550 Worms</span></div>
            <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-[#0B1633]" />info@ema-enterprise.de</div>
            <div className="flex items-center gap-2"><Globe2 className="h-4 w-4 text-[#0B1633]" />www.ema-enterprise.de</div>
            <div className="text-right">{String(project.project_number || '')}<br />Seite 2 / 2</div>
          </footer>
        </article>
      )}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div><h3 className="text-sm font-black uppercase tracking-[-.01em] text-[#0B1633]">{children}</h3><div className="mt-1 h-0.5 w-14 bg-[#5CB800]" /></div>
}

function PortfolioKpi({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 border-l-4 border-l-[#5CB800] bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-xl font-black text-[#0B1633]">{value}</p></div>
}

function MiniMetric({ label, value, suffix = '' }: { label: string; value: number | null; suffix?: string }) {
  return <div className="rounded-xl bg-slate-50 px-2 py-2"><p className="text-[9px] font-bold uppercase text-slate-400">{label}</p><p className="mt-1 font-black">{value !== null ? `${formatNumber(value, 2)}${suffix ? ` ${suffix}` : ''}` : '—'}</p></div>
}

function SiteRow({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return <div className="grid grid-cols-[70px_1fr] gap-2 border-t border-slate-100 pt-2"><span className="text-slate-500">{label}</span><strong className={`text-right ${warning && (!value || /nicht|offen|unbekannt/i.test(value)) ? 'text-amber-700' : 'text-[#0B1633]'}`}>{value || 'Nicht bekannt'}</strong></div>;
}
