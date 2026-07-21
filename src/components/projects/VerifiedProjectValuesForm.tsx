'use client'

import { useMemo, useState, useTransition } from 'react'
import { CheckCircle2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { updateVerifiedProjectValues } from '@/lib/actions/project-values.actions'

const inputClass = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-[#07142F] outline-none [color-scheme:light] focus:border-[#5CB800] focus:ring-2 focus:ring-[#5CB800]/15'
const FEED_IN_TYPES = ['EEG', 'Volleinspeisung', 'Teileinspeisung', 'PPA', 'Direktvermarktung', 'Sonstige']

function parseGermanNumber(value: string): number | null {
  const normalized = value.replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '')
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function formatGermanInteger(value: number | string | null | undefined): string {
  const numeric = typeof value === 'number' ? value : parseGermanNumber(String(value ?? ''))
  return numeric == null ? '' : new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(numeric)
}

export function VerifiedProjectValuesForm({ project }: { project: any }) {
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [purchasePrice, setPurchasePrice] = useState(formatGermanInteger(project.deal_purchase_price))
  const initialFeedInType = useMemo(() => FEED_IN_TYPES.includes(project.feed_in_type) ? project.feed_in_type : '', [project.feed_in_type])

  function submit(formData: FormData) {
    const numericPurchasePrice = parseGermanNumber(purchasePrice)
    formData.set('purchase_price', numericPurchasePrice == null ? '' : String(numericPurchasePrice))

    startTransition(async () => {
      const result = await updateVerifiedProjectValues(project.id, formData)
      if (result?.error) {
        toast.error(result.error)
        setSaved(false)
        return
      }
      toast.success('Geprüfte Projektwerte gespeichert')
      setSaved(true)
      setPurchasePrice(formatGermanInteger(numericPurchasePrice))
    })
  }

  return (
    <form action={submit} className="mt-8 rounded-[1.6rem] border border-[#5CB800]/25 bg-white p-5 shadow-sm">
      <input type="hidden" name="project_type" value={project.project_type ?? ''} />
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#5CB800]/10 text-[#2F8A00]"><CheckCircle2 className="h-5 w-5" /></span>
        <div><h2 className="text-lg font-extrabold text-[#07142F]">Geprüfte Projektwerte</h2><p className="mt-1 text-sm text-slate-500">Diese Werte steuern Dashboard, Kalkulation und Exposé. Änderungen werden protokolliert.</p></div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label><span className="text-xs font-bold text-slate-500">PV-Leistung (kWp)</span><input className={inputClass} type="number" step="any" min="0" name="pv_kwp" defaultValue={project.pv_mwp ?? ''} /></label>
        <label><span className="text-xs font-bold text-slate-500">EK-Kaufpreis (€)</span><input className={inputClass} inputMode="decimal" name="purchase_price_display" value={purchasePrice} onChange={(event) => setPurchasePrice(event.target.value)} onBlur={() => setPurchasePrice(formatGermanInteger(purchasePrice))} placeholder="z. B. 318.877" /></label>
        <label><span className="text-xs font-bold text-slate-500">Einspeiseart</span><select className={inputClass} name="feed_in_type" defaultValue={initialFeedInType}><option value="">– wählen –</option>{FEED_IN_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
        <label><span className="text-xs font-bold text-slate-500">Vergütung (ct/kWh)</span><input className={inputClass} type="number" step="any" min="0" name="feed_in_tariff_ct_kwh" defaultValue={project.feed_in_tariff_ct_kwh ?? ''} /></label>
        <label className="sm:col-span-2"><span className="text-xs font-bold text-slate-500">Spezifischer Ertrag (kWh/kWp)</span><input className={inputClass} type="number" step="any" min="0" name="specific_yield_kwh_kwp" defaultValue={project.specific_yield_kwh_kwp ?? ''} /></label>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold text-slate-500">Plausibilitätsprüfung aktiv · Exposé aktualisiert sich nach dem Speichern automatisch.</p>
        <button disabled={pending} className="btn-primary min-w-40 justify-center disabled:opacity-50"><Save className="h-4 w-4" />{pending ? 'Speichert ...' : saved ? 'Gespeichert' : 'Werte speichern'}</button>
      </div>
    </form>
  )
}
