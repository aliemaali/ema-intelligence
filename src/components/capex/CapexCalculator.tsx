// src/components/capex/CapexCalculator.tsx
'use client'

import { useMemo, useState, useTransition } from 'react'
import { calcAll } from '@/lib/capex/calculations'
import { defaultCapexProject, type CapexProject, type ProjectOption } from '@/lib/types/capex.types'
import { saveCapexCalculation, deleteCapexCalculation } from '@/lib/actions/capex.actions'
import { CapexForm } from './CapexForm'
import { CapexList } from './CapexList'
import { CapexExpose } from './CapexExpose'
import { CapexExportPanel } from './CapexExportPanel'

type View = 'form' | 'list' | 'expose' | 'export'

interface CapexCalculatorProps {
  projectOption: ProjectOption
  initialCalculations: CapexProject[]
}

export function CapexCalculator({ projectOption, initialCalculations }: CapexCalculatorProps) {
  const [calculations, setCalculations] = useState<CapexProject[]>(initialCalculations)
  const [project, setProject] = useState<CapexProject>(() => {
    const base = defaultCapexProject(projectOption)
    return { ...base, projektname: projectOption.name }
  })
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
      showToast('Kalkulation gespeichert')
    })
  }

  function handleNew() {
    const base = defaultCapexProject(projectOption)
    setProject({ ...base, projektname: projectOption.name })
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
      setCalculations((prev) => prev.filter((c) => c.id !== id))
      showToast('Kalkulation gelöscht')
    })
  }

  if (view === 'expose') {
    return <CapexExpose project={project} calc={calc} onBack={() => setView('form')} />
  }

  return (
    <div className="mx-auto min-h-screen max-w-[480px] bg-[#fafafa] px-3.5 pb-20 pt-3.5">
      {/* Header */}
      <div className="mb-1 rounded-xl bg-[#1F2A44] px-4 py-4 text-white">
        <div className="text-lg font-extrabold">EMA CAPEX Rechner</div>
        <div className="mt-0.5 text-xs opacity-[0.85]">Projekt: {projectOption.name}</div>
      </div>

      {/* Tab bar */}
      <div className="mb-1 mt-2.5 flex gap-1.5">
        {(
          [
            { key: 'form', label: 'Eingabe' },
            { key: 'list', label: `Kalkulationen (${calculations.length})` },
            { key: 'expose', label: 'Exposé' },
            { key: 'export', label: 'Export' },
          ] as { key: View; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setView(t.key)}
            className={`flex-1 rounded-lg px-1 py-2.5 text-[11.5px] font-bold transition-colors ${
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
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-[#1F2A44] px-[18px] py-2.5 text-[13px] font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
