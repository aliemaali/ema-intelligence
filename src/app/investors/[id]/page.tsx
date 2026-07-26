import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Building2, ChevronLeft, ExternalLink, Globe2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ContactDocuments } from '@/components/crm/ContactDocuments'
import { InvestorSearchProfileSummary } from '@/components/investors-crm/InvestorSearchProfileSummary'
import {
  getAutomaticInvestorLogoUrl,
  getInvestorFlagUrl,
  getInvestorInitials,
  normalizeInvestorWebsite,
} from '@/lib/investors/identity'
import type { InvestorSearchProfile } from '@/types/investors'

export default async function InvestorDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: investor } = await supabase
    .from('investors')
    .select('id, company_name, contact_person, position_title, email, phone, website, country, logo_url, location_city, location_country, focus, status, notes, search_profile, profile_imported_at')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!investor) notFound()
  const searchProfile = investor.search_profile && Object.keys(investor.search_profile as object).length > 0
    ? investor.search_profile as InvestorSearchProfile
    : null
  const website = normalizeInvestorWebsite(investor.website)
  const country = investor.country || investor.location_country
  const flagUrl = getInvestorFlagUrl(country)
  const logoUrl = investor.logo_url || getAutomaticInvestorLogoUrl(website)

  return (
    <div className="page-container max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/investors" className="btn-icon"><ChevronLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="page-title">Investorenakte</h1>
          <p className="mt-1 text-sm text-muted-foreground">{investor.company_name} · {investor.contact_person}</p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-4 border-b border-slate-100 pb-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white text-sm font-extrabold text-[#1F2A44] shadow-sm">
            {logoUrl ? <img src={logoUrl} alt={`${investor.company_name} Logo`} className="h-full w-full object-contain p-2" /> : investor.company_name ? getInvestorInitials(investor.company_name) : <Building2 className="h-6 w-6" />}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-xl font-extrabold text-[#07142F]">{investor.company_name}</h2>
            <p className="mt-1 text-sm text-slate-500">{investor.contact_person}{investor.position_title ? ` · ${investor.position_title}` : ''}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-2 text-slate-600">
                {flagUrl ? <img src={flagUrl} alt="" className="h-3.5 w-5 rounded-sm object-cover shadow-sm" /> : <Globe2 className="h-4 w-4" />}
                {country || 'Land nicht erfasst'}
              </span>
              {website && <a href={website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-[#0E7C86] hover:underline"><ExternalLink className="h-4 w-4" />{new URL(website).hostname.replace(/^www\./, '')}</a>}
            </div>
          </div>
        </div>

        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <p><span className="font-bold text-[#1F2A44]">E-Mail:</span> {investor.email || '–'}</p>
          <p><span className="font-bold text-[#1F2A44]">Telefon:</span> {investor.phone || '–'}</p>
          <p><span className="font-bold text-[#1F2A44]">Position:</span> {investor.position_title || '–'}</p>
          <p><span className="font-bold text-[#1F2A44]">Firmensitz:</span> {[investor.location_city, country].filter(Boolean).join(', ') || '–'}</p>
          <p><span className="font-bold text-[#1F2A44]">Fokus:</span> {investor.focus || '–'}</p>
          <p><span className="font-bold text-[#1F2A44]">Status:</span> {investor.status || '–'}</p>
        </div>
        {investor.notes && <p className="mt-4 whitespace-pre-wrap border-t border-slate-100 pt-4 text-sm leading-6 text-slate-600">{investor.notes}</p>}
        <p className="mt-4 text-xs text-slate-500">Website, Land und Firmenlogo können über „Bearbeiten“ in der Investorenübersicht geändert werden.</p>
      </section>

      {searchProfile && <InvestorSearchProfileSummary profile={searchProfile} importedAt={investor.profile_imported_at} />}

      <ContactDocuments
        entityType="investor"
        entityId={investor.id}
        documentTypes={['Investoren-Suchprofil', 'NDA', 'Provisionsvereinbarung', 'Vermittlungsvereinbarung', 'Sonstiges']}
      />
    </div>
  )
}
