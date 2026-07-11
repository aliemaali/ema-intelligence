// src/components/capex/CapexProjectPicker.tsx
'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronRight, Trash2 } from 'lucide-react'
import type { ProjectOption } from '@/lib/types/capex.types'
import { hideProjectFromCapex } from '@/lib/actions/capex.actions'

interface CapexProjectPickerProps {
  projects: ProjectOption[]
}

function SwipeProjectRow({ project, onRemoved }: { project: ProjectOption; onRemoved: (id: string) => void }) {
  const router = useRouter()
  const startX = useRef<number | null>(null)
  const [offset, setOffset] = useState(0)
  const [removing, setRemoving] = useState(false)

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    startX.current = event.clientX
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (startX.current === null) return
    const delta = event.clientX - startX.current
    setOffset(Math.max(-104, Math.min(0, delta)))
  }

  function onPointerUp() {
    setOffset(offset < -52 ? -96 : 0)
    startX.current = null
  }

  async function removeProject() {
    if (!window.confirm(`„${project.name}“ nur aus dem CAPEX-Rechner entfernen? Das eigentliche Projekt bleibt bestehen.`)) {
      setOffset(0)
      return
    }
    setRemoving(true)
    const result = await hideProjectFromCapex(project.id)
    if (result.error) {
      alert(result.error)
      setRemoving(false)
      setOffset(0)
      return
    }
    onRemoved(project.id)
  }

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <button
        type="button"
        onClick={removeProject}
        disabled={removing}
        className="absolute inset-y-0 right-0 flex w-24 items-center justify-center gap-1 bg-red-500 text-xs font-extrabold text-white disabled:opacity-60"
        aria-label={`${project.name} aus CAPEX entfernen`}
      >
        <Trash2 className="h-5 w-5" />
        Löschen
      </button>

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ transform: `translateX(${offset}px)` }}
        className="relative touch-pan-y transition-transform duration-200"
      >
        <button
          type="button"
          onClick={() => offset === 0 && router.push(`/capex/${project.id}`)}
          className="flex min-h-20 w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 text-left text-base font-extrabold text-slate-700 shadow-sm transition hover:border-[#5CB800] hover:bg-[#F4FAEE]"
        >
          <span>{project.name}</span>
          <ChevronRight className="h-6 w-6 text-slate-300" />
        </button>
      </div>
    </div>
  )
}

export function CapexProjectPicker({ projects }: CapexProjectPickerProps) {
  const router = useRouter()
  const [visibleProjects, setVisibleProjects] = useState(projects)

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f5f9f2] via-[#f7f9fc] to-white px-4 pb-28 pt-[max(6rem,calc(env(safe-area-inset-top)+4.5rem))]">
      <div className="mx-auto w-full max-w-3xl">
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="mb-5 inline-flex min-h-12 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-[#07142F] shadow-sm"
        >
          <ArrowLeft className="h-5 w-5" /> Dashboard
        </button>

        <section className="mb-6 rounded-[2rem] bg-[#1F2A44] px-6 py-7 text-white shadow-lg">
          <h1 className="text-3xl font-extrabold tracking-tight">CAPEX Rechner</h1>
          <p className="mt-3 max-w-xl text-base leading-7 text-slate-200">
            Wähle das Projekt, für das du eine CAPEX-Kalkulation erstellen möchtest.
          </p>
        </section>

        {visibleProjects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm font-semibold text-slate-400">
            Keine Projekte gefunden. Bitte zuerst ein Projekt unter „Projekte“ anlegen.
          </div>
        ) : (
          <div className="space-y-3">
            {visibleProjects.map((project) => (
              <SwipeProjectRow
                key={project.id}
                project={project}
                onRemoved={(id) => setVisibleProjects((current) => current.filter((item) => item.id !== id))}
              />
            ))}
          </div>
        )}

        <p className="mt-5 text-center text-xs font-semibold text-slate-400">
          Zum Entfernen ein Projekt nach links wischen.
        </p>
      </div>
    </main>
  )
}
