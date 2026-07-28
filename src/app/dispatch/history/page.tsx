import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Clock3, FileText, Mail, MessageCircle, Search, Send } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Versandhistorie' }

export default async function DispatchHistoryPage({ searchParams }: { searchParams: { q?: string; channel?: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data, error } = await (supabase as any)
    .from('document_deliveries')
    .select('id, project_id, document_type, recipient_name, recipient_email, recipient_type, channel, status, sent_at, projects(project_name, project_number)')
    .eq('user_id', user.id)
    .order('sent_at', { ascending: false })
    .limit(500)

  const deliveries = data ?? []
  const q = (searchParams.q ?? '').trim().toLocaleLowerCase('de-DE')
  const channel = searchParams.channel ?? ''
  const rows = deliveries.filter((item: any) => {
    const project = Array.isArray(item.projects) ? item.projects[0] : item.projects
    const matchesText = !q || [project?.project_name, project?.project_number, item.recipient_name, item.recipient_email]
      .some((value) => String(value ?? '').toLocaleLowerCase('de-DE').includes(q))
    return matchesText && (!channel || item.channel === channel)
  })

  const emailCount = deliveries.filter((item: any) => item.channel === 'email').length
  const whatsappCount = deliveries.filter((item: any) => item.channel === 'whatsapp').length

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-6 px-3 pb-28 md:px-0">
      <section className="overflow-hidden rounded-[2rem] bg-[#07142F] px-6 py-7 text-white shadow-[0_20px_55px_rgba(15,23,42,0.16)] md:px-10 md:py-9">
        <Link href="/projects" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-extrabold ring-1 ring-white/15"><ArrowLeft className="h-4 w-4" /> Projekte</Link>
        <div className="mt-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div><p className="text-xs font-extrabold uppercase tracking-[.22em] text-[#87D33B]">Versandcenter</p><h1 className="mt-2 text-4xl font-extrabold md:text-5xl">Versandhistorie</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">Alle versendeten Investment Memoranden mit Projekt, Empfänger, Versandweg und Zeitpunkt.</p></div>
          <div className="grid grid-cols-3 gap-2">
            {[['Gesamt', deliveries.length], ['E-Mail', emailCount], ['WhatsApp', whatsappCount]].map(([label, value]) => <div key={String(label)} className="rounded-2xl bg-white/10 px-4 py-3 text-center"><p className="text-2xl font-extrabold">{value}</p><p className="text-[10px] font-bold uppercase text-white/60">{label}</p></div>)}
          </div>
        </div>
      </section>

      <section className="rounded-[1.8rem] border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <form className="grid gap-3 md:grid-cols-[1fr_auto]" action="/dispatch/history">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 px-3"><Search className="h-5 w-5 text-slate-400" /><input name="q" defaultValue={searchParams.q ?? ''} placeholder="Projekt, Empfänger oder E-Mail suchen" className="min-h-12 min-w-0 flex-1 bg-transparent text-sm outline-none" /></div>
          <div className="flex gap-2"><select name="channel" defaultValue={channel} className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-[#07142F]"><option value="">Alle Versandwege</option><option value="email">E-Mail</option><option value="whatsapp">WhatsApp</option></select><button className="min-h-12 rounded-2xl bg-[#07142F] px-5 text-sm font-extrabold text-white">Filtern</button></div>
        </form>
      </section>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">Die Versandhistorie konnte nicht geladen werden.</div> : rows.length === 0 ? <div className="rounded-[1.8rem] border border-dashed border-slate-300 bg-white p-10 text-center"><Send className="mx-auto h-10 w-10 text-slate-300" /><h2 className="mt-3 text-xl font-extrabold text-[#07142F]">Noch keine Einträge</h2><p className="mt-2 text-sm text-slate-500">Sobald ein Memorandum versendet oder geteilt wurde, erscheint es hier.</p></div> : <div className="space-y-3">{rows.map((item: any) => {
        const project = Array.isArray(item.projects) ? item.projects[0] : item.projects
        const isWhatsapp = item.channel === 'whatsapp'
        return <article key={item.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm md:p-5"><div className="flex items-start gap-3"><div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${isWhatsapp ? 'bg-[#5CB800]/10 text-[#4A9D00]' : 'bg-[#07142F]/8 text-[#07142F]'}`}>{isWhatsapp ? <MessageCircle className="h-5 w-5" /> : <Mail className="h-5 w-5" />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-base font-extrabold text-[#07142F]">{project?.project_name || 'Projekt'}</h2><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-extrabold uppercase text-slate-500">{project?.project_number || 'Ohne Nummer'}</span></div><p className="mt-1 truncate text-sm text-slate-600">{item.recipient_name}{item.recipient_email ? ` · ${item.recipient_email}` : ''}</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-bold text-slate-500"><span className="inline-flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Investment Memorandum</span><span className="inline-flex items-center gap-1.5">{isWhatsapp ? <MessageCircle className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}{isWhatsapp ? 'WhatsApp' : 'E-Mail'}</span><span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />{new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.sent_at))}</span></div></div><span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[10px] font-extrabold uppercase ${item.status === 'failed' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}><CheckCircle2 className="h-3.5 w-3.5" />{item.status === 'shared' ? 'Geteilt' : item.status === 'failed' ? 'Fehlgeschlagen' : 'Versendet'}</span></div>{item.project_id && <div className="mt-4 border-t border-slate-100 pt-3"><Link href={`/projects/${item.project_id}/overview`} className="text-xs font-extrabold text-[#3D9200]">Projekt öffnen →</Link></div>}</article>
      })}</div>}
    </div>
  )
}
