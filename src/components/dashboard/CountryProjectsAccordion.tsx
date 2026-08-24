'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, ChevronDown, MapPin } from 'lucide-react'
import { formatEnergyFromMwh, formatPowerFromKwp, formatPowerFromMw } from '@/lib/format/power'
import { formatProjectLocationLabel } from '@/lib/projects/location'

type Project = Record<string, any>
type ProjectListSummary = { country: string; project_count: number; total_kwp?: number | null; created_at: string }

const flags: Record<string, string> = {
  Deutschland: '🇩🇪',
  Frankreich: '🇫🇷',
  Italien: '🇮🇹',
  Spanien: '🇪🇸',
  Türkei: '🇹🇷',
  Niederlande: '🇳🇱',
}

function projectPower(project: Project) {
  if (project.project_type === 'rechenzentrum') {
    const parts: string[] = []
    if (project.data_center_grid_mw) parts.push(`${formatPowerFromMw(Number(project.data_center_grid_mw))} Netz`)
    if (project.data_center_it_mw) parts.push(`${formatPowerFromMw(Number(project.data_center_it_mw))} IT`)
    return parts.join(' / ') || 'Leistung offen'
  }
  if (project.project_type === 'sonstiges') return 'Individuell'
  const parts: string[] = []
  const pvKwp = Number(project.pv_kwp ?? project.pv_mwp ?? project.capacity_kwp ?? 0)
  const bessMwh = Number(project.bess_mwh ?? project.storage_capacity_mwh ?? 0)
  if (pvKwp) parts.push(formatPowerFromKwp(pvKwp))
  if (bessMwh) parts.push(formatEnergyFromMwh(bessMwh))
  return parts.join(' / ') || 'Leistung offen'
}

function fallbackImage(type?: string | null) {
  if (type === 'pv_dach') return '/project-dach.svg'
  if (type === 'bess') return '/project-bess.svg'
  if (type === 'wind') return '/hero-wind.svg'
  if (type === 'rechenzentrum') return '/hero-datacenter.webp'
  if (type === 'sonstiges') return '/hero-generic-project.svg'
  return '/project-freiflaeche.svg'
}

export function CountryProjectsAccordion({ projects, projectLists }: { projects: Project[]; projectLists: ProjectListSummary[] }) {
  const latestListByCountry = new Map<string, ProjectListSummary>()
  for (const list of projectLists) {
    const country = String(list.country || '').trim()
    if (country && !latestListByCountry.has(country)) latestListByCountry.set(country, list)
  }

  const grouped = new Map<string, { projects: Project[]; activeKwp: number; listedCount: number; listedKwp: number }>()
  for (const project of projects) {
    const country = String(project.location_country || 'Ohne Länderzuordnung')
    const current = grouped.get(country) ?? { projects: [], activeKwp: 0, listedCount: 0, listedKwp: 0 }
    current.projects.push(project)
    current.activeKwp += Number(project.pv_kwp ?? project.pv_mwp ?? project.capacity_kwp ?? 0)
    grouped.set(country, current)
  }
  for (const [country, list] of latestListByCountry) {
    const current = grouped.get(country) ?? { projects: [], activeKwp: 0, listedCount: 0, listedKwp: 0 }
    current.listedCount = Number(list.project_count ?? 0)
    current.listedKwp = Number(list.total_kwp ?? 0)
    grouped.set(country, current)
  }

  const countries = Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b, 'de'))
  if (countries.length === 0) return <p className="rounded-2xl border border-blue-200/10 bg-blue-300/5 px-4 py-6 text-sm text-slate-400">Noch keine Projekte vorhanden.</p>

  return (
    <div className="space-y-3">
      {countries.map(([country, data]) => {
        const totalCount = data.projects.length + data.listedCount
        const totalKwp = data.activeKwp + data.listedKwp
        return (
          <details key={country} className="group overflow-hidden rounded-[1.35rem] border border-blue-200/15 bg-[#081c3a]/80 shadow-[inset_0_1px_0_rgba(255,255,255,.04),0_16px_36px_rgba(0,0,0,.18)]">
            <summary className="flex min-h-20 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
              <div className="flex min-w-0 items-center gap-3">
                <span className="text-3xl">{flags[country] ?? '🌍'}</span>
                <div className="min-w-0">
                  <h3 className="truncate font-extrabold text-white">{country}</h3>
                  <p className="mt-1 text-xs font-bold text-slate-400">{totalCount} {totalCount === 1 ? 'Projekt' : 'Projekte'} · <span className="text-[#80eb42]">{formatPowerFromKwp(totalKwp)}</span></p>
                </div>
              </div>
              <ChevronDown className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
            </summary>

            <div className="border-t border-blue-200/10 bg-[#04142f]/70 p-3">
              {data.projects.length > 0 ? (
                <div className="space-y-3">
                  {data.projects.map((project) => (
                    <Link key={project.id} href={`/projects/${project.id}/overview`} className="premium-lift block rounded-[1.2rem] border border-blue-200/15 bg-gradient-to-br from-[#102b55]/88 to-[#071a38]/94 p-3 shadow-[0_14px_32px_rgba(0,0,0,.20)]">
                      <div className="flex gap-3">
                        <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                          <Image src={project.project_image_url || fallbackImage(project.project_type)} alt={project.project_name || 'Projekt'} fill quality={92} sizes="80px" className="object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2"><p className="truncate font-extrabold text-white">{project.project_name || project.project_number}</p><ArrowRight className="h-4 w-4 shrink-0 text-[#80eb42]" /></div>
                          <p className="mt-1 flex items-center gap-1 truncate text-xs text-slate-400"><MapPin className="h-3.5 w-3.5" />{formatProjectLocationLabel(project.location_country, project.location_city, project.location_state)}</p>
                          <p className="mt-1 truncate text-xs font-extrabold text-blue-300">{projectPower(project)}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-blue-200/10 bg-blue-300/5 px-4 py-3 text-sm text-slate-400">Die Projekte sind aktuell als gemeinsame Projektübersicht gespeichert.</p>
              )}
              <Link href={`/projects/country/${encodeURIComponent(country)}`} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-full border border-[#80eb42]/20 bg-[#80eb42]/10 px-4 py-2 text-xs font-extrabold text-[#9af45f] shadow-[0_0_24px_rgba(117,238,53,.08)]">Land öffnen <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </details>
        )
      })}
    </div>
  )
}
