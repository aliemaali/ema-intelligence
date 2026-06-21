import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, parseISO, isToday, isTomorrow, isPast } from 'date-fns'
import { de } from 'date-fns/locale'
import type { MarginType } from '@/lib/types/database.types'

// ── Class Name Utility ────────────────────────────────────────────────────────

/**
 * Merges Tailwind classes safely. Use everywhere instead of template literals.
 * cn('px-2', condition && 'text-red-500', 'py-4')
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── Currency Formatting ───────────────────────────────────────────────────────

/**
 * Format a number as EUR currency.
 * formatCurrency(1250000) → '€ 1.250.000'
 * formatCurrency(187500, { compact: true }) → '€ 188k'
 */
export function formatCurrency(
  value: number | null | undefined,
  options: { compact?: boolean; showZero?: boolean } = {}
): string {
  if (value === null || value === undefined) return '–'
  if (value === 0 && !options.showZero) return '€ 0'

  if (options.compact) {
    if (Math.abs(value) >= 1_000_000) {
      return `€ ${(value / 1_000_000).toFixed(1)}M`
    }
    if (Math.abs(value) >= 1_000) {
      return `€ ${Math.round(value / 1_000)}k`
    }
  }

  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * Format €/kWp
 * formatPerKwp(100) → '100 €/kWp'
 */
export function formatPerKwp(value: number | null | undefined): string {
  if (value === null || value === undefined) return '–'
  return `${value.toLocaleString('de-DE')} €/kWp`
}

/**
 * Format €/MWh
 */
export function formatPerMwh(value: number | null | undefined): string {
  if (value === null || value === undefined) return '–'
  return `${value.toLocaleString('de-DE')} €/MWh`
}

/**
 * Format percentage
 * formatPercent(15.5) → '15,5%'
 */
export function formatPercent(
  value: number | null | undefined,
  decimals = 1
): string {
  if (value === null || value === undefined) return '–'
  return `${value.toFixed(decimals).replace('.', ',')}%`
}

// ── Power / Energy Formatting ─────────────────────────────────────────────────

/**
 * formatMW(12.5) → '12,5 MWp'
 * formatMW(12.5, 'MW') → '12,5 MW'
 */
export function formatMW(
  value: number | null | undefined,
  unit: 'MWp' | 'MW' | 'MWh' | 'kWp' = 'MWp'
): string {
  if (value === null || value === undefined) return '–'
  return `${value.toLocaleString('de-DE')} ${unit}`
}

// ── Date Formatting ───────────────────────────────────────────────────────────

/**
 * formatDate('2026-06-18') → '18.06.2026'
 */
export function formatDate(
  value: string | null | undefined,
  fmt = 'dd.MM.yyyy'
): string {
  if (!value) return '–'
  try {
    return format(parseISO(value), fmt, { locale: de })
  } catch {
    return '–'
  }
}

/**
 * formatDatetime('2026-06-18T10:23:00Z') → '18.06.2026, 10:23'
 */
export function formatDatetime(value: string | null | undefined): string {
  if (!value) return '–'
  try {
    return format(parseISO(value), 'dd.MM.yyyy, HH:mm', { locale: de })
  } catch {
    return '–'
  }
}

/**
 * Relative time: '2026-06-15T10:00:00Z' → 'vor 3 Tagen'
 */
export function formatRelativeTime(value: string | null | undefined): string {
  if (!value) return '–'
  try {
    return formatDistanceToNow(parseISO(value), { locale: de, addSuffix: true })
  } catch {
    return '–'
  }
}

/**
 * Smart due date label: 'Heute', 'Morgen', or 'dd.MM.yyyy'
 */
export function formatDueDate(value: string | null | undefined): {
  label: string
  isOverdue: boolean
  isToday: boolean
  isTomorrow: boolean
} {
  if (!value) return { label: '–', isOverdue: false, isToday: false, isTomorrow: false }

  try {
    const date = parseISO(value)
    const overdue = isPast(date) && !isToday(date)

    return {
      label: isToday(date)
        ? 'Heute'
        : isTomorrow(date)
        ? 'Morgen'
        : formatDate(value),
      isOverdue:  overdue,
      isToday:    isToday(date),
      isTomorrow: isTomorrow(date),
    }
  } catch {
    return { label: '–', isOverdue: false, isToday: false, isTomorrow: false }
  }
}

// ── Deal Calculator ───────────────────────────────────────────────────────────

export interface DealCalculationInput {
  purchase_price:   number | null
  margin_type:      MarginType
  margin_value:     number | null
  pv_mwp?:          number | null  // For per_kwp calculation
  bess_mwh?:        number | null  // For per_mwh calculation
  expenses_total?:  number         // Sum of all expense amounts
}

export interface DealCalculationResult {
  margin_eur:       number | null
  sales_price:      number | null
  gross_margin:     number | null
  gross_margin_pct: number | null
  net_profit:       number | null
  net_profit_pct:   number | null
}

/**
 * Core deal calculator – pure function, no side effects.
 * Used in DealForm and stored to DB after user confirmation.
 */
export function calculateDeal(
  input: DealCalculationInput
): DealCalculationResult {
  const { purchase_price, margin_type, margin_value, pv_mwp, bess_mwh, expenses_total = 0 } = input

  if (!purchase_price || !margin_value) {
    return {
      margin_eur: null, sales_price: null,
      gross_margin: null, gross_margin_pct: null,
      net_profit: null, net_profit_pct: null,
    }
  }

  let margin_eur: number | null = null

  switch (margin_type) {
    case 'percent':
      margin_eur = purchase_price * (margin_value / 100)
      break

    case 'per_kwp':
      if (pv_mwp) {
        margin_eur = pv_mwp * 1000 * margin_value
      }
      break

    case 'per_mwh':
      if (bess_mwh) {
        margin_eur = bess_mwh * margin_value
      }
      break
  }

  if (margin_eur === null) {
    return {
      margin_eur: null, sales_price: null,
      gross_margin: null, gross_margin_pct: null,
      net_profit: null, net_profit_pct: null,
    }
  }

  const sales_price      = purchase_price + margin_eur
  const gross_margin     = margin_eur
  const gross_margin_pct = (margin_eur / purchase_price) * 100
  const net_profit       = gross_margin - expenses_total
  const net_profit_pct   = (net_profit / purchase_price) * 100

  return {
    margin_eur:       Math.round(margin_eur),
    sales_price:      Math.round(sales_price),
    gross_margin:     Math.round(gross_margin),
    gross_margin_pct: parseFloat(gross_margin_pct.toFixed(4)),
    net_profit:       Math.round(net_profit),
    net_profit_pct:   parseFloat(net_profit_pct.toFixed(4)),
  }
}

/**
 * Sensitivity table: returns net profit at ±10%, ±20% margin
 */
export function calculateSensitivity(
  base: DealCalculationInput,
  steps = [-0.2, -0.1, 0, 0.1, 0.2]
): Array<{ label: string; gross: number | null; net: number | null }> {
  return steps.map((delta) => {
    const adjustedMargin = base.margin_type === 'percent'
      ? (base.margin_value ?? 0) * (1 + delta)
      : (base.margin_value ?? 0) * (1 + delta)

    const result = calculateDeal({ ...base, margin_value: adjustedMargin })

    const pctLabel = delta === 0
      ? 'Base'
      : delta > 0
      ? `+${(delta * 100).toFixed(0)}%`
      : `${(delta * 100).toFixed(0)}%`

    return {
      label: pctLabel,
      gross: result.gross_margin,
      net:   result.net_profit,
    }
  })
}

// ── Number Parsing ────────────────────────────────────────────────────────────

/**
 * Parse German-formatted number string to float.
 * '1.250.000' → 1250000
 * '187.500,50' → 187500.50
 */
export function parseGermanNumber(value: string): number {
  return parseFloat(value.replace(/\./g, '').replace(',', '.'))
}

// ── File Size ─────────────────────────────────────────────────────────────────

/**
 * formatFileSize(1048576) → '1,0 MB'
 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return '–'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

// ── Investor Match Score ──────────────────────────────────────────────────────

/**
 * Simple rule-based investor matching score (0–100).
 * Will be replaced by AI in v1.1.
 */
export function calculateMatchScore(
  investorSizePrefs: string[],
  investorInterests: { pv: boolean; bess: boolean; hybrid: boolean; wind: boolean },
  projectType: string,
  projectMwp: number | null,
  projectMwh: number | null
): number {
  let score = 0
  const projectMw = projectMwp ?? projectMwh ?? 0

  // Type match (50 points)
  const typeMap: Record<string, keyof typeof investorInterests> = {
    pv_freiflaeche: 'pv',
    pv_dach:        'pv',
    bess:           'bess',
    hybrid:         'hybrid',
    wind:           'wind',
  }
  const interestKey = typeMap[projectType]
  if (interestKey && investorInterests[interestKey]) {
    score += 50
  }

  // Size match (50 points)
  if (investorSizePrefs.length > 0) {
    const sizeMatch =
      (investorSizePrefs.includes('size_1_10mw')   && projectMw >= 1   && projectMw < 10)  ||
      (investorSizePrefs.includes('size_10_50mw')  && projectMw >= 10  && projectMw < 50)  ||
      (investorSizePrefs.includes('size_50_250mw') && projectMw >= 50  && projectMw < 250) ||
      (investorSizePrefs.includes('size_250plus')  && projectMw >= 250)

    if (sizeMatch) score += 50
  } else {
    score += 25  // No preference = partial match
  }

  return Math.min(100, score)
}

// ── Truncate ──────────────────────────────────────────────────────────────────

export function truncate(str: string | null | undefined, maxLength: number): string {
  if (!str) return ''
  return str.length <= maxLength ? str : `${str.slice(0, maxLength)}…`
}

// ── Initials ──────────────────────────────────────────────────────────────────

export function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
