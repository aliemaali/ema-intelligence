'use client'

import { Fragment, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CircleAlert, TriangleAlert } from 'lucide-react'
import type { ProjectAuditEvaluation } from '@/lib/pdf/projectAuditPdf'
import { auditMoney, auditMoneyPerKwp, auditNumber, auditStatusMeta, fallbackProjectImage } from './shared'

function pageNumbers(current: number, total: number) {
  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1)
  if (current <= 3) return [1, 2, 3, 4, total]
  if (current >= total - 2) return [1, total - 3, total - 2, total - 1, total]
  return [1, current - 1, current, current + 1, total]
}

export function ProjectAuditTable({ audits }: { audits: ProjectAuditEvaluation[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(audits.filter((item) => item.affectedCount > 0).slice(0, 2).map((item) => item.project.id)))
  const [page, setPage] = useState(1)
  const pageSize = 7
  const pageCount = Math.max(1, Math.ceil(audits.length / pageSize))
  const visible = audits.slice((page - 1) * pageSize, page * pageSize)
  const toggle = (id: string) => setExpanded((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next })

  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
    <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
        <span className="font-extrabold text-[#07142F]">Status-Legende:</span>
        <Legend color="bg-[#5CB800]" title="OK" subtitle="Plausibel" />
        <Legend color="bg-amber-500" title="Prüfen" subtitle="Auffälliger Wert" />
        <Legend color="bg-red-600" title="Fehler" subtitle="Unplausibel" />
        <Legend color="bg-slate-500" title="Fehlt" subtitle="Kein Wert" />
      </div>
      <span className="text-xs font-semibold text-slate-600">Anzahl betroffener Felder</span>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1180px] border-collapse text-left text-xs">
        <thead className="bg-[#07142F] text-white"><tr>
          <th className="w-12 px-4 py-3">#</th><th className="min-w-[250px] px-3 py-3">Projekt</th><th className="min-w-[180px] px-3 py-3">Standort / Status</th><th className="min-w-[145px] px-3 py-3 text-right">PV-Leistung (kWp)</th><th className="min-w-[175px] px-3 py-3 text-right">Investitionsvolumen</th><th className="min-w-[145px] px-3 py-3 text-right">Preis pro kWp</th><th className="min-w-[170px] px-3 py-3">Plausibilitätsstatus</th><th className="min-w-[150px] px-3 py-3 text-center">Fehlende / Auffällige Felder</th>
        </tr></thead>
        <tbody>
          {visible.map((item, i) => <AuditRows key={item.project.id} item={item} index={(page - 1) * pageSize + i + 1} expanded={expanded.has(item.project.id)} onToggle={() => toggle(item.project.id)} />)}
          {!visible.length && <tr><td colSpan={8} className="px-6 py-16 text-center text-sm text-slate-500">Keine Projekte für die Prüfung vorhanden.</td></tr>}
        </tbody>
      </table>
    </div>
    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-slate-600">Anzeige {audits.length ? (page - 1) * pageSize + 1 : 0} bis {Math.min(page * pageSize, audits.length)} von {audits.length} Projekten</p>
      <div className="flex items-center gap-2">
        <PageButton disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft className="h-4 w-4" /></PageButton>
        {pageNumbers(page, pageCount).map((value, index, values) => <Fragment key={`${value}-${index}`}>{index > 0 && value - values[index - 1] > 1 && <span className="px-1 text-slate-400">…</span>}<button type="button" onClick={() => setPage(value)} className={`h-9 min-w-9 rounded-lg px-3 text-xs font-extrabold ${page === value ? 'bg-[#07142F] text-white' : 'border border-slate-200 bg-white text-[#07142F]'}`}>{value}</button></Fragment>)}
        <PageButton disabled={page === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}><ChevronRight className="h-4 w-4" /></PageButton>
      </div>
    </div>
  </section>
}

function Legend({ color, title, subtitle }: { color: string; title: string; subtitle: string }) {
  return <span className="inline-flex items-center gap-2"><span className={`h-3.5 w-3.5 rounded-full ${color}`} /><span><b className="text-[#07142F]">{title}</b><br /><span className="text-slate-500">{subtitle}</span></span></span>
}

function PageButton({ children, disabled, onClick }: { children: ReactNode; disabled: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} disabled={disabled} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#07142F] disabled:opacity-40">{children}</button>
}

function AuditRows({ item, index, expanded, onToggle }: { item: ProjectAuditEvaluation; index: number; expanded: boolean; onToggle: () => void }) {
  const { project, worst, affectedCount, pricePerKwp } = item
  const status = auditStatusMeta(worst)
  const amount = project.purchasePrice ?? project.investmentVolume
  const issues = item.checks.filter((check) => check.severity !== 'ok')
  return <>
    <tr className="border-b border-slate-200 align-middle hover:bg-slate-50/70">
      <td className="px-4 py-3 font-semibold text-[#07142F]">{index}</td>
      <td className="px-3 py-2.5"><Link href={`/projects/${project.id}/overview`} className="flex items-center gap-3"><img src={project.projectImageUrl || fallbackProjectImage(project.projectType)} alt="" className="h-11 w-16 rounded-md border border-slate-200 object-cover" /><span className="min-w-0"><b className="block text-[#07142F]">{project.projectNumber}</b><span className="block max-w-[180px] truncate font-semibold text-[#07142F]">{project.projectName}</span></span></Link></td>
      <td className="px-3 py-2.5"><p className="max-w-[180px] truncate text-slate-700">{project.location}</p><span className={`mt-1 inline-flex rounded-md px-2 py-0.5 text-[10px] font-extrabold ${project.stage === 'RTB' ? 'bg-[#5CB800]/10 text-[#4E9D00]' : 'bg-blue-50 text-blue-700'}`}>{project.stage}</span></td>
      <td className="px-3 py-2.5 text-right font-bold text-[#07142F]">{project.pvKwp ? auditNumber.format(project.pvKwp) : '—'}</td>
      <td className="px-3 py-2.5 text-right"><b className="text-[#07142F]">{amount ? auditMoney.format(amount) : '—'}</b>{project.storedPricePerKwp && <p className="text-[10px] text-slate-500">gespeichert: {auditMoneyPerKwp.format(project.storedPricePerKwp)}/kWp</p>}</td>
      <td className="px-3 py-2.5 text-right font-semibold text-[#07142F]">{pricePerKwp ? `${auditMoneyPerKwp.format(pricePerKwp)}/kWp` : '—'}</td>
      <td className="px-3 py-2.5"><div className="flex items-center gap-3"><span className={`flex h-5 w-5 items-center justify-center rounded-full text-white ${status.dot}`}>{worst === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : worst === 'error' ? <CircleAlert className="h-4 w-4" /> : <TriangleAlert className="h-3.5 w-3.5" />}</span><span><b className={`block ${status.text}`}>{status.title}</b><span className="text-[10px] text-slate-500">{status.subtitle}</span></span></div></td>
      <td className="px-3 py-2.5 text-center"><button type="button" onClick={onToggle} disabled={!affectedCount} className="inline-flex min-w-[116px] items-center justify-center gap-2 rounded-lg px-2 py-1.5 disabled:cursor-default"><span className={`min-w-10 rounded-md px-3 py-1 text-sm font-extrabold ${status.badge}`}>{affectedCount}</span><span className="text-[10px] leading-4 text-slate-500">{affectedCount === 1 ? 'Auffälliges Feld' : 'Fehlende / auffällige Felder'}</span>{affectedCount > 0 && (expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}</button></td>
    </tr>
    {expanded && issues.length > 0 && <tr className="border-b border-slate-200"><td colSpan={8} className="px-10 py-2.5"><div className={`rounded-lg border-l-4 px-5 py-3 ${status.panel}`}><div className="flex justify-between"><b className="text-xs text-[#07142F]">{worst === 'error' ? 'Fehlende / fehlerhafte Felder:' : 'Auffälligkeiten:'}</b><button type="button" onClick={onToggle}><ChevronUp className="h-4 w-4" /></button></div><ul className="mt-1.5 space-y-1 pl-5 text-xs text-[#07142F]">{issues.map((check, i) => <li key={`${check.label}-${i}`} className="list-disc"><b>{check.label}:</b> {check.detail}</li>)}</ul></div></td></tr>}
  </>
}
