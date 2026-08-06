import Link from 'next/link'
import { ArrowRight, FileText, FolderOpen, Sparkles } from 'lucide-react'
import { formatPowerFromKwp } from '@/lib/format/power'
import { createClient } from '@/lib/supabase/server'

const flags: Record<string, string> = {
  Deutschland: '🇩🇪',
  Frankreich: '🇫🇷',
  Türkei: '🇹🇷',
  Spanien: '🇪🇸',
  Italien: '🇮🇹',
  Niederlande: '🇳🇱',
}

type ProjectListSummary = {
  country: string
  project_count: number
  total_kwp: number
  created_at: string
}

export async function CountryProjectFolders({ projects }: { projects: any[]; projectLists?: unknown[] }) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('country_project_lists')
    .select('country, project_count, total_kwp, created_at')
    .order('created_at', { ascending: false })

  const projectLists = (data ?? []) as ProjectListSummary[]
  const grouped = new Map<string, {
    count: number
    pvKwp: number
    listCount: number
    listedProjects: number
    listedKwp: number
  }>()

  for (const project of projects) {
    const country = String(project.location_country || 'Ohne Länderzuordnung')
    const current = grouped.get(country) ?? {
      count: 0,
      pvKwp: 0,
      listCount: 0,
      listedProjects: 0,
      listedKwp: 0,
    }
    current.count += 1
    current.pvKwp += Number(project.pv_kwp ?? project.pv_mwp ?? project.capacity_kwp ?? 0)
    grouped.set(country, current)
  }

  const latestListSeen = new Set<string>()
  for (const list of projectLists) {
    const country = String(list.country || 'Ohne Länderzuordnung')
    const current = grouped.get(country) ?? {
      count: 0,
      pvKwp: 0,
      listCount: 0,
      listedProjects: 0,
      listedKwp: 0,
    }
    current.listCount += 1
    if (!latestListSeen.has(country)) {
      current.listedProjects = Number(list.project_count ?? 0)
      current.listedKwp = Number(list.total_kwp ?? 0)
      latestListSeen.add(country)
    }
    grouped.set(country, current)
  }

  const countries = Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b, 'de'))

  return (
    <section className="px-3 md:px-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#5CB800]/20 bg-[#5CB800]/10 text-[#76d22a] shadow-[0_0_28px_rgba(92,184,0,0.08)]">
            <FolderOpen className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#76d22a]">Länderportfolio</p>
            <h2 className="mt-1 text-3xl font-extrabold tracking-[-0.04em] text-white">Projekte nach Ländern</h2>
          </div>
        </div>
        <div className="inline-flex items-center gap-2 self-start rounded-full border border-white/10 bg-white/[0.045] px-4 py-2 text-xs font-bold text-slate-300">
          <Sparkles className="h-4 w-4 text-[#76d22a]" />
          {countries.length} Länder
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {countries.map(([country, data]) => {
          const totalProjects = data.count + data.listedProjects
          const totalPower = data.pvKwp + data.listedKwp

          return (
            <Link
              key={country}
              href={`/projects/country/${encodeURIComponent(country)}`}
              className="group relative overflow-hidden rounded-[1.7rem] border border-white/8 bg-gradient-to-br from-[#1a222b] to-[#131a22] p-5 shadow-[0_20px_58px_rgba(0,0,0,0.22)] transition duration-200 hover:-translate-y-1 hover:border-[#5CB800]/35 hover:shadow-[0_26px_75px_rgba(0,0,0,0.34)]"
            >
              <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-[#5CB800]/8 blur-3xl transition group-hover:bg-[#5CB800]/14" />
              <div className="relative flex items-center justify-between">
                <span className="text-4xl drop-shadow-lg">{flags[country] ?? '🌍'}</span>
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.045] text-slate-300 transition group-hover:border-[#5CB800]/25 group-hover:text-[#76d22a]">
                  <ArrowRight className="h-5 w-5 transition group-hover:translate-x-0.5" />
                </span>
              </div>

              <div className="relative mt-5">
                <h3 className="text-2xl font-extrabold tracking-[-0.03em] text-white">{country}</h3>
                <p className="mt-2 text-sm font-bold text-slate-300">
                  {totalProjects} Projekte · {formatPowerFromKwp(totalPower)}
                </p>
              </div>

              <div className="relative mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-3">
                  <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-slate-500">Einzelprojekte</p>
                  <p className="mt-1 text-lg font-extrabold text-white">{data.count}</p>
                  <p className="mt-1 text-xs font-bold text-slate-400">{formatPowerFromKwp(data.pvKwp)}</p>
                </div>
                <div className="rounded-2xl border border-[#5CB800]/15 bg-[#5CB800]/7 p-3">
                  <div className="flex items-center gap-1.5 text-[#76d22a]">
                    <FileText className="h-3.5 w-3.5" />
                    <p className="text-[10px] font-extrabold uppercase tracking-[.14em]">Übersichten</p>
                  </div>
                  <p className="mt-1 text-lg font-extrabold text-white">{data.listCount}</p>
                  <p className="mt-1 text-xs font-bold text-[#9bea45]">{formatPowerFromKwp(data.listedKwp)}</p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
