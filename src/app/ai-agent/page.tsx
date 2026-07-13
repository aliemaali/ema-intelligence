import Link from 'next/link'
import { Bot, Play, Clock3, CheckCircle2, AlertCircle, XCircle, ArrowRight, Activity, ListTodo } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAgentJob, cancelAgentJob } from '@/lib/actions/agent.actions'

export const dynamic = 'force-dynamic'

type Job = {
  id: string
  title: string
  prompt: string
  job_type: string
  status: string
  progress: number
  current_step: string | null
  created_at: string
}

type Log = {
  id: string
  job_id: string
  level: string
  message: string
  created_at: string
}

const statusLabels: Record<string, string> = {
  queued: 'Warteschlange', planning: 'Planung', researching: 'Recherche', analyzing: 'Analyse',
  creating_leads: 'Leads erstellen', drafting_emails: 'E-Mails vorbereiten', waiting_approval: 'Wartet auf Freigabe',
  completed: 'Abgeschlossen', failed: 'Fehler', cancelled: 'Gestoppt',
}

const examples = [
  'Finde 20 Logistikunternehmen in Rheinland-Pfalz mit großen Dachflächen.',
  'Suche neue PV- und BESS-Projekte ab 5 MW für unsere Investoren.',
  'Bewerte alle neuen Dachflächen-Leads und priorisiere die besten zehn.',
]

export default async function AiAgentPage({ searchParams }: { searchParams: { job?: string; created?: string; error?: string } }) {
  const supabase = await createClient()
  const db = supabase as any
  const [{ data: jobsData, error: jobsError }, { data: logsData }] = await Promise.all([
    db.from('agent_jobs').select('id,title,prompt,job_type,status,progress,current_step,created_at').order('created_at', { ascending: false }).limit(20),
    db.from('agent_logs').select('id,job_id,level,message,created_at').order('created_at', { ascending: false }).limit(50),
  ])

  const jobs = (jobsData || []) as Job[]
  const logs = (logsData || []) as Log[]
  const selectedJob = jobs.find((job) => job.id === searchParams.job) || jobs[0]
  const selectedLogs = selectedJob ? logs.filter((log) => log.job_id === selectedJob.id) : []

  return (
    <div className="min-h-screen bg-[#F4F6F9] px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-3xl bg-[#132060] px-6 py-8 text-white shadow-sm md:px-10">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10"><Bot className="h-7 w-7 text-[#8FDA45]" /></div>
              <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Digital Acquisition Intelligence</p><h1 className="mt-2 text-3xl font-semibold">EMA Scout</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">Aufträge anlegen, Fortschritt verfolgen und Ergebnisse kontrollieren. Versand bleibt immer freigabepflichtig.</p></div>
            </div>
            <Link href="/acquisition/approvals" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#132060]">Zu den Freigaben <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </section>

        {jobsError && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Die Sprint-3-Migration ist noch nicht in Supabase ausgeführt.</div>}
        {searchParams.created && <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">Auftrag wurde angelegt.</div>}

        <div className="grid gap-6 xl:grid-cols-[0.8fr_1.4fr_0.9fr]">
          <aside className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5"><div className="flex items-center gap-2"><ListTodo className="h-5 w-5 text-[#132060]" /><h2 className="font-semibold text-[#132060]">Aufträge</h2></div></div>
            <div className="divide-y divide-slate-100">
              {jobs.length === 0 ? <p className="p-5 text-sm text-slate-500">Noch keine Aufträge.</p> : jobs.map((job) => (
                <Link key={job.id} href={`/ai-agent?job=${job.id}`} className={`block p-4 hover:bg-slate-50 ${selectedJob?.id === job.id ? 'bg-[#F3F6FF]' : ''}`}>
                  <p className="line-clamp-2 text-sm font-semibold text-slate-900">{job.title}</p>
                  <div className="mt-2 flex items-center justify-between gap-2"><span className="text-xs text-slate-500">{statusLabels[job.status] || job.status}</span><span className="text-xs font-semibold text-[#132060]">{job.progress}%</span></div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#5CB800]" style={{ width: `${job.progress}%` }} /></div>
                </Link>
              ))}
            </div>
          </aside>

          <main className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <h2 className="text-lg font-semibold text-[#132060]">Was soll ich heute erledigen?</h2>
              <form action={createAgentJob} className="mt-4">
                <textarea name="prompt" required minLength={10} placeholder="Zum Beispiel: Finde 20 Logistikunternehmen im Umkreis von 100 km um Worms mit großen Dachflächen." className="min-h-36 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-800 outline-none focus:border-[#5CB800]" />
                <div className="mt-3 flex justify-end"><button className="inline-flex items-center gap-2 rounded-xl bg-[#132060] px-4 py-2.5 text-sm font-semibold text-white"><Play className="h-4 w-4" /> Auftrag starten</button></div>
              </form>
              <div className="mt-5 space-y-2">{examples.map((text) => <div key={text} className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-500">{text}</div>)}</div>
            </section>

            {selectedJob && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Aktiver Auftrag</p><h2 className="mt-2 text-lg font-semibold text-[#132060]">{selectedJob.title}</h2><p className="mt-2 text-sm text-slate-500">{selectedJob.current_step || 'Noch kein Arbeitsschritt gestartet'}</p></div>{!['completed','failed','cancelled'].includes(selectedJob.status) && <form action={cancelAgentJob}><input type="hidden" name="job_id" value={selectedJob.id} /><button className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">Stoppen</button></form>}</div>
              <div className="mt-5"><div className="mb-2 flex justify-between text-xs font-semibold text-slate-500"><span>{statusLabels[selectedJob.status]}</span><span>{selectedJob.progress}%</span></div><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#5CB800]" style={{ width: `${selectedJob.progress}%` }} /></div></div>
            </section>}
          </main>

          <aside className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5"><div className="flex items-center gap-2"><Activity className="h-5 w-5 text-[#132060]" /><h2 className="font-semibold text-[#132060]">Live-Protokoll</h2></div></div>
            <div className="space-y-4 p-5">{selectedLogs.length === 0 ? <p className="text-sm text-slate-500">Noch keine Aktivitäten.</p> : selectedLogs.map((log) => <div key={log.id} className="flex gap-3"><div className="mt-0.5">{log.level === 'success' ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : log.level === 'error' ? <AlertCircle className="h-4 w-4 text-red-600" /> : log.level === 'warning' ? <XCircle className="h-4 w-4 text-amber-600" /> : <Clock3 className="h-4 w-4 text-slate-400" />}</div><div><p className="text-sm text-slate-700">{log.message}</p><p className="mt-1 text-[11px] text-slate-400">{new Date(log.created_at).toLocaleString('de-DE')}</p></div></div>)}</div>
          </aside>
        </div>
      </div>
    </div>
  )
}