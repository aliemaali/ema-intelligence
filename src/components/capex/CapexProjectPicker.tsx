// src/components/capex/CapexProjectPicker.tsx
'use client'

import { useRouter } from 'next/navigation'
import type { ProjectOption } from '@/lib/types/capex.types'

interface CapexProjectPickerProps {
  projects: ProjectOption[]
}

export function CapexProjectPicker({ projects }: CapexProjectPickerProps) {
  const router = useRouter()

  return (
    <div className="mx-auto max-w-md p-4">
      <div className="mb-4 rounded-xl bg-[#1F2A44] p-4 text-white">
        <div className="text-lg font-extrabold">CAPEX Rechner</div>
        <div className="mt-0.5 text-xs opacity-[0.85]">
          Bitte wähle zunächst das Projekt, für das du eine CAPEX-Kalkulation erstellen möchtest.
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-400">
          Keine Projekte gefunden. Bitte zuerst ein Projekt unter „Projekte" anlegen.
        </div>
      ) : (
        <div className="space-y-2">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => router.push(`/capex/${p.id}`)}
              className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 transition-colors hover:border-[#5CB800] hover:bg-[#EAF7E0]"
            >
              {p.name}
              <span className="text-slate-300">→</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
