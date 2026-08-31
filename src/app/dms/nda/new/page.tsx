import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, FileSignature } from 'lucide-react'
import { redirect } from 'next/navigation'
import { NdaGeneratorForm } from '@/components/templates/NdaGenerator'
import { createClient } from '@/lib/supabase/server'
import type { DocumentInvestor } from '@/lib/templates/documentTypes'

export const metadata = { title: 'NDA erstellen · EMA DMS' }
export const dynamic = 'force-dynamic'

export default async function NewNdaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/dms/nda/new')

  const { data } = await supabase
    .from('investors')
    .select('id, full_name, contact_person, company, company_name, email, phone, street_address, postal_code, location_city, location_country, country, status, is_active')
    .eq('user_id', user.id)
    .neq('status', 'Inaktiv')
    .order('company_name')

  const investors: DocumentInvestor[] = (data ?? [])
    .filter((investor: any) => investor.is_active !== false)
    .map((investor: any) => ({
      id: investor.id,
      company: investor.company_name || investor.company || investor.full_name || '',
      contactPerson: investor.contact_person || investor.full_name || '',
      email: investor.email || '',
      phone: investor.phone || '',
      street: investor.street_address || '',
      postalCode: investor.postal_code || '',
      city: investor.location_city || '',
      country: investor.location_country || investor.country || '',
    }))

  return <main className="dms-premium min-h-screen px-3 pb-10 pt-[calc(env(safe-area-inset-top)+1rem)] md:px-7 md:py-7"><div className="mx-auto max-w-4xl"><header className="dms-hero mb-5 rounded-[2rem] p-5 md:p-7"><div className="flex items-center justify-between gap-4"><Link href="/dms" className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-extrabold text-white"><ArrowLeft className="h-4 w-4" /> DMS</Link><Link href="/apps" aria-label="EMA Startzentrale"><Image src="/brand/ema-mark-white.png" alt="EMA" width={506} height={247} className="h-auto w-24" /></Link></div><div className="mt-6 flex items-center gap-4"><span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#5CB800]/15 text-[#8eee51]"><FileSignature className="h-7 w-7" /></span><div><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#8eee51]">EMA DMS · Dokument erstellen</p><h1 className="mt-1 text-3xl font-extrabold text-white md:text-4xl">NDA</h1><p className="mt-1 text-sm text-slate-300">Deutsch und Englisch in einem gemeinsamen PDF.</p></div></div></header><NdaGeneratorForm userId={user.id} investors={investors} /></div></main>
}
