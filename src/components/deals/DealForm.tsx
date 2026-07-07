'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { upsertDeal } from '@/lib/actions/deal.actions'
import { calculateDeal, calculateSensitivity, formatCurrency, formatPercent, cn } from '@/lib/utils'
import { LoadingSpinner } from '@/components/ui'
import type { Deal, Expense, Project, MarginType } from '@/lib/types/database.types'

interface DealFormProps {
  projectId: string
  project: Pick<Project, 'pv_mwp' | 'bess_mwh' | 'project_type' | 'project_number'>
  deal?: Deal | null
  expenses?: Expense[]
}

function parseGermanInput(value: string): number {
  return parseFloat(value.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')) || 0
}

function formatGermanInteger(value: number): string {
  if (!value) return ''
  return Math.round(value).toLocaleString('de-DE')
}

function formatPerUnit(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return Math.round(value).toLocaleString('de-DE')
}

export function DealForm({ projectId, project, deal, expenses = [] }: DealFormProps) {
  const [pending, startTransition] = useTransition()

  const pvKwp = Number(project.pv_mwp ?? 0)
  const hasPv = pvKwp > 0

  const getExpenseAmount = (category: string) =>
    expenses.find((expense) => expense.category === category)?.amount_eur ?? 0

  const existingExternalCommission = getExpenseAmount('aussenprovision')
  const existingExternalCommissionPerKwp = hasPv
    ? existingExternalCommission / pvKwp
    : 0

  const [purchasePrice, setPurchasePrice] = useState<number>(deal?.purchase_price ?? 0)
  const [marginType, setMarginType] = useState<MarginType>(deal?.margin_type === 'per_mwh' ? 'percent' : deal?.margin_type ?? 'percent')
  const [marginValue, setMarginValue] = useState<number>(deal?.margin_type === 'per_mwh' ? 0 : deal?.margin_value ?? 0)
  const [externalCommissionPerKwp, setExternalCommissionPerKwp] = useState<number>(existingExternalCommissionPerKwp)
  const [otherCosts, setOtherCosts] = useState<number>(getExpenseAmount('sonstiges'))

  const externalCommissionTotal = hasPv
    ? Math.round(externalCommissionPerKwp * pvKwp)
    : 0

  const totalExpenses = externalCommissionTotal + otherCosts

  const calc = calculateDeal({
    purchase_price: purchasePrice,
    margin_type: marginType,
    margin_value: marginValue,
    pv_mwp: project.pv_mwp,
    bess_mwh: project.bess_mwh,
    expenses_total: totalExpenses,
  })

  const sensitivity = calculateSensitivity({
    purchase_price: purchasePrice,
    margin_type: marginType,
    margin_value: marginValue,
    pv_mwp: project.pv_mwp,
    bess_mwh: project.bess_mwh,
    expenses_total: totalExpenses,
  })

  const upsertDealWithProjectId = upsertDeal.bind(null, projectId)

  const handleSubmit = async (formData: FormData) => {
    startTransition(async () => {
      try {
        const result = await upsertDealWithProjectId(formData)
        if (result?.error) {
          toast.error(result.error)
        } else {
          toast.success('Deal gespeichert')
        }
      } catch (err) {
        const e = err as Error
        if (!e.message?.includes('NEXT_REDIRECT')) {
          toast.error('Fehler beim Speichern')
        }
      }
    })
  }

  const marginUnit = marginType === 'percent' ? '%' : '€/kWp'

  return (
    <form action={handleSubmit} className="space-y-5">
      <div className="card-padded space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Einkauf
        </h3>

        <div>
          <label className="form-label">EK-Preis gesamt</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
            <input type="hidden" name="purchase_price" value={purchasePrice || ''} />
            <input
              type="text"
              inputMode="numeric"
              value={formatGermanInteger(purchasePrice)}
              onChange={(e) => setPurchasePrice(parseGermanInput(e.target.value))}
              placeholder="0"
              className="form-input pl-7"
            />
          </div>
          {purchasePrice > 0 && hasPv && (
            <p className="text-xs text-muted-foreground mt-1">
              = {formatPerUnit(purchasePrice / pvKwp)} €/kWp
            </p>
          )}
        </div>
      </div>

      <div className="card-padded space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Marge
        </h3>

        <div>
          <label className="form-label">Margentyp</label>
          <div className="flex rounded-lg border border-border overflow-hidden">
            {([
              { value: 'percent', label: '%', disabled: false },
              { value: 'per_kwp', label: '€/kWp', disabled: !hasPv },
            ] as const).map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={option.disabled}
                onClick={() => {
                  if (!option.disabled) {
                    setMarginType(option.value as MarginType)
                    setMarginValue(0)
                  }
                }}
                className={cn(
                  'flex-1 py-2 text-sm font-medium transition-colors',
                  marginType === option.value
                    ? 'bg-[#5CB800] text-white'
                    : 'bg-card text-muted-foreground hover:text-foreground',
                  option.disabled && 'opacity-30 cursor-not-allowed'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <input type="hidden" name="margin_type" value={marginType} />
        </div>

        <div>
          <label className="form-label">Wert</label>
          <div className="relative">
            <input
              name="margin_value"
              type="number"
              step="0.01"
              min="0"
              value={marginValue || ''}
              onChange={(e) => setMarginValue(parseFloat(e.target.value) || 0)}
              placeholder="0"
              className="form-input pr-16"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
              {marginUnit}
            </span>
          </div>
          {calc.margin_eur !== null && calc.margin_eur > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              = {formatCurrency(calc.margin_eur)}
            </p>
          )}
        </div>
      </div>

      <div className="card-padded space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Kosten
        </h3>

        <div>
          <label className="form-label text-xs">Außenprovision</label>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr] gap-2">
            <div className="relative">
              <input type="hidden" name="exp_aussenprovision" value={externalCommissionTotal || ''} />
              <input
                type="number"
                step="0.01"
                min="0"
                value={externalCommissionPerKwp || ''}
                onChange={(e) => setExternalCommissionPerKwp(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="form-input pr-16"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
                €/kWp
              </span>
            </div>
            <input
              name="exp_aussenprovision_desc"
              type="text"
              placeholder="Beschreibung"
              defaultValue={expenses.find((e) => e.category === 'aussenprovision')?.description ?? ''}
              className="form-input text-xs"
            />
          </div>
          {externalCommissionTotal > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              = {formatCurrency(externalCommissionTotal)}
            </p>
          )}
        </div>

        <div>
          <label className="form-label text-xs">Sonstige Kosten</label>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr] gap-2">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
              <input type="hidden" name="exp_sonstiges" value={otherCosts || ''} />
              <input
                type="text"
                inputMode="numeric"
                value={formatGermanInteger(otherCosts)}
                onChange={(e) => setOtherCosts(parseGermanInput(e.target.value))}
                placeholder="0"
                className="form-input pl-7"
              />
            </div>
            <input
              name="exp_sonstiges_desc"
              type="text"
              placeholder="Beschreibung"
              defaultValue={expenses.find((e) => e.category === 'sonstiges')?.description ?? ''}
              className="form-input text-xs"
            />
          </div>
        </div>

        {totalExpenses > 0 && (
          <div className="flex justify-between pt-2 border-t border-border">
            <span className="text-xs text-muted-foreground">Gesamtkosten</span>
            <span className="text-sm font-medium text-foreground">
              {formatCurrency(totalExpenses)}
            </span>
          </div>
        )}
      </div>

      {calc.net_profit !== null && (
        <div className={cn(
          'card-padded space-y-2 border-2',
          (calc.net_profit ?? 0) >= 0
            ? 'border-[#5CB800]/30 bg-[#5CB800]/5'
            : 'border-destructive/30 bg-destructive/5'
        )}>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Ergebnis
          </h3>

          <div className="space-y-1.5">
            <ResultRow label="Verkaufspreis" value={formatCurrency(calc.sales_price)} />
            <ResultRow label={`Bruttomarge (${formatPercent(calc.gross_margin_pct)})`} value={formatCurrency(calc.gross_margin)} />
            <div className="divider my-1" />
            <ResultRow
              label={`Nettogewinn (${formatPercent(calc.net_profit_pct)})`}
              value={formatCurrency(calc.net_profit)}
              highlight
              positive={(calc.net_profit ?? 0) >= 0}
            />
          </div>
        </div>
      )}

      {calc.net_profit !== null && calc.net_profit > 0 && (
        <div className="card-padded">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Sensitivitätsanalyse
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-muted-foreground pb-2 font-medium">Szenario</th>
                  <th className="text-right text-muted-foreground pb-2 font-medium">Brutto</th>
                  <th className="text-right text-muted-foreground pb-2 font-medium">Netto</th>
                </tr>
              </thead>
              <tbody>
                {sensitivity.map((row) => {
                  const isBase = row.label === 'Base'
                  const isPositiveScenario = row.label.startsWith('+')
                  return (
                    <tr key={row.label} className={cn('border-b border-border/50 last:border-0', isBase && 'bg-muted/50')}>
                      <td className="py-1.5 font-medium flex items-center gap-1">
                        {isBase ? <Minus className="w-3 h-3 text-muted-foreground" /> :
                          isPositiveScenario ? <TrendingUp className="w-3 h-3 text-emerald-500" /> :
                          <TrendingDown className="w-3 h-3 text-red-500" />}
                        {row.label}
                      </td>
                      <td className="py-1.5 text-right text-muted-foreground">
                        {formatCurrency(row.gross, { compact: true })}
                      </td>
                      <td className={cn(
                        'py-1.5 text-right font-medium',
                        isBase ? 'text-[#5CB800]' : isPositiveScenario ? 'text-emerald-500' : 'text-red-500'
                      )}>
                        {formatCurrency(row.net, { compact: true })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <label className="form-label">Deal-Notizen</label>
        <textarea
          name="notes"
          rows={2}
          defaultValue={deal?.notes ?? ''}
          placeholder="Verhandlungsnotizen, Bedingungen..."
          className="form-input resize-none text-sm"
        />
      </div>

      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? <LoadingSpinner size="sm" /> : '✓ Deal speichern'}
      </button>
    </form>
  )
}

function ResultRow({
  label,
  value,
  highlight = false,
  positive = true,
}: {
  label: string
  value: string
  highlight?: boolean
  positive?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn('text-sm', highlight ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
        {label}
      </span>
      <span className={cn(
        'font-semibold',
        highlight
          ? positive ? 'text-[#5CB800] text-base' : 'text-destructive text-base'
          : 'text-sm text-foreground'
      )}>
        {value}
      </span>
    </div>
  )
}
