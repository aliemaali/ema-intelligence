// src/components/capex/CapexCalculator.tsx
'use client'

import { useMemo, useState, useTransition } from 'react'
import { calcAll } from '@/lib/capex/calculations'
import { defaultCapexProject, type CapexProject, type ProjectOption } from '@/lib/types/capex.types'
import { saveCapexCalculation, deleteCapexCalculation } from '@/lib/actions/capex.actions'
import { CapexForm } from './CapexForm'
import { CapexList } from './CapexList'
import { CapexExportPanel } from './CapexExportPanel'

type View = 'form' | 'list' | 'export'

interface CapexCalculatorProps {
  projectOption: ProjectOption
  initialCalculations: CapexProject[]
}

export function CapexCalculator({ projectOption, initialCalculations }: CapexCalculatorProps) {
  const [calculations, setCalculations] = useState<CapexProject[]>(initialCalculations)
  const [project, setProject] = useState<CapexProject>(() =>
    initialCalculations[0] ?? defaultCapexProject(projectOption)
  )
  const [view, setView] = useState<View>('form')
  const [toast, setToast] = useState('')
  const [isPending, startTransition] = useTransition()

  const calc = useMemo(() => calcAll(project), [project])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  function set<K extends keyof CapexProject>(key: K, value: CapexProject[K]) {
    setProject((p) => ({ ...p, [key]: value }))
  }

  function handleSave() {
    startTransition(async () => {
      const { data, error } = await saveCapexCalculation(project)
      if (error || !data) {
        showToast('Speichern fehlgeschlagen' + (error ? `: ${error}` : ''))
        return
      }
      setProject(data)
      setCalculations((prev) => [data, ...prev.filter((c) => c.id !== data.id)])
      showToast('Kalkulation dauerhaft gespeichert')
    })
  }

  function handleNew() {
    setProject(defaultCapexProject(projectOption))
    setView('form')
  }

  function handleOpen(p: CapexProject) {
    setProject(p)
    setView('form')
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const { error } = await deleteCapexCalculation(id, projectOption.id)
      if (error) {
        showToast(`Löschen fehlgeschlagen: ${error}`)
        return
      }
      const remaining = calculations.filter((c) => c.id !== id)
      setCalculations(remaining)
      if (project.id === id) {
        setProject(remaining[0] ?? defaultCapexProject(projectOption))
      }
      showToast('Kalkulation gelöscht')
    })
  }

  return (
    <div className="mx-auto w-full max-w-5xl rounded-[2rem] bg-[#fafafa] px-3.5 pb-20 pt-0 md:px-6">
      <div className="mb-3 rounded-[1.65rem] bg-[#1F2A44] px-5 py-6 text-white shadow-sm">
        <div className="text-xl font-extrabold md:text-2xl">EMA CAPEX Rechner</div>
        <div className="mt-1 text-sm opacity-[0.85]">Projekt: {projectOption.name}</div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2">
        {(
          [
            { key: 'form', label: 'Eingabe' },
            { key: 'list', label: `Kalkulationen (${calculations.length})` },
            { key: 'export', label: 'Export' },
          ] as { key: View; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setView(t.key)}
            className={`min-h-14 rounded-2xl px-2 py-3 text-xs font-extrabold transition-colors md:text-sm ${
              view === t.key ? 'bg-[#5CB800] text-white' : 'bg-slate-200 text-slate-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {view === 'form' && (
        <CapexForm
          project={project}
          calc={calc}
          onChange={set}
          onSave={handleSave}
          onNew={handleNew}
          saving={isPending}
        />
      )}

      {view === 'list' && (
        <CapexList calculations={calculations} onOpen={handleOpen} onDelete={handleDelete} />
      )}

      {view === 'export' && <CapexExportPanel project={project} calc={calc} />}

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#1F2A44] px-[18px] py-2.5 text-[13px] font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
