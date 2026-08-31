'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Download, FileSearch, Loader2, Scale, ShieldAlert, Wrench } from 'lucide-react'
import { toast } from 'sonner'

type Source = { documentId: string; documentName: string; page: number | null; excerpt?: string }
type Assessment = {
  decision: 'GO' | 'CONDITIONAL GO' | 'NO-GO' | 'INSUFFICIENT DATA'
  overallScore: number
  lensScores: { engineering: number; investor: number; legal: number }
  hardGateFailures: string[]
  hardGateOpen: string[]
  criticalCount: number
  openCount: number
  verifiedCount: number
  findings: Array<{ checkId: string; lens: 'engineering' | 'investor' | 'legal'; status: 'verified' | 'open' | 'critical'; finding: string; consequence: string; requiredAction: string; sources: Source[] }>
}

type RoomDocument = { id: string; display_name: string; file_name: string; mime_type: string | null; ai_analyzed: boolean; analysis_status: string; archive_entry_path: string }

export function DueDiligenceWorkspace({ roomId, documents, initialAssessment, initialReportDocumentId }: { roomId: string; documents: RoomDocument[]; initialAssessment: Assessment | null; initialReportDocumentId: string | null }) {
  const router = useRouter()
  const [assessment, setAssessment] = useState(initialAssessment)
  const [reportDocumentId, setReportDocumentId] = useState(initialReportDocumentId)
  const [loading, setLoading] = useState(false)
  const [stage, setStage] = useState('')
  const [progress, setProgress] = useState(0)

  async function callDueDiligence() {
    const response = await fetch(`/api/dms/data-rooms/${roomId}/due-diligence`, { method: 'POST' })
    const payload = await response.json().catch(() => ({}))
    return { response, payload }
  }

  async function runReview() {
    setLoading(true)
    setAssessment(null)
    setReportDocumentId(null)
    setStage('Datenraum wird geprüft …')
    setProgress(3)
    try {
      let { response, payload } = await callDueDiligence()
      if (response.status === 409 && Array.isArray(payload.document_ids) && payload.document_ids.length) {
        const ids = payload.document_ids as string[]
        for (let index = 0; index < ids.length; index += 1) {
          setStage(`PDF ${index + 1} von ${ids.length} wird sicher eingelesen …`)
          setProgress(Math.round(((index + 0.5) / ids.length) * 70))
          const indexResponse = await fetch('/api/ema/documents/index', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ document_id: ids[index] }) })
          const indexPayload = await indexResponse.json().catch(() => ({}))
          if (!indexResponse.ok) throw new Error(indexPayload?.error ?? 'Ein PDF konnte nicht eingelesen werden.')
        }
        setStage('Engineering, Investment und Legal Review laufen …')
        setProgress(78)
        ;({ response, payload } = await callDueDiligence())
      }
      if (!response.ok) throw new Error(payload?.error ?? 'Due Diligence fehlgeschlagen.')
      setProgress(100)
      setAssessment(payload.assessment)
      setReportDocumentId(payload.report_document_id)
      toast.success('DD abgeschlossen. Der PDF-Bericht liegt im EMA DMS.')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Due Diligence fehlgeschlagen.')
    } finally {
      setLoading(false)
      setStage('')
    }
  }

  const decisionClass = assessment?.decision === 'GO'
    ? 'border-green-200 bg-green-50 text-green-800'
    : assessment?.decision === 'NO-GO'
      ? 'border-red-200 bg-red-50 text-red-800'
      : 'border-amber-200 bg-amber-50 text-amber-900'

  return <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
    <section className="dms-panel rounded-[1.8rem] border border-slate-200 bg-white p-4 shadow-sm md:p-6">
      <div className="flex items-start gap-3"><span className="rounded-2xl bg-[#071a32] p-3 text-white"><FileSearch className="h-5 w-5" /></span><div><h2 className="text-xl font-extrabold text-[#07142F]">Professional Due Diligence</h2><p className="mt-1 text-sm leading-6 text-slate-500">Engineering Review, Investor Review und rechtliche Vorprüfung – ausschließlich aus belegten Inhalten des Datenraums.</p></div></div>
      <button type="button" onClick={() => void runReview()} disabled={loading} className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#5CB800] px-4 font-extrabold text-white shadow-[0_12px_30px_rgba(92,184,0,.22)] disabled:opacity-60">{loading ? <><Loader2 className="h-5 w-5 animate-spin" />{stage}</> : <><ShieldAlert className="h-5 w-5" />{assessment ? 'Neue Prüfung starten' : 'Due Diligence starten'}</>}</button>
      {loading && <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#5CB800] transition-all" style={{ width: `${progress}%` }} /></div>}

      {assessment && <div className="mt-6 space-y-4">
        <div className={`rounded-2xl border p-5 ${decisionClass}`}><p className="text-[10px] font-extrabold uppercase tracking-[.16em]">Investment Decision</p><p className="mt-1 text-3xl font-extrabold">{assessment.decision}</p><p className="mt-2 text-sm font-bold">Gesamtscore {assessment.overallScore}/100 · {assessment.verifiedCount} verifiziert · {assessment.openCount} offen · {assessment.criticalCount} kritisch</p>{reportDocumentId && <a href={`/api/dms/documents/${reportDocumentId}/open`} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white/70 px-4 text-sm font-extrabold shadow-sm"><Download className="h-4 w-4" /> PDF-Bericht öffnen</a>}</div>
        <div className="grid grid-cols-3 gap-2">{([['engineering', Wrench, 'Engineering'], ['investor', CheckCircle2, 'Investor'], ['legal', Scale, 'Legal']] as const).map(([lens, Icon, label]) => <div key={lens} className="rounded-2xl border border-slate-200 p-3"><Icon className="h-4 w-4 text-slate-500" /><strong className="mt-2 block text-2xl text-[#07142F]">{assessment.lensScores[lens]}</strong><span className="text-[10px] font-bold text-slate-500">{label}</span></div>)}</div>
        {(assessment.hardGateFailures.length > 0 || assessment.hardGateOpen.length > 0) && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-center gap-2 font-extrabold text-amber-900"><AlertTriangle className="h-4 w-4" /> Hard Gates</div><p className="mt-1 text-sm text-amber-800">{assessment.hardGateFailures.length} kritisch · {assessment.hardGateOpen.length} ohne ausreichenden Nachweis</p></div>}
        <div className="space-y-2">{assessment.findings.map((finding) => <details key={finding.checkId} open={finding.status === 'critical'} className="rounded-2xl border border-slate-200 p-4"><summary className="cursor-pointer text-sm font-extrabold text-[#07142F]">{finding.status === 'critical' ? '🔴' : finding.status === 'verified' ? '🟢' : '🟠'} {finding.finding}</summary><div className="mt-3 space-y-2 text-sm leading-6 text-slate-600"><p><b>Folge:</b> {finding.consequence}</p><p><b>Nächster Schritt:</b> {finding.requiredAction}</p>{finding.sources.length > 0 && <div><b>Quellen:</b>{finding.sources.map((source, index) => <a href={`/api/dms/documents/${source.documentId}/open`} target="_blank" rel="noopener noreferrer" key={`${source.documentId}-${index}`} className="mt-1 block w-full rounded-xl bg-slate-50 p-2 text-left text-xs hover:bg-slate-100"><b>{source.documentName}{source.page ? ` · S. ${source.page}` : ''}</b>{source.excerpt ? <span className="mt-1 block text-slate-500">{source.excerpt}</span> : null}</a>)}</div>}</div></details>)}</div>
      </div>}
    </section>

    <aside className="dms-panel rounded-[1.8rem] border border-slate-200 bg-white p-4 shadow-sm md:p-5"><div className="flex items-center justify-between"><h2 className="font-extrabold text-[#07142F]">Datenraum-Inhalt</h2><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-extrabold text-slate-600">{documents.length}</span></div><div className="mt-4 space-y-2">{documents.map((document) => <a href={`/api/dms/documents/${document.id}/open`} target="_blank" rel="noopener noreferrer" key={document.id} className="flex w-full items-center gap-3 rounded-xl border border-slate-100 p-3 text-left hover:bg-slate-50"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100"><FileSearch className="h-4 w-4 text-slate-600" /></span><span className="min-w-0 flex-1"><strong className="block truncate text-xs text-[#07142F]">{document.display_name}</strong><small className="mt-1 block truncate text-[10px] text-slate-500">{document.archive_entry_path}</small></span>{document.ai_analyzed ? <CheckCircle2 className="h-4 w-4 shrink-0 text-[#5CB800]" /> : null}</a>)}</div><p className="mt-5 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">Die EMA-Prüfung ist eine entscheidungsunterstützende Vorprüfung. Kritische Rechts-, Steuer- und Technikpunkte benötigen weiterhin die Freigabe qualifizierter Fachleute.</p></aside>
  </div>
}
