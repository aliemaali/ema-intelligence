import { saveProjectCustomerIntake } from '@/lib/actions/customer-intake.actions'
import type { ProjectCustomerIntake } from '@/lib/projects/master-data'

interface CustomerIntakeEditorProps {
  projectId: string
  value?: ProjectCustomerIntake | null
}

const fieldClass =
  'min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#5CB800] focus:ring-2 focus:ring-[#5CB800]/15'

export function CustomerIntakeEditor({ projectId, value }: CustomerIntakeEditorProps) {
  const intake = value ?? {}
  const action = async (formData: FormData): Promise<void> => {
    await saveProjectCustomerIntake(projectId, formData)
  }

  return (
    <form action={action} className="space-y-4">
      <div>
        <h3 className="text-base font-bold text-[#1F2A44]">Kundenaufnahme</h3>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">
          Diese Angaben gehören direkt zum Projekt und stehen anschließend CAPEX, Exposé und Formularen zur Verfügung.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-semibold text-slate-600">
          Firma / Eigentümer
          <input className={fieldClass} name="companyName" defaultValue={intake.companyName ?? ''} />
        </label>
        <label className="space-y-1 text-xs font-semibold text-slate-600">
          Ansprechpartner
          <input className={fieldClass} name="contactPerson" defaultValue={intake.contactPerson ?? ''} />
        </label>
        <label className="space-y-1 text-xs font-semibold text-slate-600">
          E-Mail
          <input className={fieldClass} type="email" name="email" defaultValue={intake.email ?? ''} />
        </label>
        <label className="space-y-1 text-xs font-semibold text-slate-600">
          Telefon
          <input className={fieldClass} name="phone" defaultValue={intake.phone ?? ''} />
        </label>
        <label className="space-y-1 text-xs font-semibold text-slate-600">
          Kundentyp
          <input className={fieldClass} name="customerType" defaultValue={intake.customerType ?? ''} />
        </label>
        <label className="space-y-1 text-xs font-semibold text-slate-600">
          Gebäudeart
          <input className={fieldClass} name="buildingType" defaultValue={intake.buildingType ?? ''} />
        </label>
        <label className="space-y-1 text-xs font-semibold text-slate-600">
          Nutzungsart
          <input className={fieldClass} name="usageType" defaultValue={intake.usageType ?? ''} />
        </label>
        <label className="space-y-1 text-xs font-semibold text-slate-600">
          Postleitzahl
          <input className={fieldClass} name="postalCode" defaultValue={intake.postalCode ?? ''} />
        </label>
        <label className="space-y-1 text-xs font-semibold text-slate-600">
          Flurstück
          <input className={fieldClass} name="parcel" defaultValue={intake.parcel ?? ''} />
        </label>
        <label className="space-y-1 text-xs font-semibold text-slate-600">
          Netzbetreiber
          <input className={fieldClass} name="gridOperator" defaultValue={intake.gridOperator ?? ''} />
        </label>
        <label className="space-y-1 text-xs font-semibold text-slate-600">
          Dachfläche in m²
          <input className={fieldClass} inputMode="decimal" name="roofAreaSqm" defaultValue={intake.roofAreaSqm ?? ''} />
        </label>
        <label className="space-y-1 text-xs font-semibold text-slate-600">
          Jahresverbrauch in kWh
          <input className={fieldClass} inputMode="decimal" name="annualConsumptionKwh" defaultValue={intake.annualConsumptionKwh ?? ''} />
        </label>
      </div>

      <label className="block space-y-1 text-xs font-semibold text-slate-600">
        Ergänzende Angaben
        <textarea
          className={`${fieldClass} min-h-24 resize-y`}
          name="notes"
          defaultValue={intake.notes ?? ''}
        />
      </label>

      <button
        type="submit"
        className="min-h-11 rounded-xl bg-[#5CB800] px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-95"
      >
        Kundenaufnahme speichern
      </button>
    </form>
  )
}
