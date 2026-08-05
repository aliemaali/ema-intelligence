import Link from 'next/link'
import { ArrowRight, FolderOpen } from 'lucide-react'

const flags: Record<string, string> = { Deutschland: '🇩🇪', Frankreich: '🇫🇷', Türkei: '🇹🇷', Spanien: '🇪🇸', Italien: '🇮🇹', Niederlande: '🇳🇱' }

type ProjectListSummary = { country: string; project_count: number; total_kwp: number; created_at: string }

export function CountryProjectFolders({ projects, projectLists }: { projects: any[]; projectLists: ProjectListSummary[] }) {
  const grouped = new Map<string, { count: number; pvKwp: number; listCount: number; listedProjects: number; listedKwp: number }>()
  for (const project of projects) {
    const country = String(project.location_country || 'Ohne Länderzuordnung')
    const current = grouped.get(country) ?? { count: 0, pvKwp: 0, listCount: 0, listedProjects: 0, listedKwp: 0 }
    current.count += 1
    current.pvKwp += Number(project.pv_kwp ?? project.pv_mwp ?? project.capacity_kwp ?? 0)
    grouped.set(country, current)
  }

  const latestListSeen = new Set<string>()
  for (const list of projectLists) {
    const country = String(list.country || 'Ohne Länderzuordnung')
    const current = grouped.get(country) ?? { count: 0, pvKwp: 0, listCount: 0, listedProjects: 0, listedKwp: 0 }
    current.listCount += 1
    if (!latestListSeen.has(country)) {
      current.listedProjects = Number(list.project_count ?? 0)
      current.listedKwp = Number(list.total_kwp ?? 0)
      latestListSeen.add(country)
    }
    grouped.set(country, current)
  }

  const countries = Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b, 'de'))
  return <section className="px-3 md:px-0">
    <div className="flex items-center gap-3"><FolderOpen className="h-6 w-6 text-[#5CB800]" /><div><p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#5CB800]">Länderordner</p><h2 className="mt-1 text-3xl font-extrabold text-[#07142F]">Projekte nach Ländern</h2></div></div>
    <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{countries.map(([country, data]) => <Link key={country} href={`/projects/country/${encodeURIComponent(country)}`} className="group rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 hover:border-[#5CB800]/40"><div className="flex items-center justify-between"><span className="text-4xl">{flags[country] ?? '🌍'}</span><ArrowRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-[#5CB800]" /></div><h3 className="mt-4 text-2xl font-extrabold text-[#07142F]">{country}</h3><p className="mt-2 text-sm font-bold text-slate-500">{data.count} aktive Projekte</p>{data.listCount > 0 && <><p className="mt-1 text-xs font-extrabold text-[#2F8A00]">{data.listedProjects} Projekte in {data.listCount} Projektliste{data.listCount === 1 ? '' : 'n'}</p><p className="mt-1 text-xs font-extrabold text-[#2F8A00]">{data.listedKwp.toLocaleString('de-DE')} kWp in Projektliste</p></>}<p className="mt-1 text-xs font-bold text-slate-400">{data.pvKwp.toLocaleString('de-DE')} kWp aktiv</p></Link>)}</div>
  </section>
}
