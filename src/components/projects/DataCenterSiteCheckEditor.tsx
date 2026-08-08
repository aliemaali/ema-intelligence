import { CheckCircle2, CircleAlert, MapPin, Network, Server, Zap } from 'lucide-react'
import { saveDataCenterSiteCheck } from '@/lib/actions/data-center-site-check.actions'
import type { DataCenterSiteCheck } from '@/lib/projects/master-data'
import { formatPowerFromMw } from '@/lib/format/power'

interface DataCenterSiteCheckEditorProps {
  projectId: string
  project: {
    location_state?: string | null
    location_city?: string | null
    contact_name?: string | null
    contact_phone?: string | null
    contact_email?: string | null
    data_center_grid_mw?: number | null
    data_center_grid_confirmed?: boolean | null
    land_area_sqm?: number | null
    data_center_site_check?: DataCenterSiteCheck | null
  }
}

const fieldClass = 'min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#5CB800] focus:ring-2 focus:ring-[#5CB800]/15'
const sectionClass = 'rounded-2xl border border-slate-200 bg-white p-4 md:p-5'

function Field({ label, name, defaultValue, type = 'text', inputMode }: { label: string; name: string; defaultValue?: string | number | null; type?: string; inputMode?: 'decimal' | 'numeric' }) {
  return <label className="space-y-1 text-xs font-semibold text-slate-600">{label}<input className={fieldClass} type={type} inputMode={inputMode} name={name} defaultValue={defaultValue ?? ''} /></label>
}

function SelectField({ label, name, defaultValue, options }: { label: string; name: string; defaultValue?: string; options: Array<[string, string]> }) {
  return <label className="space-y-1 text-xs font-semibold text-slate-600">{label}<select className={fieldClass} name={name} defaultValue={defaultValue ?? 'unknown'}>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CircleAlert className="h-3.5 w-3.5" />}{label}</span>
}

export function DataCenterSiteCheckEditor({ projectId, project }: DataCenterSiteCheckEditorProps) {
  const check = project.data_center_site_check ?? {}
  const siteAreaHa = check.siteAreaHectares ?? (project.land_area_sqm ? Number(project.land_area_sqm) / 10_000 : undefined)
  const gridMw = Number(project.data_center_grid_mw ?? 0)
  const action = async (formData: FormData): Promise<void> => {
    'use server'
    await saveDataCenterSiteCheck(projectId, formData)
  }

  return (
    <form action={action} className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-br from-[#1F2A44] to-[#07142F] p-5 text-white">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#8FDA45]">Rechenzentrum</p>
        <h2 className="mt-1 text-xl font-extrabold">Standortprüfung</h2>
        <p className="mt-2 text-sm leading-5 text-white/75">Strukturierte Erstprüfung nach dem EMA Standortdatenblatt. Unbestätigte Netzleistung wird im Dashboard getrennt ausgewiesen.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <StatusBadge ok={Boolean(project.location_city && project.location_state)} label="Standort" />
          <StatusBadge ok={Boolean(siteAreaHa)} label="Grundstück" />
          <StatusBadge ok={project.data_center_grid_confirmed === true} label={project.data_center_grid_confirmed ? 'Netz bestätigt' : 'Netz in Prüfung'} />
          <StatusBadge ok={check.fiberStatus === 'yes'} label={check.fiberStatus === 'yes' ? 'Glasfaser vorhanden' : 'Glasfaser offen'} />
        </div>
      </div>

      <section className={sectionClass}>
        <h3 className="mb-4 flex items-center gap-2 font-extrabold text-[#1F2A44]"><MapPin className="h-5 w-5 text-[#5CB800]" />1. Standort / Location</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Bundesland" name="state" defaultValue={project.location_state} />
          <Field label="Landkreis" name="district" defaultValue={check.district} />
          <Field label="Stadt / Gemeinde / Ort" name="city" defaultValue={project.location_city} />
          <Field label="Straße / Flurstück" name="streetPlot" defaultValue={check.streetPlot} />
          <Field label="GPS-Koordinaten" name="gpsCoordinates" defaultValue={check.gpsCoordinates} />
        </div>
      </section>

      <section className={sectionClass}>
        <h3 className="mb-4 flex items-center gap-2 font-extrabold text-[#1F2A44]"><Server className="h-5 w-5 text-[#5CB800]" />2. Grundstück / Property</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Grundstücksgröße (ha)" name="siteAreaHectares" inputMode="decimal" defaultValue={siteAreaHa} />
          <Field label="Grundstückskosten" name="landCost" defaultValue={check.landCost} />
          <Field label="Preis pro m² (€)" name="pricePerSqmEur" inputMode="decimal" defaultValue={check.pricePerSqmEur} />
        </div>
      </section>

      <section className={sectionClass}>
        <h3 className="mb-4 font-extrabold text-[#1F2A44]">3. Baurecht & Flächennutzung / Planning & Zoning</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField label="Aktuelle Nutzungsart" name="zoningDesignation" defaultValue={check.zoningDesignation} options={[["agricultural","Landwirtschaftlich"],["industrial","Industriell"],["commercial","Gewerblich"],["mixed","Mischgebiet"],["special","Sondergebiet"],["unknown","Nicht bekannt"]]} />
          <Field label="Sonstige Nutzung" name="otherDesignation" defaultValue={check.otherDesignation} />
          <SelectField label="Bebauungsplan vorhanden?" name="zoningPlanStatus" defaultValue={check.zoningPlanStatus} options={[["yes","Ja"],["no","Nein"],["in_preparation","In Aufstellung"],["unknown","Nicht bekannt"]]} />
          <SelectField label="Rechenzentrum zulässig?" name="dataCenterPermitted" defaultValue={check.dataCenterPermitted} options={[["yes","Ja"],["no","Nein"],["verify","Muss geprüft werden"],["unknown","Nicht bekannt"]]} />
        </div>
        <label className="mt-3 block space-y-1 text-xs font-semibold text-slate-600">Zusätzliche Angaben<textarea className={`${fieldClass} min-h-24 resize-y`} name="planningNotes" defaultValue={check.planningNotes ?? ''} /></label>
      </section>

      <section className={sectionClass}>
        <h3 className="mb-4 flex items-center gap-2 font-extrabold text-[#1F2A44]"><Zap className="h-5 w-5 text-[#5CB800]" />4. Stromversorgung / Power Supply</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Entfernung zur HV-Station (m)" name="hvDistanceMeters" inputMode="decimal" defaultValue={check.hvDistanceMeters} />
          <Field label="Name / Standort HV-Station" name="hvStationName" defaultValue={check.hvStationName} />
          <Field label="Anschlussleistung (MW)" name="gridMw" inputMode="decimal" defaultValue={project.data_center_grid_mw} />
          <Field label="Netzbetreiber" name="gridOperator" defaultValue={check.gridOperator} />
        </div>
        <label className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><input className="mt-0.5 h-4 w-4 accent-[#5CB800]" type="checkbox" name="gridConfirmed" defaultChecked={project.data_center_grid_confirmed === true} /><span><strong>Netzleistung bestätigt</strong><span className="mt-0.5 block text-xs leading-5">Nur aktivieren, wenn die Anschlussleistung nachgewiesen ist. Aktuell: {gridMw > 0 ? formatPowerFromMw(gridMw) : 'keine Angabe'}.</span></span></label>
      </section>

      <section className={sectionClass}>
        <h3 className="mb-4 flex items-center gap-2 font-extrabold text-[#1F2A44]"><Network className="h-5 w-5 text-[#5CB800]" />5. Glasfaser / Fiber Connectivity</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Entfernung zur Glasfasertrasse (m)" name="fiberDistanceMeters" inputMode="decimal" defaultValue={check.fiberDistanceMeters} />
          <Field label="Glasfaseranbieter / Netzbetreiber" name="fiberProvider" defaultValue={check.fiberProvider} />
          <SelectField label="Glasfaser auf Grundstück" name="fiberStatus" defaultValue={check.fiberStatus} options={[["yes","Ja"],["no","Nein"],["planned","In Planung"],["unknown","Nicht bekannt"]]} />
        </div>
      </section>

      <section className={sectionClass}>
        <h3 className="mb-4 font-extrabold text-[#1F2A44]">6. Ansprechpartner / Contact Person</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name / Unternehmen" name="contactName" defaultValue={project.contact_name} />
          <Field label="Telefon" name="contactPhone" defaultValue={project.contact_phone} />
          <Field label="E-Mail-Adresse" name="contactEmail" type="email" defaultValue={project.contact_email} />
          <Field label="Datum" name="assessmentDate" type="date" defaultValue={check.assessmentDate} />
        </div>
        <label className="mt-3 block space-y-1 text-xs font-semibold text-slate-600">Zusätzliche Angaben<textarea className={`${fieldClass} min-h-24 resize-y`} name="additionalNotes" defaultValue={check.additionalNotes ?? ''} /></label>
      </section>

      <button type="submit" className="min-h-12 w-full rounded-xl bg-[#5CB800] px-5 py-3 text-sm font-extrabold text-white shadow-sm transition hover:brightness-95 sm:w-auto">Standortprüfung speichern</button>
    </form>
  )
}
