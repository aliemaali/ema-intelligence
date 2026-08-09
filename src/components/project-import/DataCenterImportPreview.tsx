'use client'

import type { DataCenterImport } from '@/lib/ai/data-center-import'

const inputClass = 'mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-extrabold text-[#07142F] outline-none [color-scheme:light] focus:border-[#5CB800] focus:ring-2 focus:ring-[#5CB800]/15'

function Field({ name, label, value, unit, type = 'text' }: {
  name: string
  label: string
  value: string | number | null
  unit?: string
  type?: string
}) {
  return (
    <label className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">{label}</span>
      <div className="relative">
        <input
          name={name}
          type={type}
          inputMode={type === 'number' ? 'decimal' : undefined}
          step={type === 'number' ? 'any' : undefined}
          min={type === 'number' ? '0' : undefined}
          defaultValue={value ?? ''}
          className={`${inputClass} ${unit ? 'pr-20' : ''}`}
        />
        {unit ? <span className="absolute right-3 top-1/2 mt-1 -translate-y-1/2 text-xs font-bold text-slate-400">{unit}</span> : null}
      </div>
    </label>
  )
}

function SelectField({ name, label, value, options }: {
  name: string
  label: string
  value: string
  options: Array<[string, string]>
}) {
  return (
    <label className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">{label}</span>
      <select name={name} defaultValue={value || 'unknown'} className={inputClass}>
        {options.map(([optionValue, text]) => <option key={optionValue} value={optionValue}>{text}</option>)}
      </select>
    </label>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-extrabold text-[#07142F]">{title}</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </section>
  )
}

export function DataCenterImportPreview({ data }: { data: DataCenterImport }) {
  return (
    <div className="mt-5 space-y-6">
      <Section title="1. Standort">
        <Field name="project_name" label="Projektname" value={data.projectName} />
        <Field name="location_state" label="Bundesland" value={data.state} />
        <Field name="location_district" label="Landkreis" value={data.district} />
        <Field name="location_city" label="Stadt / Gemeinde / Ort" value={data.city} />
        <Field name="location_address" label="Straße / Flurstück" value={data.address} />
        <Field name="gps_coordinates" label="GPS-Koordinaten" value={data.coordinates} />
      </Section>

      <Section title="2. Grundstück">
        <Field name="site_area_hectares" label="Grundstücksgröße" value={data.landAreaHa} unit="ha" type="number" />
        <Field name="land_cost" label="Grundstückskosten / Pacht" value={data.landCost} />
        <Field name="price_per_sqm_eur" label="Preis pro m²" value={data.landPricePerSqm} unit="€/m²" type="number" />
      </Section>

      <Section title="3. Baurecht und Flächennutzung">
        <SelectField name="zoning_designation" label="Aktuelle Nutzungsart" value={data.zoningDesignation} options={[
          ['agricultural', 'Landwirtschaftlich'], ['industrial', 'Industriell'],
          ['commercial', 'Gewerblich'], ['mixed', 'Mischgebiet'],
          ['special', 'Sondergebiet'], ['unknown', 'Nicht bekannt'],
        ]} />
        <Field name="other_designation" label="Sonstige Nutzung" value={data.otherDesignation} />
        <SelectField name="zoning_plan_status" label="Bebauungsplan" value={data.zoningPlanStatus} options={[
          ['yes', 'Ja'], ['no', 'Nein'], ['in_preparation', 'In Aufstellung'], ['unknown', 'Nicht bekannt'],
        ]} />
        <SelectField name="data_center_permitted" label="Rechenzentrum zulässig?" value={data.dataCenterPermitted} options={[
          ['yes', 'Ja'], ['no', 'Nein'], ['verify', 'Muss geprüft werden'], ['unknown', 'Nicht bekannt'],
        ]} />
        <Field name="planning_notes" label="Zusätzliche Angaben" value={data.planningNotes} />
      </Section>

      <Section title="4. Stromversorgung">
        <Field name="hv_distance_meters" label="Entfernung HV-Station" value={data.hvDistanceM} unit="m" type="number" />
        <Field name="hv_station_name" label="HV-Station / Umspannwerk" value={data.hvStation} />
        <Field name="data_center_grid_mw" label="Verfügbare Anschlussleistung" value={data.availablePowerMw} unit="MW" type="number" />
        <Field name="grid_operator" label="Netzbetreiber" value={data.gridOperator} />
      </Section>

      <Section title="5. Glasfaseranbindung">
        <Field name="fiber_distance_meters" label="Entfernung Glasfasertrasse" value={data.fiberDistanceM} unit="m" type="number" />
        <Field name="fiber_provider" label="Glasfaseranbieter" value={data.fiberProvider} />
        <SelectField name="fiber_status" label="Glasfaser auf Grundstück" value={data.fiberStatus} options={[
          ['yes', 'Ja'], ['no', 'Nein'], ['planned', 'In Planung'], ['unknown', 'Nicht bekannt'],
        ]} />
      </Section>

      <Section title="6. Ansprechpartner">
        <Field name="contact_name" label="Name" value={data.contactName} />
        <Field name="contact_company" label="Unternehmen" value={data.contactCompany} />
        <Field name="contact_phone" label="Telefon" value={data.contactPhone} />
        <Field name="contact_email" label="E-Mail" value={data.contactEmail} type="email" />
        <Field name="assessment_date" label="Datum" value={data.assessmentDate} type="date" />
        <Field name="additional_notes" label="Zusätzliche Angaben" value={data.additionalNotes} />
      </Section>

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <input type="checkbox" name="data_center_grid_confirmed" value="yes" className="mt-1 h-5 w-5 accent-[#5CB800]" />
        <span className="text-sm font-bold leading-6 text-amber-900">
          Die erkannte Anschlussleistung ist durch einen belastbaren Nachweis bestätigt.
          <span className="block text-xs font-semibold text-amber-700">Ohne Haken wird sie sicherheitshalber als „in Prüfung“ gespeichert.</span>
        </span>
      </label>

      <p className="rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-500">
        Leere Felder wurden nicht sicher erkannt. EMA ergänzt keine erfundenen Werte.
      </p>
    </div>
  )
}
