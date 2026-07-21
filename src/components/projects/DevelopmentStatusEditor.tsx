'use client'

import { useOptimistic, useState, useTransition } from 'react'
import { Check, Circle, X } from 'lucide-react'
import { updateProjectDevelopmentStatus } from '@/lib/actions/project-development.actions'

type DevelopmentValue = boolean | null

type DevelopmentItem = {
  key: string
  label: string
  value: DevelopmentValue
}

function nextValue(value: DevelopmentValue): DevelopmentValue {
  if (value === null) return true
  if (value === true) return false
  return null
}

function statusLabel(value: DevelopmentValue) {
  if (value === true) return 'Erfüllt'
  if (value === false) return 'Nicht erfüllt'
  return 'Offen'
}

function StatusIcon({ value }: { value: DevelopmentValue }) {
  if (value === true) return <Check className="h-3.5 w-3.5" />
  if (value === false) return <X className="h-3.5 w-3.5" />
  return <Circle className="h-3.5 w-3.5" />
}

export function DevelopmentStatusEditor({
  projectId,
  items,
}: {
  projectId: string
  items: DevelopmentItem[]
}) {
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()
  const [optimisticItems, setOptimisticItems] = useOptimistic(
    items,
    (current, update: { key: string; value: DevelopmentValue }) =>
      current.map((item) => item.key === update.key ? { ...item, value: update.value } : item),
  )

  const done = optimisticItems.filter((item) => item.value === true).length
  const total = optimisticItems.length
  const percent = total ? Math.round((done / total) * 100) : 0

  function change(item: DevelopmentItem) {
    const value = nextValue(item.value)
    setMessage('')
    startTransition(async () => {
      setOptimisticItems({ key: item.key, value })
      const result = await updateProjectDevelopmentStatus(projectId, item.key, value)
      if (result?.error) setMessage(result.error)
    })
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Entwicklungsstand</h2>
        <span className="text-xs font-medium text-muted-foreground">{done}/{total} abgeschlossen</span>
      </div>

      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-[#5CB800] transition-all" style={{ width: `${percent}%` }} />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {optimisticItems.map((item) => {
          const value = item.value
          const tone = value === true
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : value === false
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-slate-200 bg-white text-slate-600'

          return (
            <button
              key={item.key}
              type="button"
              disabled={isPending}
              onClick={() => change(item)}
              className={`flex min-h-12 items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-left transition active:scale-[0.99] disabled:opacity-70 ${tone}`}
              aria-label={`${item.label}: ${statusLabel(value)}. Antippen zum Ändern.`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current/20 bg-white/80">
                  <StatusIcon value={value} />
                </span>
                <span className="truncate text-sm font-semibold">{item.label}</span>
              </span>
              <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-[0.08em]">{statusLabel(value)}</span>
            </button>
          )
        })}
      </div>

      <p className="mt-3 text-xs leading-5 text-muted-foreground">Antippen wechselt zwischen Erfüllt, Nicht erfüllt und Offen.</p>
      {message && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{message}</p>}
    </div>
  )
}
