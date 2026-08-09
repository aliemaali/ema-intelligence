import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Search, Send } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { DeliveryHistoryCard } from '@/components/dispatch/DeliveryHistoryCard'

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
    <div className="mx-auto w-full max-w-[1280px] space-y-5 px-3 pb-28 pt-[calc(env(safe-area-inset-top)+0.75rem)] md:px-0 md:pt-0">
      <section className="overflow-hidden rounded-[2rem] bg-[#07142F] px-5 pb-6 pt-5 text-white shadow-[0_20px_55px_rgba(15,23,42,0.16)] md:px-10 md:py-9">
        <Link href="/projects" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-extrabold ring-1 ring-white/15"><ArrowLeft className="h-4 w-4" /> Projekte</Link>
        <div className="mt-6 flex flex-col gap-5 md:mt-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.22em] text-[#87D33B]">Versandcenter</p>
            <h1 className="mt-2 text-4xl font-extrabold md:text-5xl">Versandhistorie</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">Alle versendeten Exposés mit Projekt, Empfänger, Versandweg und Zeitpunkt.</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[['Gesamt', deliveries.length], ['E-Mail', emailCount], ['WhatsApp', whatsappCount]].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl bg-white/10 px-3 py-3 text-center md:px-4">
                <p className="text-2xl font-extrabold">{value}</p>
                <p className="text-[10px] font-bold uppercase text-white/60">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[1.8rem] border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <form className="grid gap-3 md:grid-cols-[1fr_auto]" action="/dispatch/history">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 px-3"><Search className="h-5 w-5 text-slate-400" /><input name="q" defaultValue={searchParams.q ?? ''} placeholder="Projekt, Empfänger oder E-Mail suchen" className="min-h-12 min-w-0 flex-1 bg-transparent text-sm outline-none" /></div>
          <div className="grid grid-cols-[1fr_auto] gap-2"><select name="channel" defaultValue={channel} className="min-h-12 min-w-0 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-[#07142F]"><option value="">Alle Versandwege</option><option value="email">E-Mail</option><option value="whatsapp">WhatsApp</option></select><button className="min-h-12 rounded-2xl bg-[#07142F] px-5 text-sm font-extrabold text-white">Filtern</button></div>
        </form>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">Die Versandhistorie konnte nicht geladen werden.</div>
      ) : rows.length === 0 ? (
        <div className="rounded-[1.8rem] border border-dashed border-slate-300 bg-white p-10 text-center"><Send className="mx-auto h-10 w-10 text-slate-300" /><h2 className="mt-3 text-xl font-extrabold text-[#07142F]">Noch keine Einträge</h2><p className="mt-2 text-sm text-slate-500">Sobald ein Exposé versendet oder geteilt wurde, erscheint es hier.</p></div>
      ) : (
        <div className="space-y-3">{rows.map((item: any) => {
          const project = Array.isArray(item.projects) ? item.projects[0] : item.projects
          return <DeliveryHistoryCard key={item.id} item={{
            id: item.id,
            projectId: item.project_id,
            projectName: project?.project_name || 'Projekt',
            projectNumber: project?.project_number || 'Ohne Nummer',
            recipientName: item.recipient_name || (item.channel === 'whatsapp' ? 'WhatsApp-Kontakt' : 'Empfänger'),
            recipientEmail: item.recipient_email,
            channel: item.channel,
            status: item.status,
            sentAt: item.sent_at,
          }} />
        })}</div>
      )}
    </div>
  )
}
