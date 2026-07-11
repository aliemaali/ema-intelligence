import Link from 'next/link'
import { ArrowLeft, Building2, Save } from 'lucide-react'
import { createProject } from '@/lib/actions/project.actions'

const STATES = ['Baden-Württemberg','Bayern','Berlin','Brandenburg','Bremen','Hamburg','Hessen','Mecklenburg-Vorpommern','Niedersachsen','Nordrhein-Westfalen','Rheinland-Pfalz','Saarland','Sachsen','Sachsen-Anhalt','Schleswig-Holstein','Thüringen']
const NETWORKS = ['Westnetz','Netze BW','Bayernwerk','E.DIS','Avacon','Mitnetz Strom','LEW Verteilnetz','Schleswig-Holstein Netz','EAM Netz','Syna','EWR Netz','N-ERGIE Netz','Mainzer Netze','Stadtwerke München Netz','Stromnetz Berlin','Hamburger Energienetze','RheinNetz','SWK Netz','NEW Netz','Pfalzwerke Netz','Sonstiger']
const field = 'mt-1 w-full rounded-xl border border-slate-200 bg-[#FBFCFE] px-4 py-3 text-base font-semibold text-[#07142F] outline-none focus:border-[#5CB800] focus:ring-4 focus:ring-[#5CB800]/10'
const card = 'rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm'

export const metadata = { title: 'Kundenaufnahme', description: 'Kundenaufnahme direkt in EMA Intelligence speichern' }

async function submitCustomerIntake(formData: FormData): Promise<void> {
  'use server'
  await createProject(formData)
}

export default function CustomerIntakePage() {
  return <div className="page-container space-y-5 pb-28">
    <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-extrabold text-[#07142F]"><ArrowLeft className="h-4 w-4" /> Zurück zum Dashboard</Link>

    <section className="rounded-[2rem] bg-gradient-to-br from-[#07142F] via-[#10245A] to-[#16472f] px-5 py-7 text-white shadow-lg">
      <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#87d33b]">EMA Intelligence</p><h1 className="mt-1 text-3xl font-extrabold">Kundenaufnahme PV</h1><p className="mt-2 text-sm text-slate-300">Direkt in EMA Intelligence erfassen und speichern.</p></div><Building2 className="h-11 w-11 text-[#87d33b]" /></div>
    </section>

    <form action={submitCustomerIntake} className="space-y-5">
      <input type="hidden" name="location_country" value="Deutschland" /><input type="hidden" name="priority" value="mittel" /><input type="hidden" name="marketing_status" value="nicht_gestartet" />

      <section className={card}><h2 className="text-xl font-extrabold text-[#07142F]">1 · Kundendaten</h2><div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="md:col-span-2"><span className="text-xs font-bold text-slate-500">Projektname *</span><input name="project_name" required className={field} placeholder="z. B. PV-Anlage Mustermann" /></label>
        <label className="md:col-span-2"><span className="text-xs font-bold text-slate-500">Name / Firma</span><input name="company_name" className={field} /></label>
        <label><span className="text-xs font-bold text-slate-500">Ansprechpartner</span><input name="contact_name" className={field} /></label>
        <label><span className="text-xs font-bold text-slate-500">Telefon</span><input name="contact_phone" type="tel" className={field} /></label>
        <label className="md:col-span-2"><span className="text-xs font-bold text-slate-500">E-Mail</span><input name="contact_email" type="email" className={field} /></label>
        <label className="md:col-span-2"><span className="text-xs font-bold text-slate-500">Straße & Hausnummer</span><input name="street" className={field} /></label>
        <label><span className="text-xs font-bold text-slate-500">PLZ</span><input name="postal_code" inputMode="numeric" className={field} /></label>
        <label><span className="text-xs font-bold text-slate-500">Ort *</span><input name="location_city" required className={field} /></label>
        <label><span className="text-xs font-bold text-slate-500">Bundesland *</span><select name="location_state" required defaultValue="" className={field}><option value="" disabled>Auswählen</option>{STATES.map(state=><option key={state} value={state}>{state}</option>)}</select></label>
        <label><span className="text-xs font-bold text-slate-500">Datum</span><input type="date" name="intake_date" className={field} /></label>
      </div></section>

      <section className={card}><h2 className="text-xl font-extrabold text-[#07142F]">2 · Objekt & Dach</h2><div className="mt-4 grid gap-4 md:grid-cols-2">
        <label><span className="text-xs font-bold text-slate-500">Kundentyp</span><select name="customer_type" defaultValue="" className={field}><option value=""></option><option>Privat</option><option>Gewerbe</option><option>Landwirtschaft</option><option>Kommune</option></select></label>
        <label><span className="text-xs font-bold text-slate-500">Gebäudeart</span><select name="building_type" defaultValue="" className={field}><option value=""></option><option>Einfamilienhaus</option><option>Mehrfamilienhaus</option><option>Halle</option><option>Büro</option><option>Landwirtschaft</option><option>Industrie</option><option>Sonstiges</option></select></label>
        <label><span className="text-xs font-bold text-slate-500">Netzbetreiber</span><select name="network_operator" defaultValue="" className={field}><option value=""></option>{NETWORKS.map(network=><option key={network}>{network}</option>)}</select></label>
        <label><span className="text-xs font-bold text-slate-500">Jahresverbrauch (kWh)</span><input name="annual_consumption" inputMode="numeric" className={field} /></label>
        <label><span className="text-xs font-bold text-slate-500">Dachart</span><select name="roof_type" defaultValue="" className={field}><option value=""></option><option>Satteldach</option><option>Flachdach</option><option>Pultdach</option><option>Sonstiges</option></select></label>
        <label><span className="text-xs font-bold text-slate-500">Dacheindeckung</span><select name="roof_covering" defaultValue="" className={field}><option value=""></option><option>Ziegel</option><option>Blech</option><option>Bitumen</option><option>Folie</option><option>Sandwich</option><option>Sonstiges</option></select></label>
        <label><span className="text-xs font-bold text-slate-500">Ausrichtung</span><select name="orientation" defaultValue="" className={field}><option value=""></option><option>Süd</option><option>Süd-Ost</option><option>Süd-West</option><option>Ost</option><option>West</option><option>Ost-West</option><option>Nord</option></select></label>
        <label><span className="text-xs font-bold text-slate-500">Verschattung</span><select name="shading" defaultValue="" className={field}><option value=""></option><option>Keine</option><option>Gering</option><option>Mittel</option><option>Stark</option></select></label>
        <label className="md:col-span-2"><span className="text-xs font-bold text-slate-500">Dachmaße</span><input name="roof_dimensions" className={field} placeholder="z. B. 14 × 9 m" /></label>
      </div></section>

      <section className={card}><h2 className="text-xl font-extrabold text-[#07142F]">3 · Technik & Projektdaten</h2><div className="mt-4 grid gap-4 md:grid-cols-2">
        <label><span className="text-xs font-bold text-slate-500">Projekttyp *</span><select name="project_type" required defaultValue="pv" className={field}><option value="pv">PV</option><option value="bess">BESS</option><option value="hybrid">Hybrid</option></select></label>
        <label><span className="text-xs font-bold text-slate-500">Projektstatus</span><select name="status" defaultValue="lead" className={field}><option value="lead">Lead</option><option value="pruefung">In Prüfung</option><option value="entwicklung">In Entwicklung</option><option value="rtb">RTB</option></select></label>
        <label><span className="text-xs font-bold text-slate-500">PV-Leistung (kWp)</span><input name="pv_mwp" inputMode="decimal" className={field} /></label>
        <label><span className="text-xs font-bold text-slate-500">BESS-Kapazität (MWh)</span><input name="bess_mwh" inputMode="decimal" className={field} /></label>
        <label><span className="text-xs font-bold text-slate-500">Speicher</span><select name="storage" defaultValue="" className={field}><option value=""></option><option>Ja</option><option>Nein</option></select></label>
        <label><span className="text-xs font-bold text-slate-500">Wärmepumpe</span><select name="heat_pump" defaultValue="" className={field}><option value=""></option><option>Vorhanden</option><option>Geplant</option><option>Nein</option></select></label>
        <label className="md:col-span-2"><span className="text-xs font-bold text-slate-500">Notizen</span><textarea name="notes" rows={6} className={field} placeholder="Kundenwünsche, Technik, GPS, Fotos und Besonderheiten …" /></label>
      </div></section>

      <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#5CB800] px-5 py-4 text-base font-extrabold text-white shadow-lg shadow-[#5CB800]/20 active:scale-[0.99]"><Save className="h-5 w-5" /> In EMA Intelligence speichern</button>
    </form>
  </div>
}