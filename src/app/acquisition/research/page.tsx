import Link from 'next/link'
import { ArrowLeft, Building2, FolderSearch2, Inbox, Search, ShieldCheck, Sparkles } from 'lucide-react'
import { queueResearchCandidate } from '@/lib/actions/research-inbox.actions'

export const dynamic = 'force-dynamic'

function Field({ label, name, type = 'text', placeholder }: { label: string; name: string; type?: string; placeholder?: string }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input name={name} type={type} placeholder={placeholder} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#5CB800] focus:ring-2 focus:ring-[#5CB800]/15" />
    </label>
  )
}

export default function ResearchPage({ searchParams }: { searchParams: { error?: string } }) {
  const errorMessage = searchParams.error === 'missing'
    ? 'Bitte mindestens Firma und Akquise-Art ausfüllen.'
    : searchParams.error
      ? 'Der Recherche-Vorschlag konnte nicht gespeichert werden.'
      : null

  return (
    <div className="min-h-screen bg-[#F4F6F9] px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/acquisition" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-[#132060]"><ArrowLeft className="h-4 w-4" /> Zurück zum Akquise-Center</Link>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#5CB800]"><Search className="h-4 w-4" /> EMA Scout Recherche</div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#132060]">Neue Chance recherchieren</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Öffentlich recherchierte Firmen, Dachflächen und Projektentwickler werden zuerst in einer kontrollierten Prüfliste gespeichert.</p>
          </div>
          <Link href="/acquisition/research/inbox" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-[#132060] shadow-sm"><Inbox className="h-4 w-4" /> Recherche-Postfach</Link>
        </div>

        {errorMessage && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{errorMessage}</div>}

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <form action={queueResearchCandidate} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
            <section className="space-y-4">
              <div><h2 className="font-semibold text-[#132060]">Unternehmen und Chance</h2><p className="mt-1 text-xs text-slate-400">Pflichtfelder sind Firma und Akquise-Art.</p></div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2"><span className="text-sm font-medium text-slate-700">Akquise-Art</span><select name="acquisition_type" required className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#5CB800]"><option value="roof">Große Dachfläche</option><option value="project">PV-, BESS- oder Hybridprojekt</option></select></label>
                <Field label="Firmenname" name="company_name" placeholder="z. B. Muster Logistik GmbH" />
                <Field label="Website" name="website" placeholder="www.beispiel.de" />
                <Field label="Öffentliche E-Mail" name="email" type="email" placeholder="info@beispiel.de" />
                <Field label="Ansprechpartner" name="contact_name" placeholder="Vor- und Nachname" />
                <Field label="Funktion" name="contact_role" placeholder="z. B. Geschäftsführer" />
              </div>
            </section>

            <section className="space-y-4 border-t border-slate-100 pt-6">
              <h2 className="font-semibold text-[#132060]">Standort und Potenzial</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Ort" name="city" />
                <Field label="Bundesland" name="state" />
                <Field label="Dachfläche in m²" name="estimated_roof_area_sqm" type="number" />
                <Field label="Geschätztes Potenzial in kWp" name="estimated_potential_kwp" type="number" />
                <Field label="Projektart" name="project_type" placeholder="PV, BESS oder Hybrid" />
                <Field label="Projektstand" name="project_stage" placeholder="z. B. baureif, Netzzusage" />
              </div>
            </section>

            <section className="space-y-4 border-t border-slate-100 pt-6">
              <h2 className="font-semibold text-[#132060]">Recherchequelle</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Quellenname" name="source_name" placeholder="z. B. Unternehmenswebsite" />
                <Field label="Quellen-URL" name="source_url" placeholder="https://…" />
              </div>
              <label className="block space-y-2"><span className="text-sm font-medium text-slate-700">Fundstelle und Notizen</span><textarea name="notes" rows={5} placeholder="Warum ist dieser Treffer interessant? Welche Informationen fehlen noch?" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#5CB800] focus:ring-2 focus:ring-[#5CB800]/15" /></label>
            </section>

            <button className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#132060] px-5 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-[#1F2A44]"><Sparkles className="h-4 w-4" /> Bewerten und ins Recherche-Postfach legen</button>
          </form>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><div className="rounded-xl bg-green-50 p-3 text-[#5CB800]"><ShieldCheck className="h-5 w-5" /></div><div><h3 className="font-semibold text-[#132060]">Dubletten-Schutz</h3><p className="mt-1 text-xs leading-5 text-slate-500">Prüft Firmenname, E-Mail und normalisierte Website vor der späteren Übernahme.</p></div></div></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><div className="rounded-xl bg-[#EEF2F7] p-3 text-[#132060]"><Building2 className="h-5 w-5" /></div><div><h3 className="font-semibold text-[#132060]">Dachflächen-Score</h3><p className="mt-1 text-xs leading-5 text-slate-500">Größe, PV-Potenzial, Standort und Kontaktdaten erhöhen die Priorität.</p></div></div></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><div className="rounded-xl bg-[#EEF2F7] p-3 text-[#132060]"><FolderSearch2 className="h-5 w-5" /></div><div><h3 className="font-semibold text-[#132060]">Projekt-Score</h3><p className="mt-1 text-xs leading-5 text-slate-500">Leistung, Projektstand und erreichbare Ansprechpartner bestimmen die Reihenfolge.</p></div></div></div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"><p className="font-semibold">Kontrollierter Prozess</p><p className="mt-2 text-xs leading-5">Ein Treffer landet nur im Recherche-Postfach. Erst deine Bestätigung erzeugt einen Lead. E-Mails bleiben weiterhin freigabepflichtig.</p></div>
          </aside>
        </div>
      </div>
    </div>
  )
}
