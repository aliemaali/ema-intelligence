'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, Loader2 } from 'lucide-react'
import type { ProjectAuditRecord } from '@/lib/actions/project-audit.actions'
import { evaluateProjectPortfolio, generateProjectAuditPdf, type Severity } from '@/lib/pdf/projectAuditPdf'
import { ProjectAuditSummary } from './project-audit/ProjectAuditSummary'
import { ProjectAuditTable } from './project-audit/ProjectAuditTable'

interface Props { projects: ProjectAuditRecord[]; createdAt: string; reportId: string; errorMessage?: string }

export function ProjectAuditDashboard({ projects, createdAt, reportId, errorMessage }: Props) {
  const audits = useMemo(() => evaluateProjectPortfolio(projects), [projects])
  const counts = useMemo(() => audits.reduce<Record<Severity, number>>((sum, item) => { sum[item.worst] += 1; return sum }, { ok: 0, warning: 0, error: 0, missing: 0 }), [audits])
  const [downloading, setDownloading] = useState(false)

  function downloadPdf() {
    if (!projects.length || downloading) return
    setDownloading(true)
    window.setTimeout(() => { try { generateProjectAuditPdf(projects) } finally { setDownloading(false) } }, 50)
  }

  return <div className="mx-auto w-full max-w-[1600px] space-y-4 px-3 pb-28 md:px-0">
    <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 xl:flex-row xl:items-end xl:justify-between">
      <div><Link href="/projects" className="inline-flex items-center gap-2 text-sm font-bold text-[#4E9D00]"><ArrowLeft className="h-4 w-4" /> Zurück zu Projekte</Link><h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[#07142F] md:text-4xl">EMA Projektprüfung – Prüfbericht</h1><p className="mt-1 text-sm text-slate-600 md:text-base">Automatische Plausibilitätsprüfung aller Projektwerte</p></div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center"><dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-xs text-slate-600"><dt>Erstellt am:</dt><dd className="font-semibold text-[#07142F]">{createdAt}</dd><dt>Bericht-ID:</dt><dd className="font-semibold text-[#07142F]">{reportId}</dd></dl><button type="button" onClick={downloadPdf} disabled={!projects.length || downloading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#07142F] px-5 py-3 text-sm font-extrabold text-white disabled:opacity-50">{downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{downloading ? 'PDF wird erstellt …' : 'PDF herunterladen'}</button></div>
    </div>
    {errorMessage && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">Die Projektdaten konnten nicht vollständig geladen werden: {errorMessage}</div>}
    <ProjectAuditSummary projects={projects} counts={counts} />
    <ProjectAuditTable audits={audits} />
  </div>
}
