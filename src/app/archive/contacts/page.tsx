import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Building2, Mail, UserRound, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ContactArchiveActions } from '@/components/archive/ContactArchiveActions'

export const metadata = { title:'Kontakte Archiv' }

export default async function ContactsArchivePage() {
  const supabase = await createClient()
  const { data:{ user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const [investorsResult,partnersResult] = await Promise.all([
    supabase.from('investors').select('id,company_name,contact_person,email').eq('is_active',false).order('updated_at',{ ascending:false }),
    supabase.from('partners').select('id,company,full_name,email,category').eq('user_id',user.id).eq('is_active',false).order('updated_at',{ ascending:false }),
  ])
  const investors = investorsResult.data ?? []
  const partners = partnersResult.data ?? []
  const total = investors.length + partners.length

  return <div className="mx-auto w-full max-w-3xl space-y-5 px-4 pb-6 pt-[calc(env(safe-area-inset-top)+1rem)]">
    <header><Link href="/archive" aria-label="Zurück zum Archiv" className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-[#07142F] shadow-sm"><ArrowLeft className="h-6 w-6" /></Link><p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#5CB800]">Archiv</p><h1 className="text-3xl font-extrabold text-[#07142F]">Kontakte</h1><p className="mt-2 text-slate-500">Archivierte Investoren und Partner getrennt von den aktiven Kontakten verwalten.</p></header>
    {!total ? <div className="rounded-[2rem] border bg-white p-8 text-center"><Users className="mx-auto text-slate-300" /><p className="mt-3 font-bold text-[#07142F]">Keine archivierten Kontakte</p><p className="mt-1 text-sm text-slate-500">Archivierte Investoren und Partner erscheinen hier.</p></div> : <div className="space-y-6">
      {investors.length > 0 && <section><div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-extrabold text-[#07142F]">Investoren</h2><span className="rounded-full bg-white px-3 py-1 text-sm font-extrabold shadow-sm">{investors.length}</span></div><div className="space-y-3">{investors.map((investor) => { const name=investor.company_name || investor.contact_person || 'Investor'; return <article key={investor.id} className="rounded-[1.5rem] border bg-white p-5 shadow-sm"><div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#1F2A44]/8"><Building2 className="h-5 w-5" /></span><div className="min-w-0"><p className="text-xs font-extrabold uppercase tracking-wide text-[#5CB800]">Investor</p><h3 className="mt-1 font-extrabold text-[#07142F]">{name}</h3>{investor.contact_person && <p className="mt-1 flex items-center gap-1 text-sm text-slate-500"><UserRound className="h-4 w-4" />{investor.contact_person}</p>}{investor.email && <p className="mt-1 flex items-center gap-1 text-sm text-slate-500"><Mail className="h-4 w-4" />{investor.email}</p>}</div></div><ContactArchiveActions kind="investor" id={investor.id} name={name} /></article> })}</div></section>}
      {partners.length > 0 && <section><div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-extrabold text-[#07142F]">Partner</h2><span className="rounded-full bg-white px-3 py-1 text-sm font-extrabold shadow-sm">{partners.length}</span></div><div className="space-y-3">{partners.map((partner) => { const name=partner.company || partner.full_name; return <article key={partner.id} className="rounded-[1.5rem] border bg-white p-5 shadow-sm"><div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#1F2A44]/8"><Users className="h-5 w-5" /></span><div className="min-w-0"><p className="text-xs font-extrabold uppercase tracking-wide text-[#5CB800]">{partner.category || 'Partner'}</p><h3 className="mt-1 font-extrabold text-[#07142F]">{name}</h3>{partner.full_name && partner.company && <p className="mt-1 flex items-center gap-1 text-sm text-slate-500"><UserRound className="h-4 w-4" />{partner.full_name}</p>}{partner.email && <p className="mt-1 flex items-center gap-1 text-sm text-slate-500"><Mail className="h-4 w-4" />{partner.email}</p>}</div></div><ContactArchiveActions kind="partner" id={partner.id} name={name} /></article> })}</div></section>}
    </div>}
  </div>
}
