'use client'

import type { CapexCalcResult } from '@/lib/types/capex.types'
import { eur, pct } from '@/lib/capex/format'

const COLORS = ['#1F2A44', '#5CB800', '#3B82F6', '#14B8A6', '#F59E0B', '#94A3B8']
const compactEur = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  notation: 'compact',
  maximumFractionDigits: 1,
})

function chartValue(value: number) {
  return compactEur.format(value)
}

function yearValue(value: number) {
  return value.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function EmptyChart({ children }: { children: string }) {
  return (
    <div className="flex min-h-52 items-center justify-center rounded-2xl bg-slate-50 px-6 text-center text-sm text-slate-400">
      {children}
    </div>
  )
}

function ChartCard({
  title,
  subtitle,
  children,
  className = '',
}: {
  title: string
  subtitle: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      <div className="mb-4">
        <h3 className="text-sm font-extrabold text-[#1F2A44]">{title}</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p>
      </div>
      {children}
    </section>
  )
}

function CapexDonut({ calc }: { calc: CapexCalcResult }) {
  const sorted = calc.positions.filter((position) => position.cost > 0).sort((a, b) => b.cost - a.cost)
  const visible = sorted.slice(0, 5).map((position) => ({
    name: position.name,
    cost: position.cost,
    share: position.share,
  }))
  const remainingCost = sorted.slice(5).reduce((sum, position) => sum + position.cost, 0)

  if (remainingCost > 0 && calc.totalCapex > 0) {
    visible.push({
      name: 'Weitere Positionen',
      cost: remainingCost,
      share: remainingCost / calc.totalCapex,
    })
  }

  if (calc.totalCapex <= 0 || visible.length === 0) {
    return <EmptyChart>CAPEX-Positionen eingeben, um die Investitionsverteilung zu sehen.</EmptyChart>
  }

  let cursor = 0
  const gradient = visible
    .map((position, index) => {
      const start = cursor
      cursor += position.share * 100
      return `${COLORS[index]} ${start}% ${cursor}%`
    })
    .join(', ')

  return (
    <div className="grid items-center gap-5 sm:grid-cols-[170px_1fr]">
      <div
        role="img"
        aria-label={`CAPEX-Verteilung mit einem Gesamtvolumen von ${eur(calc.totalCapex)}`}
        className="relative mx-auto h-40 w-40 rounded-full"
        style={{ background: `conic-gradient(${gradient})` }}
      >
        <div className="absolute inset-[22px] flex flex-col items-center justify-center rounded-full bg-white text-center shadow-inner">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Gesamt</span>
          <strong className="mt-1 text-base text-[#1F2A44]">{chartValue(calc.totalCapex)}</strong>
        </div>
      </div>
      <div className="space-y-2.5">
        {visible.map((position, index) => (
          <div key={position.name} className="grid grid-cols-[10px_1fr_auto] items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLORS[index] }} />
            <span className="min-w-0 truncate text-slate-600" title={position.name}>
              {position.name}
            </span>
            <strong className="text-[#1F2A44]">{pct(position.share)}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

function CashflowBars({ calc }: { calc: CapexCalcResult }) {
  const rows = calc.years.slice(1)
  if (rows.length === 0 || rows.every((row) => row.ncf === 0)) {
    return <EmptyChart>Ertrag, Vergütung und Kosten eingeben, um die Cashflows zu berechnen.</EmptyChart>
  }

  const width = 720
  const height = 230
  const left = 58
  const right = 16
  const top = 16
  const bottom = 34
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const values = rows.map((row) => row.ncf)
  const minimum = Math.min(0, ...values)
  const maximum = Math.max(0, ...values)
  const span = Math.max(maximum - minimum, 1)
  const y = (value: number) => top + ((maximum - value) / span) * plotHeight
  const baseline = y(0)
  const slot = plotWidth / rows.length
  const barWidth = Math.max(4, slot * 0.58)

  return (
    <div className="overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Jährliche freie Cashflows über 20 Betriebsjahre"
        className="h-auto w-full"
      >
        {[0, 0.5, 1].map((ratio) => {
          const value = maximum - span * ratio
          const gridY = y(value)
          return (
            <g key={ratio}>
              <line x1={left} x2={width - right} y1={gridY} y2={gridY} stroke="#E2E8F0" strokeWidth="1" />
              <text x={left - 8} y={gridY + 4} textAnchor="end" fontSize="10" fill="#94A3B8">
                {chartValue(value)}
              </text>
            </g>
          )
        })}
        <line x1={left} x2={width - right} y1={baseline} y2={baseline} stroke="#1F2A44" strokeWidth="1.2" />
        {rows.map((row, index) => {
          const barX = left + index * slot + (slot - barWidth) / 2
          const valueY = y(row.ncf)
          const barY = row.ncf >= 0 ? valueY : baseline
          const barHeight = Math.max(1, Math.abs(baseline - valueY))
          return (
            <g key={row.year}>
              <rect
                x={barX}
                y={barY}
                width={barWidth}
                height={barHeight}
                rx="2"
                fill={row.ncf >= 0 ? '#5CB800' : '#DC2626'}
              >
                <title>{`Jahr ${row.year}: ${eur(row.ncf)}`}</title>
              </rect>
              {(row.year === 1 || row.year % 5 === 0) && (
                <text x={barX + barWidth / 2} y={height - 12} textAnchor="middle" fontSize="10" fill="#64748B">
                  J{row.year}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#5CB800]" />Positiver Cashflow</span>
        <span>Jahr 1: <strong className="text-[#1F2A44]">{eur(calc.ncfY1)}</strong></span>
        <span>Jahr 20: <strong className="text-[#1F2A44]">{eur(rows.at(-1)?.ncf ?? 0)}</strong></span>
      </div>
    </div>
  )
}

function CumulativeLine({ calc }: { calc: CapexCalcResult }) {
  const rows = calc.years
  if (rows.length <= 1 || calc.totalCapex <= 0) {
    return <EmptyChart>Vollständige Projektdaten eingeben, um den Break-even zu sehen.</EmptyChart>
  }

  const width = 720
  const height = 230
  const left = 58
  const right = 16
  const top = 16
  const bottom = 34
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const values = rows.map((row) => row.cum)
  const minimum = Math.min(0, ...values)
  const maximum = Math.max(0, ...values)
  const span = Math.max(maximum - minimum, 1)
  const x = (year: number) => left + (year / Math.max(rows.length - 1, 1)) * plotWidth
  const y = (value: number) => top + ((maximum - value) / span) * plotHeight
  const points = rows.map((row) => `${x(row.year)},${y(row.cum)}`).join(' ')
  const zeroY = y(0)
  const discountedX = calc.dynPayback === null ? null : x(calc.dynPayback)
  const nominalCrossingIndex = rows.findIndex((row, index) => index > 0 && row.cum >= 0)
  const nominalPayback = nominalCrossingIndex > 0
    ? rows[nominalCrossingIndex - 1].year +
      (-rows[nominalCrossingIndex - 1].cum /
        (rows[nominalCrossingIndex].cum - rows[nominalCrossingIndex - 1].cum))
    : null

  return (
    <div className="overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Kumulierter Cashflow mit ${calc.dynPayback === null ? 'keinem diskontierten Break-even' : `diskontiertem Break-even nach ${yearValue(calc.dynPayback)} Jahren`}`}
        className="h-auto w-full"
      >
        {[0, 0.5, 1].map((ratio) => {
          const value = maximum - span * ratio
          const gridY = y(value)
          return (
            <g key={ratio}>
              <line x1={left} x2={width - right} y1={gridY} y2={gridY} stroke="#E2E8F0" strokeWidth="1" />
              <text x={left - 8} y={gridY + 4} textAnchor="end" fontSize="10" fill="#94A3B8">
                {chartValue(value)}
              </text>
            </g>
          )
        })}
        <line x1={left} x2={width - right} y1={zeroY} y2={zeroY} stroke="#1F2A44" strokeWidth="1.2" />
        <polyline points={points} fill="none" stroke="#5CB800" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {nominalPayback !== null && (
          <circle cx={x(nominalPayback)} cy={zeroY} r="5" fill="#FFFFFF" stroke="#5CB800" strokeWidth="3">
            <title>{`Nominaler Break-even nach ${yearValue(nominalPayback)} Jahren`}</title>
          </circle>
        )}
        {discountedX !== null && (
          <g>
            <line x1={discountedX} x2={discountedX} y1={top} y2={height - bottom} stroke="#3B82F6" strokeWidth="2" strokeDasharray="6 5" />
            <rect x={Math.min(discountedX + 8, width - 162)} y={top + 4} width="146" height="25" rx="8" fill="#1F2A44" />
            <text x={Math.min(discountedX + 81, width - 89)} y={top + 20} textAnchor="middle" fontSize="10" fontWeight="700" fill="white">
              {`Diskontiert: ${calc.dynPayback === null ? '–' : yearValue(calc.dynPayback)} J.`}
            </text>
          </g>
        )}
        {[0, 5, 10, 15, 20].filter((year) => year < rows.length).map((year) => (
          <text key={year} x={x(year)} y={height - 12} textAnchor="middle" fontSize="10" fill="#64748B">
            J{year}
          </text>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 bg-[#5CB800]" />Kumulierter Cashflow nominal</span>
        {nominalPayback !== null && <span>Nominal: <strong className="text-[#1F2A44]">{yearValue(nominalPayback)} J.</strong></span>}
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-0 border-l-2 border-dashed border-blue-500" />Payback diskontiert</span>
      </div>
    </div>
  )
}

export function CapexVisualDashboard({ calc }: { calc: CapexCalcResult }) {
  return (
    <div className="mt-4 grid gap-3 lg:grid-cols-2">
      <ChartCard
        title="Investitionsverteilung"
        subtitle="Die größten CAPEX-Blöcke und ihr Anteil am Gesamtinvestment."
      >
        <CapexDonut calc={calc} />
      </ChartCard>
      <ChartCard
        title="Amortisationsverlauf"
        subtitle="Kumulierter Projekt-Cashflow und diskontierter Break-even bei gewähltem WACC."
      >
        <CumulativeLine calc={calc} />
      </ChartCard>
      <ChartCard
        title="Freier Cashflow pro Jahr"
        subtitle="Erlöse abzüglich steigender Betriebskosten über den 20-jährigen Betrachtungszeitraum."
        className="lg:col-span-2"
      >
        <CashflowBars calc={calc} />
      </ChartCard>
    </div>
  )
}
