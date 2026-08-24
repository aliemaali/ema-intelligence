import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, CalendarDays, CheckSquare, Mic2 } from 'lucide-react'

type Props = {
  recordings: number
  appointments: number
  tasks: number
}

export function PlaudDashboardCard({ recordings, appointments, tasks }: Props) {
  return (
    <Link
      href="/plaud"
      aria-label="PLAUD öffnen"
      className="premium-lift group relative mx-3 block overflow-hidden rounded-[2rem] border border-blue-300/20 bg-gradient-to-br from-[#102d5b]/92 via-[#0a2249]/96 to-[#071a36] shadow-[0_20px_55px_rgba(0,0,0,.26),0_0_32px_rgba(40,94,224,.08)] md:mx-0"
    >
      <span className="ema-glow-pulse pointer-events-none absolute -left-10 -top-16 h-44 w-44 rounded-full bg-[#7bed3e]/14 blur-[60px]" />
      <div className="relative flex items-center justify-between gap-4 border-b border-white/[0.08] p-5 text-white">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#8cf24e]/20 bg-[#80eb42]/10 shadow-[0_0_24px_rgba(117,238,53,.10)]">
            <Mic2 className="text-[#8cf24e]" />
          </span>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#8cf24e]">EMA Integration</p>
            <h2 className="text-2xl font-extrabold">PLAUD</h2>
          </div>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-blue-200/15 bg-blue-300/10 text-blue-200">
          <ArrowRight />
        </span>
      </div>
      <div className="relative grid grid-cols-3 divide-x divide-blue-200/10 p-4">
        <Cell icon={<Mic2 className="text-blue-300" />} value={recordings} label="Aufnahmen" />
        <Cell icon={<CalendarDays className="text-[#80eb42]" />} value={appointments} label="Termine" />
        <Cell icon={<CheckSquare className="text-violet-300" />} value={tasks} label="Aufgaben" />
      </div>
    </Link>
  )
}

function Cell({ icon, value, label }: { icon: ReactNode; value: number; label: string }) {
  return (
    <div className="px-2 md:px-4">
      <div>{icon}</div>
      <p className="mt-2 text-xl font-extrabold text-white">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  )
}
