import Link from 'next/link'
import { ArrowLeft, Building2, FolderSearch2, Save } from 'lucide-react'
import { createAcquisitionLead } from '@/lib/actions/acquisition.actions'

const inputClass = 'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-[#5CB800] focus:ring-2 focus:ring-[#5CB800]/15'

export default function NewAcquisitionLeadPage({ searchParams }: { searchParams?: { error?: string } }) {
  return (
    <div className="min-h-screen bg-[#F4F6F9] px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/acquisition" className="inline-flex items-center gap-2 text-sm font-semibold text-[#132060]">
          <ArrowLeft className="h-4 w-4" /> Zurück zur Akquise
        </Link>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
          <div>
            <p className="text-sm font-semibold text-[#5CB800]">EMA Scout</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#132060]">Neuen Lead anlegen</h1>
            <p className="mt-2 text-sm text-slate-500">Projektchance oder große Dachfläche erfassen. Fehlende Angaben können später ergänzt werden.</p>
          </div>

          {searchParams?.error && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Der Lead konnte nicht gespeichert werden. Bitte Firmenname und Akquise-Typ prüfen.
            </div>
          )}

          <form action={createAcquisitionLead} className="mt-7 space-y-7">
            <section>
              <h2 className="font-semibold text-[#132060]">Lead-Typ</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-4 hover:border-[#5CB800]">
                  <input type="radio" name="acquisition_type" value="project" required className="accent-[#5CB800]" />
                  <FolderSearch2 className="h-5 w-5 text-[#132060]" />
                  <span><strong className="block text-sm text-slate-900">Projektchance</strong><span className="text-xs text-slate-500">PV, BESS oder Hybrid</span></span>
                </label>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-4 hover:border-[#5CB800]">
                  <input type="radio" name="acquisition_type" value="roof" required className="accent-[#5CB800]" />
                  <Building2 className="h-5 w-5 text-[#132060]" />
                  <span><strong className="block text-sm text-slate-900">Dachfläche</strong><span className="text-xs text-slate-500">Gewerbe oder Industrie</span></span>
                </label>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">Unternehmen *<input name="company_name" required className={inputClass} /></label>
              <label className="text-sm font-medium text-slate-700">Website<input name="website" type="url" className={inputClass} /></label>
              <label className="text-sm font-medium text-slate-700">Ansprechpartner<input name="contact_name" className={inputClass} /></label>
              <label className="text-sm font-medium text-slate-700">Position<input name="contact_role" className={inputClass} /></label>
              <label className="text-sm font-medium text-slate-700">E-Mail<input name="email" type="email" className={inputClass} /></label>
              <label className="text-sm font-medium text-slate-700">Telefon<input name="phone" type="tel" className={inputClass} /></label>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              <label className="text-sm font-medium text-slate-700 md:col-span-2">Straße<input name="street" className={inputClass} /></label>
              <label className="text-sm font-medium text-slate-700">PLZ<input name="postal_code" className={inputClass} /></label>
              <label className="text-sm font-medium text-slate-700">Ort<input name="city" className={inputClass} /></label>
              <label className="text-sm font-medium text-slate-700">Bundesland<input name="state" className={inputClass} /></label>
              <label className="text-sm font-medium text-slate-700">Quelle<input name="source_name" placeholder="z. B. Firmenwebsite" className={inputClass} /></label>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">Geschätztes Potenzial (kWp)<input name="estimated_potential_kwp" inputMode="decimal" className={inputClass} /></label>
              <label className="text-sm font-medium text-slate-700">Geschätzte Dachfläche (m²)<input name="estimated_roof_area_sqm" inputMode="decimal" className={inputClass} /></label>
              <label className="text-sm font-medium text-slate-700">Projektart<select name="project_type" className={inputClass}><option value="">Offen</option><option value="pv_freiflaeche">PV Freifläche</option><option value="pv_dach">PV Dach</option><option value="bess">BESS</option><option value="hybrid">Hybrid</option><option value="other">Sonstiges</option></select></label>
              <label className="text-sm font-medium text-slate-700">Vorläufiger Score (0–100)<input name="score" type="number" min="0" max="100" defaultValue="0" className={inputClass} /></label>
            </section>

            <label className="block text-sm font-medium text-slate-700">Notizen<textarea name="notes" rows={5} className={inputClass} /></label>

            <div className="flex justify-end border-t border-slate-100 pt-5">
              <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-[#132060] px-5 py-3 text-sm font-semibold text-white hover:bg-[#1F2A44]">
                <Save className="h-4 w-4" /> Lead speichern
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
