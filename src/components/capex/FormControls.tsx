// src/components/capex/FormControls.tsx
'use client'

import type { ReactNode } from 'react'

export function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 mb-2.5 rounded-md bg-[#1F2A44] px-3.5 py-2.5 text-sm font-bold tracking-wide text-white">
      {children}
    </div>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-[13px] font-semibold text-slate-700">{label}</label>
      {children}
      {hint && <div className="mt-0.5 text-[11px] text-slate-400">{hint}</div>}
    </div>
  )
}

export function NumInput({
  value,
  onChange,
  step = 'any',
  suffix,
}: {
  value: number | ''
  onChange: (v: number | '') => void
  step?: string
  suffix?: string
}) {
  return (
    <div className="relative">
      <input
        type="number"
        inputMode="decimal"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        className="w-full rounded-lg border border-slate-300 bg-[#fffdf0] px-3 py-2.5 text-[15px]"
        style={{ paddingRight: suffix ? 50 : 12 }}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
          {suffix}
        </span>
      )}
    </div>
  )
}

export function TextInput({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-slate-300 bg-[#fffdf0] px-3 py-2.5 text-[15px]"
    />
  )
}

export function SelectInput({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: readonly string[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-slate-300 bg-[#fffdf0] px-3 py-2.5 text-[15px]"
    >
      {options.map((h) => (
        <option key={h} value={h}>
          {h}
        </option>
      ))}
    </select>
  )
}

export function KpiCard({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: string
}) {
  return (
    <div className="min-w-0 flex-1 rounded-xl bg-[#EAF7E0] px-2.5 py-3 text-center">
      <div className="mb-1 text-[10.5px] leading-tight text-[#5a6b58]">{label}</div>
      <div
        className="text-[17px] font-extrabold leading-tight"
        style={{ color: accent || '#1F2A44' }}
      >
        {value}
      </div>
    </div>
  )
}

export function InfoLine({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[12.5px] text-slate-700">
      {children}
    </div>
  )
}
