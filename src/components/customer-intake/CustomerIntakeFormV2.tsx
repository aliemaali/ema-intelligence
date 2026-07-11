'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Camera, FileDown, MapPin, Plus, Save, Trash2 } from 'lucide-react'
import { createCustomerIntakeProject } from '@/lib/actions/customer-intake.actions'

const STATES = ['Baden-Württemberg','Bayern','Berlin','Brandenburg','Bremen','Hamburg','Hessen','Mecklenburg-Vorpommern','Niedersachsen','Nordrhein-Westfalen','Rheinland-Pfalz','Saarland','Sachsen','Sachsen-Anhalt','Schleswig-Holstein','Thüringen']
const NETWORKS = ['Westnetz','Netze BW','Bayernwerk','E.DIS','Avacon','Mitnetz Strom','LEW Verteilnetz','Schleswig-Holstein Netz','EAM Netz','Syna','EWR Netz','N-ERGIE Netz','Mainzer Netze','Stadtwerke München Netz','Stromnetz Berlin','Hamburger Energienetze','RheinNetz','SWK Netz','NEW Netz','Pfalzwerke Netz','Sonstiger']
const field = 'mt-1 w-full rounded-xl border border-slate-200 bg-[#FBFCFE] px-4 py-3 text-base font-semibold text-[#07142F] outline-none focus:border-[#5CB800] focus:ring-4 focus:ring-[#5CB800]/10'
const card = 'overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white shadow-sm'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className={card}><div className="flex items-center gap-3 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-5 py-4"><span className="h-6 w-1 rounded-full bg-[#5CB800]" /><h2 className="text-sm font-extrabold uppercase tracking-wide text-[#07142F]">{title}</h2></div><div className="p-5">{children}</div></section>
}

export function CustomerIntakeFormV2() {
  const [details, setDetails] = useState<Record<string,string>>({})
  const [gps, setGps] = useState('')
  const [gpsStatus, setGpsStatus] = useState('')
  const [wishes, setWishes] = useState<string[]>([])
  const [extraNotes, setExtraNotes] = useState('')
  const [satellite, setSatellite] = useState<string>()
  const [photos, setPhotos] = useState<{id:number;title:string;desc:string;url?:string}[]>([{id:1,title:'',desc:''},{id:2,title:'',desc:''}])

  const set = (key:string, value:string) => setDetails(prev => ({...prev,[key]:value}))
  const notes = useMemo(() => [
    details.company && `Name / Firma: ${details.company}`,
    details.contactPerson && `Ansprechpartner: ${details.contactPerson}`,
    details.street && `Straße: ${details.street}`,
    details.postcode && `PLZ: ${details.postcode}`,
    details.customerType && `Kundentyp: ${details.customerType}`,
    details.buildingType && `Gebäudeart: ${details.buildingType}`,
    details.network && `Netzbetreiber: ${details.network}`,
    details.consumption && `Jahresverbrauch: ${details.consumption} kWh`,
    details.roofType && `Dachart: ${details.roofType}`,
    details.covering && `Dacheindeckung: ${details.covering}`,
    details.orientation && `Ausrichtung: ${details.orientation}`,
    details.shading && `Verschattung: ${details.shading}`,
    details.roofSize && `Dachmaße: ${details.roofSize}`,
    details.storage && `Speicher: ${details.storage}`,
    details.heatPump && `Wärmepumpe: ${details.heatPump}`,
    details.meterCabinet && `Zählerschrank: ${details.meterCabinet}`,
    details.meter && `Stromzähler: ${details.meter}`,
    wishes.length ? `Kundenwünsche: ${wishes.join(', ')}` : '',
    gps && `GPS: ${gps}`,
    extraNotes && `Notizen: ${extraNotes}`,
    photos.some(p=>p.url) && `Fotos aufgenommen: ${photos.filter(p=>p.url).map(p=>p.title || 'Ohne Titel').join(', ')}`,
  ].filter(Boolean).join('\n'), [details,wishes,gps,extraNotes,photos])

  const locate = () => {
    if (!navigator.geolocation) return setGpsStatus('GPS wird auf diesem Gerät nicht unterstützt.')
    setGpsStatus('Standort wird ermittelt …')
    navigator.geolocation.getCurrentPosition(
      pos => { setGps(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`); setGpsStatus('Standort übernommen.') },
      () => setGpsStatus('Standort konnte nicht ermittelt werden.'),
      { enableHighAccuracy:true, timeout:15000, maximumAge:30000 },
    )
  }

  return <div className="page-container space-y-5 pb-28">
    <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-extrabold text-[#07142F]"><ArrowLeft className="h-4 w-4" /> Zurück zum Dashboard</Link>
    <section className="rounded-[2rem] bg-gradient-to-br from-[#07142F] via-[#10245A] to-[#16472f] px-5 py-7 text-white shadow-lg">
      <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#87d33b]">EMA Intelligence</p>
      <h1 className="mt-1 text-3xl font-extrabold">Kundenaufnahme PV</h1>
      <p className="mt-2 text-sm text-slate-300">Vollständig erfassen und direkt als Projekt speichern.</p>
    </section>

    <form action={createCustomerIntakeProject} className="space-y-5">
      <input type="hidden" name="location_country" value="Deutschland" />
      <input type="hidden" name="priority" value="mittel" />
      <input type="hidden" name="marketing_status" value="nicht_gestartet" />
      <input type="hidden" name="notes" value={notes} />

      <Section title="1 · Kundendaten"><div className="grid gap-4 md:grid-cols-2">
        <label className="md:col-span-2"><span className="text-xs font-bold text-slate-500">Projektname *</span><input name="project_name" required className={field} placeholder="z. B. PV-Anlage Mustermann" /></label>
        <label className="md:col-span-2"><span className="text-xs font-bold text-slate-500">Name / Firma</span><input value={details.company || ''} onChange={e=>set('company',e.target.value)} className={field} /></label>
        <label><span className="text-xs font-bold text-slate-500">Ansprechpartner</span><input name="contact_name" value={details.contactPerson || ''} onChange={e=>set('contactPerson',e.target.value)} className={field} /></label>
        <label><span className="text-xs font-bold text-slate-500">Telefon</span><input name="contact_phone" type="tel" className={field} /></label>
        <label className="md:col-span-2"><span className="text-xs font-bold text-slate-500">E-Mail</span><input name="contact_email" type="email" className={field} /></label>
        <label className="md:col-span-2"><span className="text-xs font-bold text-slate-500">Straße & Hausnummer</span><input value={details.street || ''} onChange={e=>set('street',e.target.value)} className={field} /></label>
        <label><span className="text-xs font-bold text-slate-500">PLZ</span><input value={details.postcode || ''} onChange={e=>set('postcode',e.target.value)} className={field} inputMode="numeric" /></label>
        <label><span className="text-xs font-bold text-slate-500">Ort *</span><input name="location_city" required className={field} /></label>
        <label><span className="text-xs font-bold text-slate-500">Bundesland *</span><select name="location_state" required defaultValue="" className={field}><option value="" disabled>Auswählen</option>{STATES.map(x=><option key={x}>{x}</option>)}</select></label>
        <label><span className="text-xs font-bold text-slate-500">Datum</span><input type="date" defaultValue={new Date().toISOString().slice(0,10)} className={field} /></label>
        <label><span className="text-xs font-bold text-slate-500">Bearbeiter</span><input defaultValue="Ali Ünlüer" className={field} /></label>
      </div></Section>

      <Section title="2 · Objekt"><div className="grid gap-4 md:grid-cols-2">
        <label><span className="text-xs font-bold text-slate-500">Kundentyp</span><select className={field} value={details.customerType || ''} onChange={e=>set('customerType',e.target.value)}><option value=""></option>{['Privat','Gewerbe','Landwirtschaft','Kommune'].map(x=><option key={x}>{x}</option>)}</select></label>
        <label><span className="text-xs font-bold text-slate-500">Gebäudeart</span><select className={field} value={details.buildingType || ''} onChange={e=>set('buildingType',e.target.value)}><option value=""></option>{['Einfamilienhaus','Mehrfamilienhaus','Halle','Büro','Landwirtschaft','Industrie','Sonstiges'].map(x=><option key={x}>{x}</option>)}</select></label>
        <label><span className="text-xs font-bold text-slate-500">Netzbetreiber</span><select className={field} value={details.network || ''} onChange={e=>set('network',e.target.value)}><option value=""></option>{NETWORKS.map(x=><option key={x}>{x}</option>)}</select></label>
        <label><span className="text-xs font-bold text-slate-500">Jahresverbrauch (kWh)</span><input className={field} inputMode="numeric" value={details.consumption || ''} onChange={e=>set('consumption',e.target.value)} /></label>
      </div></Section>

      <Section title="3 · Dach"><div className="grid gap-4 md:grid-cols-2">
        <label><span className="text-xs font-bold text-slate-500">Dachart</span><select className={field} value={details.roofType || ''} onChange={e=>set('roofType',e.target.value)}><option value=""></option>{['Satteldach','Flachdach','Pultdach','Sonstiges'].map(x=><option key={x}>{x}</option>)}</select></label>
        <label><span className="text-xs font-bold text-slate-500">Dacheindeckung</span><select className={field} value={details.covering || ''} onChange={e=>set('covering',e.target.value)}><option value=""></option>{['Ziegel','Blech','Bitumen','Folie','Sandwich','Sonstiges'].map(x=><option key={x}>{x}</option>)}</select></label>
        <label><span className="text-xs font-bold text-slate-500">Ausrichtung</span><select className={field} value={details.orientation || ''} onChange={e=>set('orientation',e.target.value)}><option value=""></option>{['Süd','Süd-Ost','Süd-West','Ost','West','Ost-West','Nord'].map(x=><option key={x}>{x}</option>)}</select></label>
        <label><span className="text-xs font-bold text-slate-500">Verschattung</span><select className={field} value={details.shading || ''} onChange={e=>set('shading',e.target.value)}><option value=""></option>{['Keine','Gering','Mittel','Stark'].map(x=><option key={x}>{x}</option>)}</select></label>
        <label className="md:col-span-2"><span className="text-xs font-bold text-slate-500">Dachmaße (Länge × Breite in m)</span><input className={field} value={details.roofSize || ''} onChange={e=>set('roofSize',e.target.value)} placeholder="z. B. 14 × 9" /></label>
      </div></Section>

      <Section title="4 · Technik"><div className="grid gap-4 md:grid-cols-2">
        <label><span className="text-xs font-bold text-slate-500">Speicher</span><select className={field} value={details.storage || ''} onChange={e=>set('storage',e.target.value)}><option value=""></option><option>Ja</option><option>Nein</option></select></label>
        <label><span className="text-xs font-bold text-slate-500">Wärmepumpe</span><select className={field} value={details.heatPump || ''} onChange={e=>set('heatPump',e.target.value)}><option value=""></option><option>Vorhanden</option><option>Geplant</option><option>Nein</option></select></label>
        <label><span className="text-xs font-bold text-slate-500">Zählerschrank</span><select className={field} value={details.meterCabinet || ''} onChange={e=>set('meterCabinet',e.target.value)}><option value=""></option><option>Modern</option><option>Alt</option><option>Umbau erforderlich</option></select></label>
        <label><span className="text-xs font-bold text-slate-500">Stromzähler</span><select className={field} value={details.meter || ''} onChange={e=>set('meter',e.target.value)}><option value=""></option><option>Ferraris</option><option>Digital</option><option>Smart Meter</option></select></label>
      </div></Section>

      <Section title="5 · Kundenwünsche"><div className="grid gap-3 md:grid-cols-2">{['Maximale Wirtschaftlichkeit','Höchster Eigenverbrauch','Speicher gewünscht','Wärmepumpe geplant','Sonstige Wünsche'].map(w=><label key={w} className={`flex items-center gap-3 rounded-xl border p-3 font-semibold ${wishes.includes(w)?'border-[#5CB800] bg-[#F3FAEA]':'border-slate-200 bg-[#FBFCFE]'}`}><input type="checkbox" className="h-5 w-5 accent-[#5CB800]" checked={wishes.includes(w)} onChange={e=>setWishes(prev=>e.target.checked?[...prev,w]:prev.filter(x=>x!==w))} />{w}</label>)}</div><label className="mt-4 block"><span className="text-xs font-bold text-slate-500">Sonstige Wünsche / Notizen</span><textarea className={field} rows={4} value={extraNotes} onChange={e=>setExtraNotes(e.target.value)} /></label></Section>

      <Section title="6 · Standort & Satellitenbild"><div className="space-y-4">
        <label><span className="text-xs font-bold text-slate-500">GPS-Koordinaten</span><input className={field} value={gps} onChange={e=>setGps(e.target.value)} placeholder="Breite, Länge" /></label>
        <button type="button" onClick={locate} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#07142F] px-4 py-3 font-bold text-white"><MapPin className="h-4 w-4" /> Standort übernehmen</button>
        {gpsStatus && <p className="text-xs font-semibold text-slate-500">{gpsStatus}</p>}
        {gps && <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/@${gps},120m/data=!3m1!1e3`} className="block text-center text-sm font-bold text-[#5CB800]">Satellitenansicht in Google Maps öffnen</a>}
        <label className="flex h-44 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 text-center text-sm font-semibold text-slate-500">{satellite?<img src={satellite} alt="Satellitenbild" className="h-full w-full object-cover" />:<span>Satellitenbild / Screenshot auswählen</span>}<input type="file" accept="image/*" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)setSatellite(URL.createObjectURL(f))}} /></label>
      </div></Section>

      <Section title="7 · Fotos"><div className="space-y-4">{photos.map(p=><div key={p.id} className="rounded-2xl border border-slate-200 bg-[#FBFCFE] p-4"><div className="grid gap-3 md:grid-cols-[120px_1fr]"><label className="flex h-28 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-200 bg-white text-center text-xs font-bold text-slate-500">{p.url?<img src={p.url} alt="Foto" className="h-full w-full object-cover" />:<><Camera className="mr-2 h-4 w-4" /> Foto wählen</>}<input type="file" accept="image/*" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)setPhotos(prev=>prev.map(x=>x.id===p.id?{...x,url:URL.createObjectURL(f)}:x))}} /></label><div className="space-y-3"><input className={field} placeholder="Foto-Titel, z. B. Zählerschrank" value={p.title} onChange={e=>setPhotos(prev=>prev.map(x=>x.id===p.id?{...x,title:e.target.value}:x))} /><input className={field} placeholder="Beschreibung (optional)" value={p.desc} onChange={e=>setPhotos(prev=>prev.map(x=>x.id===p.id?{...x,desc:e.target.value}:x))} /></div></div><button type="button" onClick={()=>setPhotos(prev=>prev.filter(x=>x.id!==p.id))} className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-red-600"><Trash2 className="h-4 w-4" /> Entfernen</button></div>)}<button type="button" onClick={()=>setPhotos(prev=>[...prev,{id:Date.now(),title:'',desc:''}])} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#5CB800] px-4 py-3 font-bold text-white"><Plus className="h-4 w-4" /> Foto-Bereich hinzufügen</button></div></Section>

      <Section title="8 · Projektdaten"><div className="grid gap-4 md:grid-cols-2">
        <label><span className="text-xs font-bold text-slate-500">Projekttyp *</span><select name="project_type" required defaultValue="pv" className={field}><option value="pv">PV</option><option value="bess">BESS</option><option value="hybrid">Hybrid</option></select></label>
        <label><span className="text-xs font-bold text-slate-500">Projektstatus</span><select name="status" defaultValue="lead" className={field}><option value="lead">Lead</option><option value="pruefung">In Prüfung</option><option value="entwicklung">In Entwicklung</option><option value="rtb">RTB</option></select></label>
        <label><span className="text-xs font-bold text-slate-500">PV-Leistung (kWp)</span><input name="pv_mwp" inputMode="decimal" className={field} /></label>
        <label><span className="text-xs font-bold text-slate-500">BESS-Kapazität (MWh)</span><input name="bess_mwh" inputMode="decimal" className={field} /></label>
      </div></Section>

      <div className="grid gap-3 md:grid-cols-2"><button type="button" onClick={()=>window.print()} className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-4 font-extrabold text-[#07142F]"><FileDown className="h-5 w-5" /> PDF / Drucken</button><button type="submit" className="flex items-center justify-center gap-2 rounded-2xl bg-[#5CB800] px-5 py-4 font-extrabold text-white shadow-lg shadow-[#5CB800]/20"><Save className="h-5 w-5" /> In EMA speichern</button></div>
    </form>
  </div>
}
