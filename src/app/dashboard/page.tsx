import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, BatteryCharging, Building2, FolderOpen, Layers, Zap } from 'lucide-react'
import { CountryProjectsAccordion } from '@/components/dashboard/CountryProjectsAccordion'
import { ProjectMap } from '@/components/dashboard/ProjectMap'
import { TimeGreeting } from '@/components/dashboard/TimeGreeting'
import { PlaudDashboardCard } from '@/components/dashboard/PlaudDashboardCard'
import { getProjects } from '@/lib/actions/project.actions'
import { formatEnergyFromMwh, formatPowerFromKwp, formatPowerFromMw } from '@/lib/format/power'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Dashboard' }
type KpiTone = 'blue' | 'green' | 'violet' | 'orange'
const KPI_TONES: Record<KpiTone, string> = {
  blue: 'from-[#173875]/92 via-[#102955]/96 to-[#071a38] border-blue-300/20 text-blue-300 shadow-blue-500/10',
  green: 'from-[#244a32]/94 via-[#173b37]/96 to-[#092338] border-[#86ee43]/24 text-[#8bf04a] shadow-[#73e636]/10',
  violet: 'from-[#28356e]/92 via-[#172b5c]/96 to-[#091a38] border-violet-300/20 text-violet-300 shadow-violet-500/10',
  orange: 'from-[#473c2a]/92 via-[#23334e]/96 to-[#091a38] border-orange-300/20 text-orange-300 shadow-orange-500/10',
}
function KpiCard({ title, value, subtitle, icon, tone, href }: { title: string; value: string | number; subtitle: string; icon: ReactNode; tone: KpiTone; href: string }) {
  return <Link href={href} className={`premium-lift relative min-w-0 overflow-hidden rounded-[1.45rem] border bg-gradient-to-br p-3 shadow-[0_18px_45px_rgba(0,0,0,.28)] md:p-5 ${KPI_TONES[tone]}`}><span className="ema-glow-pulse pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-current opacity-10 blur-3xl" /><div className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,.12)]">{icon}</div><p className="relative mt-4 text-[9px] font-extrabold uppercase tracking-[.14em] text-slate-300">{title}</p><p className="relative mt-1 overflow-hidden whitespace-nowrap text-2xl font-extrabold text-white">{value}</p><p className="relative mt-1 text-[10px] text-slate-400">{subtitle}</p></Link>
}
export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user ? await supabase.from('profiles').select('full_name,email').eq('id', user.id).maybeSingle() : { data: null }
  const displayName = profile?.full_name?.trim() || user?.user_metadata?.full_name?.trim() || profile?.email || user?.email || 'Nutzer'
  const firstName = displayName.split(/\s+/)[0] || 'Nutzer'
  const [projects, submissionsResult, projectListsResult, plaudResult, plaudNotes] = await Promise.all([
    getProjects({}),
    supabase.from('project_submissions').select('id,partner_user_id,project_name,project_type,location_city,location_state,status,submitted_at,pv_kwp,bess_mwh').in('status', ['eingereicht', 'in_pruefung', 'rueckfrage']).order('submitted_at', { ascending: false }).limit(5),
    supabase.from('country_project_lists').select('country,project_count,total_kwp,created_at').order('created_at', { ascending: false }),
    user ? supabase.from('plaud_items').select('kind,status').eq('user_id', user.id).eq('status', 'open') : Promise.resolve({ data: [] }),
    user ? supabase.from('plaud_notes').select('id').eq('user_id', user.id).is('archived_at', null) : Promise.resolve({ data: [] }),
  ])
  const partnerSubmissions = submissionsResult.data ?? []
  const partnerIds = Array.from(new Set(partnerSubmissions.map((submission: any) => submission.partner_user_id).filter(Boolean)))
  const partnerNames = new Map<string, string>()
  if (partnerIds.length) { const { data: partners } = await supabase.from('profiles').select('id,full_name,company,email').in('id', partnerIds); for (const partner of partners ?? []) partnerNames.set(partner.id, partner.company || partner.full_name || partner.email || 'Vertriebspartner') }
  const latest = new Map<string, { count: number; totalKwp: number }>()
  for (const list of projectListsResult.data ?? []) { const country = String((list as any).country || '').trim(); if (country && !latest.has(country)) latest.set(country, { count: Number((list as any).project_count ?? 0), totalKwp: Number((list as any).total_kwp ?? 0) }) }
  const projectsInLists = [...latest.values()].reduce((sum, item) => sum + item.count, 0)
  const listKwp = [...latest.values()].reduce((sum, item) => sum + item.totalKwp, 0)
  const activePv = projects.filter((project: any) => ['pv_freiflaeche', 'pv_dach', 'hybrid'].includes(project.project_type))
  const activeKwp = activePv.reduce((sum: number, project: any) => sum + Number(project.pv_kwp ?? project.pv_mwp ?? 0), 0)
  const totalKwp = activeKwp + listKwp
  const totalBess = projects.reduce((sum: number, project: any) => sum + Number(project.bess_mwh ?? 0), 0)
  const dataCenters = projects.filter((project: any) => project.project_type === 'rechenzentrum')
  const confirmed = dataCenters.reduce((sum: number, project: any) => sum + (project.data_center_grid_confirmed ? Number(project.data_center_grid_mw ?? 0) : 0), 0)
  const unconfirmed = dataCenters.reduce((sum: number, project: any) => sum + (!project.data_center_grid_confirmed ? Number(project.data_center_grid_mw ?? 0) : 0), 0)
  const mapProjects = projects.filter((project: any) => project.location_city || project.location_state).slice(0, 50)
  const plaudOpen = plaudResult.data ?? []; const appointments = plaudOpen.filter((item: any) => item.kind === 'appointment').length; const tasks = plaudOpen.filter((item: any) => item.kind === 'task').length; const recordings = (plaudNotes.data ?? []).length
  return <div className="relative w-full max-w-full space-y-6 overflow-x-hidden pb-4 md:mx-auto md:max-w-[1480px]">
    <section className="relative isolate overflow-hidden border-b border-blue-300/15 bg-[#06152f] md:min-h-[25rem] md:rounded-b-[2.4rem]">
      <div className="relative aspect-[2/1] w-full bg-[#06152f] md:absolute md:inset-0 md:aspect-auto"><Image src="/hero-dashboard-enterprise.jpg" alt="EMA Enterprise Portfolio aus BESS, Photovoltaik, Windkraft und Rechenzentrum" fill priority quality={95} sizes="(max-width: 767px) 100vw, (max-width: 1480px) 100vw, 1480px" className="object-contain object-top md:object-cover md:object-[50%_32%] md:opacity-90 md:saturate-[1.02]" /><div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#06152f]/35 md:bg-gradient-to-r md:from-[#020b1d]/90 md:via-[#071a38]/60 md:to-[#102c62]/20" /></div>
      <div className="relative z-10 bg-gradient-to-b from-[#06152f] via-[#06152f] to-[#031027] px-5 pb-5 pt-4 md:flex md:min-h-[25rem] md:items-center md:bg-transparent md:px-10 md:py-0"><div className="max-w-2xl"><div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#071a38]/68 px-3 py-1.5 text-white shadow-[0_0_24px_rgba(92,184,0,.12)] backdrop-blur-xl"><span className="h-2 w-2 rounded-full bg-[#7bed3e] shadow-[0_0_15px_rgba(123,237,62,.9)]" /><TimeGreeting /></div><h1 className="mt-3 whitespace-nowrap text-4xl font-extrabold tracking-tight text-white md:mt-5 md:whitespace-normal md:text-5xl"><span className="md:hidden">Hallo <span className="bg-gradient-to-r from-[#8df24f] to-[#57a9ff] bg-clip-text text-transparent">{firstName}</span></span><span className="hidden md:inline">Willkommen zurück,<br /><span className="bg-gradient-to-r from-[#8df24f] to-[#57a9ff] bg-clip-text text-transparent">{firstName}</span>{' '}👋</span></h1><p className="mt-3 hidden max-w-xl text-slate-200 md:block md:mt-4">Dein Portfolio, deine Projekte und alle wichtigen Aktivitäten auf einen Blick.</p><div className="mt-7 hidden flex-wrap gap-3 md:flex"><Link href="/projects/new" className="rounded-2xl bg-gradient-to-r from-[#65c91d] to-[#82e33e] px-5 py-3 font-extrabold text-[#07142F] shadow-[0_12px_34px_rgba(108,224,44,.26)]">+ Neues Projekt</Link><Link href="/projects" className="rounded-2xl border border-blue-200/20 bg-blue-300/10 px-5 py-3 font-extrabold text-white shadow-[0_12px_32px_rgba(28,79,204,.18)] backdrop-blur-xl">Alle Projekte <ArrowRight className="inline h-4 w-4" /></Link></div></div></div>
    </section>
    <div className="grid grid-cols-2 gap-2 px-3 sm:grid-cols-4 md:px-0"><KpiCard href="/projects?view=all&group=pv" title="PV-Projekte" value={activePv.length + projectsInLists} subtitle={`${activePv.length} aktiv · ${projectsInLists} in Übersichten`} tone="green" icon={<FolderOpen />} /><KpiCard href="/projects?view=all&group=pv" title="PV-Leistung" value={formatPowerFromKwp(totalKwp)} subtitle={`${formatPowerFromKwp(activeKwp)} aktiv · ${formatPowerFromKwp(listKwp)} weitere`} tone="blue" icon={<Zap />} /><KpiCard href="/projects?view=all&group=bess" title="BESS-Kapazität" value={formatEnergyFromMwh(totalBess)} subtitle="Aktive Speicherkapazität" tone="violet" icon={<BatteryCharging />} /><KpiCard href="/projects?view=all&type=rechenzentrum" title="Rechenzentren" value={`${dataCenters.length} ${dataCenters.length === 1 ? 'Standort' : 'Standorte'}`} subtitle={`${formatPowerFromMw(confirmed)} bestätigt${unconfirmed ? ` · ${formatPowerFromMw(unconfirmed)} in Prüfung` : ''}`} tone="orange" icon={<Building2 />} /></div>
    <PlaudDashboardCard recordings={recordings} appointments={appointments} tasks={tasks} />
    {partnerSubmissions.length > 0 ? <section className="card-padded mx-3 rounded-[2rem] md:mx-0"><h2 className="text-xl font-extrabold text-white">Neue Einreichungen</h2>{partnerSubmissions.map((submission: any) => <Link key={submission.id} href={`/partner-submissions/${submission.id}`} className="mt-3 flex items-center justify-between rounded-xl border border-blue-200/15 bg-blue-300/5 p-3 text-slate-200 transition hover:border-[#7bed3e]/25 hover:bg-[#7bed3e]/5"><span>{submission.project_name} · {partnerNames.get(submission.partner_user_id) || 'Vertriebspartner'}</span><ArrowRight /></Link>)}</section> : null}
    <div className="grid grid-cols-1 gap-5 px-3 md:px-0 xl:grid-cols-[.92fr_1.45fr]"><div className="card-padded rounded-[2rem]"><h2 className="mb-4 text-2xl font-extrabold text-white">Aktuelle Projekte</h2><CountryProjectsAccordion projects={projects} projectLists={(projectListsResult.data ?? []) as any[]} /></div><div className="card-padded rounded-[2rem]"><div className="mb-4 flex justify-between text-slate-200"><h2 className="text-2xl font-extrabold text-white">Projektstandorte</h2><span><Layers className="inline h-4 w-4 text-[#80eb42]" /> {mapProjects.length}</span></div><ProjectMap projects={mapProjects} /></div></div>
  </div>
}
