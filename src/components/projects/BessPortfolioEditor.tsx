'use client'

import { useState } from 'react'
import { Building2, Plus, Trash2 } from 'lucide-react'
import { calculateBessPortfolioTotals, type BessPortfolio, type BessPortfolioSite } from '@/lib/projects/bessPortfolio'

const emptySite = (): BessPortfolioSite => ({
  name: '', state: '', mw: null, mwh: null, durationH: null,
  gridOperator: '', gridStatus: '', landStatus: '', permitStatus: '',
})

function decimal(value: string) {
  if (!value.trim()) return null
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

export function BessPortfolioEditor({ initialPortfolio }: { initialPortfolio?: BessPortfolio | null }) {
  const [enabled, setEnabled] = useState(Boolean(initialPortfolio))
  const [sites, setSites] = useState<BessPortfolioSite[]>(initialPortfolio?.sites ?? [emptySite(), emptySite()])
  const portfolio = enabled ? { isPackageSale: true as const, sites } : null
  const totals = calculateBessPortfolioTotals(portfolio)

  function updateSite(index: number, field: keyof BessPortfolioSite, value: string) {
    setSites((current) => current.map((site, siteIndex) => siteIndex === index
      ? { ...site, [field]: ['mw', 'mwh', 'durationH'].includes(field) ? decimal(value) : value }
      : site))
  }

  return (
    <section className="rounded-2xl border border-[#5CB800]/25 bg-[#5CB800]/5 p-4">
      <input type="hidden" name="bess_portfolio_json" value={portfolio ? JSON.stringify(portfolio) : ''} />
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="mt-1 h-5 w-5 accent-[#5CB800]" />
        <span><strong className="block text-sm text-[#07142F]">Als BESS-Portfolio im Paket verkaufen</strong><span className="mt-1 block text-xs leading-5 text-slate-600">Ein Projekt und ein Exposé, mit getrennter Prüfung aller Standorte.</span></span>
      </label>

      {enabled && <div className="mt-4 space-y-4">
        <div className="grid grid-cols-3 gap-2 rounded-xl bg-[#07142F] p-3 text-center text-white">
          <div><span className="block text-[10px] uppercase text-white/60">Standorte</span><strong>{totals.siteCount}</strong></div>
          <div><span className="block text-[10px] uppercase text-white/60">Leistung</span><strong>{totals.mw.toLocaleString('de-DE')} MW</strong></div>
          <div><span className="block text-[10px] uppercase text-white/60">Kapazität</span><strong>{totals.mwh.toLocaleString('de-DE')} MWh</strong></div>
        </div>
        {sites.map((site, index) => <div key={index} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-extrabold text-[#07142F]"><Building2 className="h-4 w-4 text-[#5CB800]" />Standort {index + 1}</div>{sites.length > 2 && <button type="button" onClick={() => setSites((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Standort ${index + 1} entfernen`} className="rounded-lg p-2 text-red-600"><Trash2 className="h-4 w-4" /></button>}</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Name" value={site.name} onChange={(value) => updateSite(index, 'name', value)} />
            <Field label="Bundesland" value={site.state} onChange={(value) => updateSite(index, 'state', value)} />
            <Field label="Leistung (MW)" type="number" value={site.mw ?? ''} onChange={(value) => updateSite(index, 'mw', value)} />
            <Field label="Kapazität (MWh)" type="number" value={site.mwh ?? ''} onChange={(value) => updateSite(index, 'mwh', value)} />
            <Field label="Speicherdauer (h)" type="number" value={site.durationH ?? ''} onChange={(value) => updateSite(index, 'durationH', value)} />
            <Field label="Netzbetreiber" value={site.gridOperator} onChange={(value) => updateSite(index, 'gridOperator', value)} />
            <Field label="Netzstatus" value={site.gridStatus} onChange={(value) => updateSite(index, 'gridStatus', value)} />
            <Field label="Flächensicherung" value={site.landStatus} onChange={(value) => updateSite(index, 'landStatus', value)} />
            <Field label="Genehmigung" value={site.permitStatus} onChange={(value) => updateSite(index, 'permitStatus', value)} />
          </div>
        </div>)}
        <button type="button" onClick={() => setSites((current) => [...current, emptySite()])} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#5CB800] text-sm font-extrabold text-[#2F8A00]"><Plus className="h-4 w-4" />Standort hinzufügen</button>
      </div>}
    </section>
  )
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string | number; onChange: (value: string) => void; type?: 'text' | 'number' }) {
  return <label className="block"><span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</span><input type={type} step={type === 'number' ? '0.01' : undefined} min={type === 'number' ? '0' : undefined} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#5CB800]" /></label>
}
