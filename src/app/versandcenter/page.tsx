import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, Mail, MessageCircle, Send, ShieldCheck } from 'lucide-react'
import { redirect } from 'next/navigation'
import { BulkMemorandumCenter } from '@/components/projects/BulkMemorandumCenter'
import { getProjects } from '@/lib/actions/project.actions'
import { formatProjectLocationLabel } from '@/lib/projects/location'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Versandcenter' }

function typeLabel(type?: string | null) {
  if (type === 'pv_freiflaeche') return 'PV-Freifläche'
  if (type === 'pv_dach') return 'PV-Dachanlage'
  if (type === 'bess') return 'BESS'
  if (type === 'hybrid') return 'Hybridprojekt'
  if (type === 'wind') return 'Windenergie'
  if (type === 'rechenzentrum') return 'Rechenzentrum'
  if (type === 'sonstiges') return 'Sonstiges Projekt'
  return 'Energieprojekt'
}

export default async function VersandcenterPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [projects, investorsResult, partnersResult] = await Promise.all([
    getProjects(),
    supabase
      .from('investors')
      .select('id, company_name, company, full_name, contact_person, email')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .not('email', 'is', null)
      .order('company_name'),
    supabase
      .from('partners')
      .select('id, company, full_name, email')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .not('email', 'is', null)
      .order('company'),
  ])

  const projectOptions = projects.map((project: any) => ({
    id: project.id,
    name: project.project_name || 'Projekt',
    number: project.project_number || 'Ohne Projektnummer',
    location: formatProjectLocationLabel(
      project.location_country,
      project.location_city,
      project.location_state
    ),
    typeLabel: typeLabel(project.project_type),
  }))

  const investorRecipients = (investorsResult.data ?? []).map((investor: any) => ({
    id: `investor:${investor.id}`,
    name:
      investor.company_name ||
      investor.company ||
      investor.contact_person ||
      investor.full_name ||
      investor.email,
    email: investor.email,
    type: 'investor' as const,
  }))

  const partnerRecipients = (partnersResult.data ?? []).map((partner: any) => ({
    id: `partner:${partner.id}`,
    name: partner.company || partner.full_name || partner.email,
    email: partner.email,
    type: 'partner' as const,
  }))

  const recipientOptions = [...investorRecipients, ...partnerRecipients]

  return (
    <main className="min-h-screen bg-[#F5F7F9] px-3 pb-28 pt-[calc(env(safe-area-inset-top)+0.75rem)] md:px-8 md:py-8">
      <div className="mx-auto max-w-[1100px] space-y-5 md:space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-[#07142F] shadow-sm transition active:scale-[0.98]"
            aria-label="Zurück zur Startseite"
          >
            <ArrowLeft className="h-5 w-5" />
            Zurück zur Startseite
          </Link>
          <Link href="/dashboard" aria-label="EMA Startseite" className="hidden sm:block">
            <img src="/brand/ema-logo.png" alt="EMA Enterprise" className="h-12 w-auto object-contain" />
          </Link>
        </div>

        <section className="relative overflow-hidden rounded-[2rem] bg-[#07142F] text-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
          <Image
            src="/hero-dashboard.png"
            alt="Erneuerbare-Energien-Projekte"
            fill
            quality={95}
            sizes="(max-width: 1100px) 100vw, 1100px"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#07142F]/98 via-[#07142F]/80 to-[#07142F]/35" />
          <div className="relative px-6 py-8 md:px-10 md:py-10">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-extrabold uppercase tracking-[.18em] text-[#87D33B] ring-1 ring-white/15">
              <Send className="h-4 w-4" />
              EMA Intelligence
            </span>
            <div className="mt-14 max-w-2xl md:mt-20">
              <p className="text-xs font-extrabold uppercase tracking-[.24em] text-[#87D33B]">
                Zentrale Dokumentenübergabe
              </p>
              <h1 className="mt-3 text-4xl font-extrabold tracking-[-.04em] md:text-6xl">
                Versandcenter
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-white/80 md:text-base">
                Mehrere Projekte auswählen, Exposés automatisch erstellen und gesammelt versenden.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#5CB800] text-white shadow-[0_10px_24px_rgba(92,184,0,0.25)]">
                <Send className="h-7 w-7" />
              </span>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#5CB800]">
                  Mehrfachversand
                </p>
                <h2 className="mt-1 text-2xl font-extrabold text-[#07142F]">
                  Exposés gesammelt versenden
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                  Wähle Projekte und Empfänger aus. EMA erstellt für jedes Projekt eine eigene PDF-Datei.
                </p>
              </div>
            </div>
            <div className="shrink-0">
              <BulkMemorandumCenter projects={projectOptions} recipients={recipientOptions} />
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <Mail className="h-6 w-6 text-[#5CB800]" />
            <h3 className="mt-4 font-extrabold text-[#07142F]">E-Mail</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Mehrere Exposés als einzelne PDF-Anhänge direkt versenden.
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <MessageCircle className="h-6 w-6 text-[#5CB800]" />
            <h3 className="mt-4 font-extrabold text-[#07142F]">WhatsApp</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Die erzeugten PDF-Dateien gesammelt über das Teilen-Menü weitergeben.
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <ShieldCheck className="h-6 w-6 text-[#5CB800]" />
            <h3 className="mt-4 font-extrabold text-[#07142F]">Dokumentiert</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Der Versand wird dem jeweiligen Projekt und Empfänger zugeordnet.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
