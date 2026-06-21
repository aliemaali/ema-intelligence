// src/components/capex/CapexList.tsx
'use client'

import type { CapexProject } from '@/lib/types/capex.types'
import { calcAll } from '@/lib/capex/calculations'
import { eur, pct } from '@/lib/capex/format'

interface CapexListProps {
  calculations: CapexProject[]
  onOpen: (p: CapexProject) => void
  onDelete: (id: string) => void
}

export function CapexList({ calculations, onOpen, onDelete }: CapexListProps) {
  if (calculations.length === 0) {
    return (
      <div className="mt-3.5 rounded-lg border border-dashed border-slate-300 px-6 py-10 text-center text-[13px] text-slate-400">
        Noch keine Kalkulationen für dieses Projekt gespeichert.
      </div>
    )
  }

  return (
    <div className="mt-3.5 space-y-2.5">
      {calculations.map((p) => {
        const c = calcAll(p)
        return (
          <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-1 text-sm font-extrabold">{p.calculationName}</div>
            <div className="mb-2 text-xs text-slate-500">
              {Number(p.anlagenleistungKwp).toLocaleString('de-DE')} kWp · {eur(c.totalCapex)} · IRR{' '}
              {pct(c.irr)}
            </div>
            {p.createdAt && (
              <div className="mb-2 text-[11px] text-slate-400">
                Gespeichert: {new Date(p.createdAt).toLocaleString('de-DE')}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => onOpen(p)}
                className="flex-1 rounded-md bg-[#1F2A44] py-2 text-xs font-bold text-white"
              >
                Öffnen
              </button>
              <button
                onClick={() => p.id && onDelete(p.id)}
                className="rounded-md border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-bold text-red-600"
              >
                Löschen
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
