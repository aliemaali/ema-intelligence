import type { ReactNode } from 'react'
import { BatteryCharging, CheckCircle2, CircleAlert, ClipboardList, Euro, Info, SunMedium, Tag, TriangleAlert } from 'lucide-react'
import type { ProjectAuditRecord } from '@/lib/actions/project-audit.actions'
import type { Severity } from '@/lib/pdf/projectAuditPdf'
import { auditMoney, auditMoneyPerKwp, auditNumber } from './shared'

function SummaryCard({ icon, title, value, iconClass }: { icon: ReactNode; title: string; value: number; iconClass: string }) {
  return <div className="flex min-h-[112px] items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white ${iconClass}`}>{icon}</span>
    <div><p className="text-sm font-semibold text-[#07142F]">{title}</p><p className="mt-0.5 text-3xl font-extrabold leading-none text-[#07142F]">{value}</p><p className="mt-1 text-xs text-slate-500">Projekte</p></div>
  </div>
}

function Metric({ icon, label, value, iconClass }: { icon: ReactNode; label: string; value: string; iconClass: string }) {
  return <div className="flex min-w-0 items-center gap-4 px-4 py-2 lg:border-r lg:border-slate-200 last:lg:border-r-0">
    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${iconClass}`}>{icon}</span>
    <div className="min-w-0"><p className="truncate text-xs font-medium text-slate-600">{label}</p><p className="mt-1 truncate text-xl font-extrabold text-[#07142F]">{value}</p></div>
  </div>
}

export function ProjectAuditSummary({ projects, counts }: { projects: ProjectAuditRecord[]; counts: Record<Severity, number> }) {
  const pv = projects.reduce((sum, item) => sum + (item.pvKwp ?? 0), 0)
  const bess = projects.reduce((sum, item) => sum + (item.bessMwh ?? 0), 0)
  const investment = projects.reduce((sum, item) => sum + (item.purchasePrice ?? item.investmentVolume ?? 0), 0)
  const priced = projects.filter((item) => (item.purchasePrice ?? item.investmentVolume) && item.pvKwp)
  const pricedPv = priced.reduce((sum, item) => sum + (item.pvKwp ?? 0), 0)
  const pricedInvestment = priced.reduce((sum, item) => sum + (item.purchasePrice ?? item.investmentVolume ?? 0), 0)
  const average = pricedPv ? pricedInvestment / pricedPv : null

  return <>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <SummaryCard icon={<ClipboardList className="h-6 w-6" />} title="Gesamt geprüft" value={projects.length} iconClass="bg-[#07142F]" />
      <SummaryCard icon={<CircleAlert className="h-7 w-7" />} title="Fehler" value={counts.error} iconClass="bg-red-600" />
      <SummaryCard icon={<TriangleAlert className="h-7 w-7" />} title="Fehlende Werte" value={counts.missing} iconClass="bg-amber-500" />
      <SummaryCard icon={<Info className="h-7 w-7" />} title="Hinweise" value={counts.warning} iconClass="bg-blue-600" />
      <SummaryCard icon={<CheckCircle2 className="h-7 w-7" />} title="Plausible Projekte" value={counts.ok} iconClass="bg-[#5CB800]" />
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <h2 className="px-1 text-lg font-extrabold text-[#07142F]">Gesamtportfolio</h2>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={<SunMedium className="h-6 w-6" />} label="PV-Leistung" value={`${auditNumber.format(pv)} kWp`} iconClass="bg-slate-100 text-[#07142F]" />
        <Metric icon={<BatteryCharging className="h-6 w-6" />} label="BESS-Kapazität" value={`${auditNumber.format(bess)} MWh`} iconClass="bg-slate-100 text-[#07142F]" />
        <Metric icon={<Euro className="h-7 w-7" />} label="Kaufpreis / Investitionsvolumen" value={auditMoney.format(investment)} iconClass="bg-[#5CB800]/10 text-[#4E9D00]" />
        <Metric icon={<Tag className="h-6 w-6" />} label="Ø Preis pro kWp" value={average ? `${auditMoneyPerKwp.format(average)}/kWp` : '—'} iconClass="bg-slate-100 text-slate-600" />
      </div>
      <p className="mt-3 px-1 text-[11px] leading-5 text-slate-500">Hinweis: Die Prüfung ist eine automatisierte Plausibilitätskontrolle und ersetzt keine technische, rechtliche oder steuerliche Due Diligence.</p>
    </section>
  </>
}
