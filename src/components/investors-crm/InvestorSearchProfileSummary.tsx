import { CheckCircle2, Circle, MapPin, ShieldCheck } from 'lucide-react'
import type { InvestorSearchProfile } from '@/types/investors'

function BadgeList({ values, empty = 'Keine Angabe' }: { values: string[]; empty?: string }) {
  if (!values.length) return <span className="text-sm text-slate-400">{empty}</span>
  return <div className="flex flex-wrap gap-2">{values.map((value) => <span key={value} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{value}</span>)}</div>
}

function Flag({ active, label }: { active: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${active ? 'bg-[#5CB800]/10 text-[#367D00]' : 'bg-slate-100 text-slate-400'}`}>
      {active ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}{label}
    </span>
  )
}

export function InvestorSearchProfileSummary({ profile, importedAt }: { profile: InvestorSearchProfile; importedAt?: string | null }) {
  const technologies = [
    profile.technologies.pv_ground ? 'PV Freifläche' : '',
    profile.technologies.pv_rooftop ? 'PV Dach' : '',
    profile.technologies.bess ? 'BESS' : '',
    profile.technologies.wind ? 'Wind' : '',
  ].filter(Boolean)
  const regions = [
    profile.regions.germany ? 'Deutschland' : '',
    profile.regions.dach ? 'DACH' : '',
    profile.regions.eu ? 'EU' : '',
    profile.regions.international ? 'International' : '',
  ].filter(Boolean)

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-[#5CB800]">Importiertes Suchprofil</p>
          <h2 className="mt-1 text-xl font-extrabold text-[#07142F]">Investitionskriterien</h2>
          {importedAt && <p className="mt-1 text-xs text-slate-500">Importiert am {new Date(importedAt).toLocaleDateString('de-DE')}</p>}
        </div>
        <ShieldCheck className="h-6 w-6 text-[#5CB800]" />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Technologien</p>
          <div className="mt-3"><BadgeList values={technologies} /></div>
          {profile.technologies.other && <p className="mt-3 text-sm text-slate-600">{profile.technologies.other}</p>}
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Projektgrößen</p>
          <div className="mt-3 space-y-1 text-sm text-slate-700">
            <p>PV: {profile.project_sizes.pv_from_mwp || '–'} bis {profile.project_sizes.pv_to_mwp || '–'}</p>
            <p>BESS: {profile.project_sizes.bess_from_mwh || '–'} bis {profile.project_sizes.bess_to_mwh || '–'}</p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Projektstatus</p>
          <div className="mt-3"><BadgeList values={profile.project_stages} /></div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Investitionsmodell</p>
          <div className="mt-3"><BadgeList values={profile.investment_models} /></div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 sm:col-span-2">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500"><MapPin className="h-4 w-4" /> Regionen</p>
          <div className="mt-3"><BadgeList values={regions} /></div>
          {profile.regions.details && <p className="mt-3 text-sm text-slate-600">{profile.regions.details}</p>}
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Investitionsvolumen</p>
          <div className="mt-3"><BadgeList values={profile.investment_volume_bands} /></div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Besondere Anforderungen</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Flag active={profile.criteria.esg_compliant} label="ESG" />
            <Flag active={profile.criteria.grid_connection_secured} label="Netzanschluss" />
            <Flag active={profile.criteria.long_term_ppa_required} label="Langfristige PPA" />
            <Flag active={profile.criteria.exclusivity_required} label="Exklusivität" />
          </div>
          {profile.criteria.minimum_irr && <p className="mt-3 text-sm font-semibold text-slate-700">Mindest-IRR: {profile.criteria.minimum_irr}</p>}
        </div>
      </div>

      {profile.comments && <div className="mt-4 rounded-xl border border-slate-100 p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Bemerkungen</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{profile.comments}</p></div>}

      <div className="mt-4 flex flex-wrap gap-2">
        <Flag active={profile.consents.gdpr} label="DSGVO-Einwilligung" />
        <Flag active={profile.consents.confidentiality} label="Vertraulichkeit" />
        {profile.consents.place_date && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">Datum: {profile.consents.place_date}</span>}
      </div>
    </section>
  )
}
