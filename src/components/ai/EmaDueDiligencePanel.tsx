'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, FileSearch, Loader2, Scale, ShieldAlert, Wrench } from 'lucide-react'

type Profile = 'pv' | 'bess' | 'pv_bess'
type Assessment = {
  decision: 'GO' | 'CONDITIONAL GO' | 'NO-GO' | 'INSUFFICIENT DATA'
  overallScore: number
  lensScores: { engineering: number; investor: number; legal: number }
  hardGateFailures: string[]
  hardGateOpen: string[]
  criticalCount: number
  openCount: number
  verifiedCount: number
  findings: Array<{ checkId:string; lens:'engineering'|'investor'|'legal'; status:'verified'|'open'|'critical'; finding:string; requiredAction:string; sources:Array<{documentName:string;page:number|null;excerpt?:string}> }>
}

const profileLabels: Record<Profile,string> = { pv:'PV', bess:'BESS', pv_bess:'PV + BESS' }
const lensLabels = { engineering:'Ingenieurbüro', investor:'Investor', legal:'Rechtliche Vorprüfung' }

export function EmaDueDiligencePanel({ projectId, suggestedProfile }: { projectId:string; suggestedProfile?:Profile }) {
  const [profile,setProfile] = useState<Profile>(suggestedProfile ?? 'pv')
  const [loading,setLoading] = useState(false)
  const [error,setError] = useState('')
  const [assessment,setAssessment] = useState<Assessment|null>(null)

  async function runReview() {
    setLoading(true); setError(''); setAssessment(null)
    try {
      const response = await fetch('/api/ema/due-diligence',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({project_id:projectId,profile})})
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Prüfung fehlgeschlagen.')
      setAssessment(data.assessment)
    } catch (e) { setError(e instanceof Error ? e.message : 'Prüfung fehlgeschlagen.') } finally { setLoading(false) }
  }

  const decisionClass = assessment?.decision === 'GO' ? 'bg-green-50 text-green-800 border-green-200' : assessment?.decision === 'NO-GO' ? 'bg-red-50 text-red-800 border-red-200' : 'bg-amber-50 text-amber-900 border-amber-200'

  return <section className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
    <div className="flex items-start gap-3"><div className="rounded-2xl bg-slate-900 p-2.5 text-white"><FileSearch className="h-5 w-5"/></div><div><h2 className="font-semibold text-slate-950">Professional Due Diligence</h2><p className="mt-1 text-sm text-slate-500">Prüfung wie Ingenieurbüro, Investor und rechtliche Vorprüfung – ausschließlich auf Basis des Datenraums.</p></div></div>
    <div className="mt-5 grid grid-cols-3 gap-2">{(['pv','bess','pv_bess'] as Profile[]).map(p=><button key={p} onClick={()=>setProfile(p)} className={`min-h-11 rounded-xl border px-2 text-sm font-medium ${profile===p?'border-slate-900 bg-slate-900 text-white':'border-slate-200 bg-white text-slate-700'}`}>{profileLabels[p]}</button>)}</div>
    <button onClick={runReview} disabled={loading} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#5CB800] px-4 font-semibold text-white disabled:opacity-60">{loading?<><Loader2 className="h-4 w-4 animate-spin"/>Datenraum wird geprüft …</>:<><ShieldAlert className="h-4 w-4"/>Prüfung starten</>}</button>
    {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    {assessment && <div className="mt-5 space-y-4">
      <div className={`rounded-2xl border p-4 ${decisionClass}`}><div className="text-xs font-semibold uppercase tracking-wide">Investment Decision</div><div className="mt-1 text-2xl font-bold">{assessment.decision}</div><div className="mt-1 text-sm">Gesamtscore {assessment.overallScore}/100 · {assessment.verifiedCount} verifiziert · {assessment.openCount} offen · {assessment.criticalCount} kritisch</div></div>
      <div className="grid grid-cols-3 gap-2">{([['engineering',Wrench],['investor',CheckCircle2],['legal',Scale]] as const).map(([lens,Icon])=><div key={lens} className="rounded-2xl border border-slate-200 p-3"><Icon className="h-4 w-4 text-slate-500"/><div className="mt-2 text-xl font-bold text-slate-950">{assessment.lensScores[lens]}</div><div className="text-[11px] leading-tight text-slate-500">{lensLabels[lens]}</div></div>)}</div>
      {(assessment.hardGateFailures.length>0 || assessment.hardGateOpen.length>0) && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-center gap-2 font-semibold text-amber-900"><AlertTriangle className="h-4 w-4"/>Hard Gates</div><p className="mt-1 text-sm text-amber-800">{assessment.hardGateFailures.length} kritisch · {assessment.hardGateOpen.length} ohne ausreichenden Nachweis</p></div>}
      <div className="space-y-2">{assessment.findings.filter(f=>f.status!=='verified').slice(0,12).map(f=><details key={f.checkId} className="rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-semibold text-slate-900">{f.status==='critical'?'🔴':'🟠'} {f.finding}</summary><div className="mt-2 text-sm text-slate-600"><p><b>Nächster Schritt:</b> {f.requiredAction}</p>{f.sources.length>0&&<div className="mt-2"><b>Quellen:</b>{f.sources.map((s,i)=><div key={i} className="mt-1 text-xs">{s.documentName}{s.page?` · S. ${s.page}`:''}{s.excerpt?` — ${s.excerpt}`:''}</div>)}</div>}</div></details>)}</div>
    </div>}
  </section>
}
