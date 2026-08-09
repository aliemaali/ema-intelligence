import Link from 'next/link'
import { ArrowLeft, FileText, FolderOpen, MapPin, Zap } from 'lucide-react'
import { DeleteCountryProjectListButton } from '@/components/projects/DeleteCountryProjectListButton'
import { ProjectActions } from '@/components/projects/ProjectActions'
import { getProjects } from '@/lib/actions/project.actions'
import { createClient } from '@/lib/supabase/server'

const flags: Record<string, string> = { Deutschland: '🇩🇪', Frankreich: '🇫🇷', Türkei: '🇹🇷', Spanien: '🇪🇸', Italien: '🇮🇹', Niederlande: '🇳🇱' }

export default async function CountryProjectsPage({ params }: { params: { country: string } }) {
  const country = decodeURIComponent(params.country)
  const projects = (await getProjects({})).filter((project: any) => String(project.location_country ?? 'Ohne Länderzuordnung') === country)
  const supabase = await createClient()
  const { data: lists } = await supabase.from('country_project_lists').select('*').eq('country', country).order('created_at', { ascending: false })

  const projectLists = await Promise.all((lists ?? []).map(async (item: any) => {
    const { data } = await supabase.storage.from('project-documents').createSignedUrl(item.file_path, 3600)
    return { ...item, url: data?.signedUrl ?? null }
  }))

  return <div className="mx-auto w-full max-w-[1480px] space-y-6 px-3 pb-28 md:px-0">
    <Link href="/projects" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-extrabold text-[#07142F]"><ArrowLeft className="h-4 w-4" /> Länder</Link>
    <section className="rounded-[2rem] bg-[#07142F] p-6 text-white md:p-9"><p className="text-5xl">{flags[country] ?? '🌍'}</p><h1 className="mt-4 text-4xl font-extrabold md:text-6xl">{country}</h1><p className="mt-3 text-white/70">{projects.length} Projekte · {projectLists.length} gespeicherte Projektlisten</p></section>

    <section><div className="flex items-center gap-3"><FolderOpen className="h-6 w-6 text-[#5CB800]" /><h2 className="text-2xl font-extrabold text-[#07142F]">Projektlisten</h2></div>
      {projectLists.length === 0 ? <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm font-bold text-slate-500">Noch keine Projektliste gespeichert.</div> : <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{projectLists.map((item: any) => <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600"><FileText className="h-5 w-5" /></div><div className="min-w-0 flex-1"><h3 className="truncate font-extrabold text-[#07142F]">{item.display_name}</h3><p className="mt-1 text-xs font-bold text-slate-500">{item.plant_type || 'Anlagenart offen'} · {item.project_count} Projekte</p></div></div>{item.url && <a href={item.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-[#07142F] px-4 text-sm font-extrabold text-white">PDF öffnen</a>}<DeleteCountryProjectListButton id={item.id} name={item.display_name} /></article>)}</div>}
    </section>

    <section><h2 className="text-2xl font-extrabold text-[#07142F]">Alle Projekte</h2>
      {projects.length === 0 ? <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm font-bold text-slate-500">In diesem Land sind noch keine einzelnen Projekte angelegt.</div> : <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{projects.map((project: any) => <article key={project.id} className="overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white shadow-sm transition hover:border-[#5CB800]/50"><Link href={`/projects/${project.id}/overview`} className="block p-5"><p className="text-xs font-extrabold uppercase tracking-wider text-[#5CB800]">{project.project_number || 'Ohne Projektnummer'}</p><h3 className="mt-2 text-xl font-extrabold text-[#07142F]">{project.project_name}</h3><div className="mt-4 space-y-2 text-sm font-bold text-slate-500"><p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-[#5CB800]" />{project.location_city || project.location_state || country}</p><p className="flex items-center gap-2"><Zap className="h-4 w-4 text-[#5CB800]" />{Number(project.pv_kwp ?? project.pv_mwp ?? 0).toLocaleString('de-DE')} kWp</p></div></Link><div className="flex justify-end border-t border-slate-100 px-4 py-3"><ProjectActions projectId={project.id} projectName={project.project_name} /></div></article>)}</div>}
    </section>
  </div>
}
