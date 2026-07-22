'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { upsertDeal } from '@/lib/actions/deal.actions'
import { calculateDeal, calculateSensitivity, cn, formatCurrency, formatPercent } from '@/lib/utils'
import { LoadingSpinner } from '@/components/ui'
import type { Deal, Expense, MarginType, Project } from '@/lib/types/database.types'

type DealProject = Pick<Project, 'pv_mwp' | 'bess_mwh' | 'project_type' | 'project_number'> & {
  notes?: string | null
  purchase_price?: number | null
  deal_purchase_price?: number | null
  active_deal_purchase_price?: number | null
}

type PricingMode = 'total' | 'per_kwp'

interface Props {
  projectId: string
  project: DealProject
  deal?: Deal | null
  expenses?: Expense[]
}

function parseGerman(value: string) {
  return parseFloat(value.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')) || 0
}
function formatNumber(value: number, decimals = 0) {
  if (!value) return ''
  return value.toLocaleString('de-DE', { maximumFractionDigits: decimals })
}
function existingPrice(project: DealProject) {
  return Number(project.purchase_price ?? project.deal_purchase_price ?? project.active_deal_purchase_price ?? 0)
}

export function DealForm({ projectId, project, deal, expenses = [] }: Props) {
  const [pending, startTransition] = useTransition()
  const pvKwp = Number(project.pv_mwp ?? 0)
  const hasPv = pvKwp > 0
  const savedDeal = deal as (Deal & { purchase_price_type?: PricingMode; included_margin_per_kwp?: number | null }) | null | undefined
  const initialTotal = Number(savedDeal?.purchase_price ?? existingPrice(project))
  const initialMode: PricingMode = savedDeal?.purchase_price_type === 'per_kwp' && hasPv ? 'per_kwp' : 'total'

  const [pricingMode, setPricingMode] = useState<PricingMode>(initialMode)
  const [purchaseInput, setPurchaseInput] = useState(initialMode === 'per_kwp' && hasPv ? initialTotal / pvKwp : initialTotal)
  const initialMarginType = savedDeal?.margin_type === 'per_mwh' ? 'percent' : savedDeal?.margin_type ?? 'percent'
  const [marginType, setMarginType] = useState<MarginType>(initialMarginType)
  const [marginValue, setMarginValue] = useState(Number(savedDeal?.margin_value ?? savedDeal?.included_margin_per_kwp ?? 0))

  const expense = (category: string) => expenses.find((item) => item.category === category)?.amount_eur ?? 0
  const [externalPerKwp, setExternalPerKwp] = useState(hasPv ? expense('aussenprovision') / pvKwp : 0)
  const [otherCosts, setOtherCosts] = useState(expense('sonstiges'))

  const purchasePrice = pricingMode === 'per_kwp' ? purchaseInput * pvKwp : purchaseInput
  const externalTotal = hasPv ? externalPerKwp * pvKwp : 0
  const totalExpenses = externalTotal + otherCosts
  const calc = calculateDeal({ purchase_price: purchasePrice, margin_type: marginType, margin_value: marginValue, pv_mwp: project.pv_mwp, bess_mwh: project.bess_mwh, expenses_total: totalExpenses })
  const sensitivity = useMemo(() => calculateSensitivity({ purchase_price: purchasePrice, margin_type: marginType, margin_value: marginValue, pv_mwp: project.pv_mwp, bess_mwh: project.bess_mwh, expenses_total: totalExpenses }), [purchasePrice, marginType, marginValue, project.pv_mwp, project.bess_mwh, totalExpenses])

  function submit(formData: FormData) {
    startTransition(async () => {
      try {
        const result = await upsertDeal(projectId, formData)
        result?.error ? toast.error(result.error) : toast.success('Deal gespeichert')
      } catch (error) {
        if (!(error as Error).message?.includes('NEXT_REDIRECT')) toast.error('Fehler beim Speichern')
      }
    })
  }

  const marginOptions: Array<{ value: MarginType; label: string; disabled?: boolean }> = [
    { value: 'percent', label: '% auf EK' },
    { value: 'per_kwp', label: 'Aufschlag €/kWp', disabled: !hasPv },
    { value: 'included_per_kwp', label: 'Im EK enthalten', disabled: !hasPv },
  ]

  return (
    <form action={submit} className="space-y-5">
      <section className="card-padded space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Einkauf</h3>
        <div>
          <label className="form-label">Berechnungsart EK</label>
          <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border">
            <button type="button" onClick={() => setPricingMode('total')} className={cn('px-3 py-2 text-sm font-semibold', pricingMode === 'total' ? 'bg-[#5CB800] text-white' : 'bg-card text-muted-foreground')}>Pauschalpreis</button>
            <button type="button" disabled={!hasPv} onClick={() => hasPv && setPricingMode('per_kwp')} className={cn('px-3 py-2 text-sm font-semibold', pricingMode === 'per_kwp' ? 'bg-[#5CB800] text-white' : 'bg-card text-muted-foreground', !hasPv && 'cursor-not-allowed opacity-30')}>Preis pro kWp</button>
          </div>
          <input type="hidden" name="purchase_price_type" value={pricingMode} />
        </div>

        <div>
          <label className="form-label">{pricingMode === 'total' ? 'EK-Preis gesamt' : 'EK-Preis pro kWp'}</label>
          <div className="relative">
            <input type="hidden" name="purchase_input" value={purchaseInput || ''} />
            <input value={formatNumber(purchaseInput, 2)} onChange={(event) => setPurchaseInput(parseGerman(event.target.value))} inputMode="decimal" className="form-input pr-20" placeholder="0" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">{pricingMode === 'total' ? '€' : '€/kWp'}</span>
          </div>
          {purchasePrice > 0 && <p className="mt-1 text-xs text-muted-foreground">Gesamt-EK: {formatCurrency(purchasePrice)}{hasPv ? ` · ${formatNumber(purchasePrice / pvKwp, 2)} €/kWp` : ''}</p>}
        </div>
      </section>

      <section className="card-padded space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Marge</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          {marginOptions.map((option) => (
            <button key={option.value} type="button" disabled={option.disabled} onClick={() => { if (!option.disabled) { setMarginType(option.value); setMarginValue(0) } }} className={cn('rounded-lg border px-3 py-2 text-xs font-semibold', marginType === option.value ? 'border-[#5CB800] bg-[#5CB800]/10 text-[#2F8A00]' : 'border-border text-muted-foreground', option.disabled && 'cursor-not-allowed opacity-30')}>{option.label}</button>
          ))}
        </div>
        <input type="hidden" name="margin_type" value={marginType} />

        <div>
          <label className="form-label">{marginType === 'percent' ? 'Marge in Prozent' : marginType === 'included_per_kwp' ? 'Bereits enthaltene Marge' : 'Aufschlag pro kWp'}</label>
          <div className="relative">
            <input name="margin_value" type="number" step="0.01" min="0" value={marginValue || ''} onChange={(event) => setMarginValue(Number(event.target.value) || 0)} className="form-input pr-20" placeholder="0" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">{marginType === 'percent' ? '%' : '€/kWp'}</span>
          </div>
          {calc.margin_eur != null && calc.margin_eur > 0 && <p className="mt-1 text-xs text-muted-foreground">Marge gesamt: {formatCurrency(calc.margin_eur)}</p>}
          {marginType === 'included_per_kwp' && calc.pure_purchase_price != null && <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm"><p>Reiner Einkauf ohne enthaltene Marge: <strong>{formatCurrency(calc.pure_purchase_price)}</strong></p><p className="mt-1 text-xs text-muted-foreground">Der Verkaufspreis bleibt gleich dem eingegebenen EK. Die Marge wird nicht nochmals aufgeschlagen.</p></div>}
        </div>
      </section>

      <section className="card-padded space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Kosten</h3>
        <div>
          <label className="form-label">Außenprovision</label>
          <input type="hidden" name="exp_aussenprovision" value={externalTotal || ''} />
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="relative"><input type="number" step="0.01" min="0" value={externalPerKwp || ''} onChange={(event) => setExternalPerKwp(Number(event.target.value) || 0)} className="form-input pr-20" placeholder="0" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">€/kWp</span></div>
            <input name="exp_aussenprovision_desc" defaultValue={expenses.find((item) => item.category === 'aussenprovision')?.description ?? ''} className="form-input" placeholder="Beschreibung" />
          </div>
          {externalTotal > 0 && <p className="mt-1 text-xs text-muted-foreground">Gesamt: {formatCurrency(externalTotal)}</p>}
        </div>
        <div>
          <label className="form-label">Sonstige Kosten</label>
          <input type="hidden" name="exp_sonstiges" value={otherCosts || ''} />
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="relative"><input value={formatNumber(otherCosts)} onChange={(event) => setOtherCosts(parseGerman(event.target.value))} inputMode="numeric" className="form-input pr-12" placeholder="0" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span></div>
            <input name="exp_sonstiges_desc" defaultValue={expenses.find((item) => item.category === 'sonstiges')?.description ?? ''} className="form-input" placeholder="Beschreibung" />
          </div>
        </div>
      </section>

      {calc.net_profit != null && (
        <section className={cn('card-padded border-2', calc.net_profit >= 0 ? 'border-[#5CB800]/30 bg-[#5CB800]/5' : 'border-red-300 bg-red-50')}>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ergebnis</h3>
          <div className="mt-3 space-y-2">
            <Result label="Verkaufspreis" value={formatCurrency(calc.sales_price)} />
            <Result label={`Bruttomarge (${formatPercent(calc.gross_margin_pct)})`} value={formatCurrency(calc.gross_margin)} />
            <Result label={`Nettogewinn (${formatPercent(calc.net_profit_pct)})`} value={formatCurrency(calc.net_profit)} highlight positive={calc.net_profit >= 0} />
          </div>
        </section>
      )}

      {calc.net_profit != null && calc.net_profit > 0 && (
        <section className="card-padded">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sensitivitätsanalyse</h3>
          <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b"><th className="pb-2 text-left">Szenario</th><th className="pb-2 text-right">Brutto</th><th className="pb-2 text-right">Netto</th></tr></thead><tbody>{sensitivity.map((row) => <tr key={row.label} className="border-b last:border-0"><td className="flex items-center gap-1 py-2">{row.label === 'Base' ? <Minus className="h-3 w-3" /> : row.label.startsWith('+') ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{row.label}</td><td className="py-2 text-right">{formatCurrency(row.gross, { compact: true })}</td><td className="py-2 text-right font-semibold">{formatCurrency(row.net, { compact: true })}</td></tr>)}</tbody></table></div>
        </section>
      )}

      <div><label className="form-label">Deal-Notizen</label><textarea name="notes" rows={2} defaultValue={savedDeal?.notes ?? ''} className="form-input resize-none" placeholder="Verhandlungsnotizen, Bedingungen…" /></div>
      <button type="submit" disabled={pending} className="btn-primary w-full">{pending ? <LoadingSpinner size="sm" /> : '✓ Deal speichern'}</button>
    </form>
  )
}

function Result({ label, value, highlight = false, positive = true }: { label: string; value: string; highlight?: boolean; positive?: boolean }) {
  return <div className="flex items-center justify-between"><span className={cn('text-sm', highlight ? 'font-semibold' : 'text-muted-foreground')}>{label}</span><span className={cn('font-semibold', highlight ? positive ? 'text-base text-[#5CB800]' : 'text-base text-red-600' : 'text-sm')}>{value}</span></div>
}
