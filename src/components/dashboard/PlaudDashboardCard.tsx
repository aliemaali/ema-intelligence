import Link from 'next/link'
import { ArrowRight, CalendarDays, CheckSquare, Mic2 } from 'lucide-react'

type PlaudDashboardCardProps = {
  recordings?: number | null
  appointments?: number | null
  tasks?: number | null
}

export function PlaudDashboardCard({ recordings = null, appointments = null, tasks = null }: PlaudDashboardCardProps) {
  const metric = (value: number | null) => value == null ? '–' : String(value)

  return (
    <Link href="/plaud" aria-label="PLAUD öffnen" className="premium-lift group mx-3 block overflow-hidden rounded-[2rem] border border-[#1F2A44]/10 bg-white shadow-[0_16px_40px_rgba(31,42,68,0.07)] outline-none focus-visible:ring-2 focus-visible:ring-[#5CB800] focus-visible:ring-offset-2 md:mx-0">
      <div className="flex items-center justify-between gap-4 bg-gradient-to-r from-[#1F2A44] via-[#263755] to-[#1F2A44] p-5 text-white md:p-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15"><Mic2 className="h-6 w-6 text-[#76d22a]" /></span>
          <div className="min-w-0"><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#76d22a]">EMA Integration</p><h2 className="mt-0.5 text-2xl font-extrabold">PLAUD</h2></div>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 transition group-hover:translate-x-1"><ArrowRight className="h-5 w-5" /></span>
      </div>
      <div className="grid grid-cols-3 divide-x divide-slate-100 p-4 md:p-5">
        <div className="px-2 md:px-4"><Mic2 className="h-4 w-4 text-[#1F2A44]" /><p className="mt-2 text-xl font-extrabold text-[#07142F]">{metric(recordings)}</p><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 md:text-xs">Aufnahmen</p></div>
        <div className="px-2 md:px-4"><CalendarDays className="h-4 w-4 text-[#5CB800]" /><p className="mt-2 text-xl font-extrabold text-[#07142F]">{metric(appointments)}</p><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 md:text-xs">Termine</p></div>
        <div className="px-2 md:px-4"><CheckSquare className="h-4 w-4 text-violet-600" /><p className="mt-2 text-xl font-extrabold text-[#07142F]">{metric(tasks)}</p><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 md:text-xs">Aufgaben</p></div>
      </div>
    </Link>
  )
}
