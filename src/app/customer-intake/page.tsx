import Link from 'next/link'
import { ArrowLeft, Building2, MapPin, Save } from 'lucide-react'
import { createProject } from '@/lib/actions/project.actions'

const STATES = [
  'Baden-Württemberg', 'Bayern', 'Berlin', 'Brandenburg', 'Bremen', 'Hamburg',
  'Hessen', 'Mecklenburg-Vorpommern', 'Niedersachsen', 'Nordrhein-Westfalen',
  'Rheinland-Pfalz', 'Saarland', 'Sachsen', 'Sachsen-Anhalt',
  'Schleswig-Holstein', 'Thüringen',
]

export const metadata = {
  title: 'Kundenaufnahme',
  description: 'Kundenaufnahme direkt in EMA Intelligence speichern',
}

export default function CustomerIntakePage() {
  return (
    <div className="page-container space-y-5">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm font-extrabold text-[#07142F]"
      >
        <ArrowLeft className="h-4 w-4" /> Zurück zum Dashboard
      </Link>

      <section className="rounded-[2rem] bg-gradient-to-br from-[#07142F] via-[#10245A] to-[#16472f] px-5 py-7 text-white shadow-lg md:px-8 md:py-9">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#87d33b]">EMA Intelligence</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Kundenaufnahme</h1>
            <p className="mt-2 text-sm text-slate-300">Erfassen und direkt als neues Projekt speichern.</p>
          </div>
          <Building2 className="h-11 w-11 text-[#87d33b]" />
        </div>
      </section>

      <form action={createProject} className="space-y-5">
        <input type="hidden" name="location_country" value="Deutschland" />
        <input type="hidden" name="priority" value="mittel" />
        <input type="hidden" name="marketing_status" value="nicht_gestartet" />

        <section className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-extrabold text-[#07142F]">Projekt & Kunde</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="text-xs font-bold text-slate-500">Projektname *</span>
              <input name="project_name" required className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 font-semibold text-[#07142F] outline-none focus:border-[#5CB800]" placeholder="z. B. PV-Anlage Musterstraße" />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-500">Kundenname</span>
              <input name="contact_name" className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 font-semibold text-[#07142F] outline-none focus:border-[#5CB800]" />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-500">Telefon</span>
              <input name="contact_phone" type="tel" className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 font-semibold text-[#07142F] outline-none focus:border-[#5CB800]" />
            </label>
            <label className="block md:col-span-2">
              <span className="text-xs font-bold text-slate-500">E-Mail</span>
              <input name="contact_email" type="email" className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 font-semibold text-[#07142F] outline-none focus:border-[#5CB800]" />
            </label>
          </div>
        </section>

        <section className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-[#5CB800]" />
            <h2 className="text-xl font-extrabold text-[#07142F]">Standort</h2>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-xs font-bold text-slate-500">Ort *</span>
              <input name="location_city" required className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 font-semibold text-[#07142F] outline-none focus:border-[#5CB800]" />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-500">Bundesland *</span>
              <select name="location_state" required defaultValue="" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-semibold text-[#07142F] outline-none focus:border-[#5CB800]">
                <option value="" disabled>Bundesland auswählen</option>
                {STATES.map((state) => <option key={state} value={state}>{state}</option>)}
              </select>
            </label>
          </div>
        </section>

        <section className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-extrabold text-[#07142F]">Anlagendaten</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-xs font-bold text-slate-500">Projekttyp *</span>
              <select name="project_type" required defaultValue="pv" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-semibold text-[#07142F] outline-none focus:border-[#5CB800]">
                <option value="pv">PV</option>
                <option value="bess">BESS</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-500">Projektstatus</span>
              <select name="status" defaultValue="lead" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-semibold text-[#07142F] outline-none focus:border-[#5CB800]">
                <option value="lead">Lead</option>
                <option value="pruefung">In Prüfung</option>
                <option value="entwicklung">In Entwicklung</option>
                <option value="rtb">RTB</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-500">PV-Leistung (kWp)</span>
              <input name="pv_mwp" inputMode="decimal" className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 font-semibold text-[#07142F] outline-none focus:border-[#5CB800]" placeholder="z. B. 250" />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-500">BESS-Kapazität (MWh)</span>
              <input name="bess_mwh" inputMode="decimal" className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 font-semibold text-[#07142F] outline-none focus:border-[#5CB800]" />
            </label>
            <label className="block md:col-span-2">
              <span className="text-xs font-bold text-slate-500">Notizen</span>
              <textarea name="notes" rows={5} className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 font-semibold text-[#07142F] outline-none focus:border-[#5CB800]" placeholder="Dachart, Netzbetreiber, Besonderheiten, nächste Schritte …" />
            </label>
          </div>
        </section>

        <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#5CB800] px-5 py-4 text-base font-extrabold text-white shadow-lg shadow-[#5CB800]/20 active:scale-[0.99]">
          <Save className="h-5 w-5" /> Projekt in EMA Intelligence speichern
        </button>
      </form>
    </div>
  )
}
