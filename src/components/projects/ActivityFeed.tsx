'use client'

import { useTransition, useRef } from 'react'
import { toast } from 'sonner'
import { addActivityNote } from '@/lib/actions/project.actions'
import { LoadingSpinner } from '@/components/ui'
import { ACTIVITY_TYPE_LABELS, ACTIVITY_TYPE_ICONS } from '@/lib/types/constants'
import { formatDatetime } from '@/lib/utils'
import type { ActivityLog } from '@/lib/types/database.types'

// ── Add Note Form ─────────────────────────────────────────────────────────────

export function AddActivityNote({ projectId }: { projectId: string }) {
  const [pending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      const result = await addActivityNote(projectId, formData)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success('Notiz gespeichert')
        formRef.current?.reset()
      }
    })
  }

  return (
    <form ref={formRef} action={handleSubmit} className="card-padded">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Notiz hinzufügen
      </h3>
      <textarea
        name="note"
        rows={3}
        required
        placeholder="z. B. Rückruf mit Investor geplant, Unterlagen nachgefordert..."
        className="form-input resize-none text-sm mb-3"
      />
      <button type="submit" disabled={pending} className="btn-primary btn-sm">
        {pending ? <LoadingSpinner size="sm" /> : '+ Notiz speichern'}
      </button>
    </form>
  )
}

// ── Activity Feed ─────────────────────────────────────────────────────────────

interface ActivityFeedProps {
  entries: ActivityLog[]
}

export function ActivityFeed({ entries }: ActivityFeedProps) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <p className="text-sm">Noch keine Aktivitäten</p>
        <p className="text-xs mt-1">
          Statusänderungen, Dokumente und Notizen erscheinen hier automatisch.
        </p>
      </div>
    )
  }

  // Group by calendar date
  const grouped: Record<string, ActivityLog[]> = {}
  entries.forEach((entry) => {
    const date = entry.created_at.split('T')[0]
    if (!grouped[date]) grouped[date] = []
    grouped[date].push(entry)
  })

  const formatGroupDate = (dateStr: string): string => {
    const today     = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    if (dateStr === today)     return 'Heute'
    if (dateStr === yesterday) return 'Gestern'
    return new Date(dateStr).toLocaleDateString('de-DE', {
      weekday: 'long', day: 'numeric', month: 'long',
    })
  }

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([date, dayEntries]) => (
        <div key={date}>
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              {formatGroupDate(date)}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="space-y-3">
            {dayEntries.map((entry) => (
              <ActivityItem key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Single Activity Item ──────────────────────────────────────────────────────

function ActivityItem({ entry }: { entry: ActivityLog }) {
  const icon  = ACTIVITY_TYPE_ICONS[entry.activity_type]  ?? '📝'
  const time  = entry.created_at
    ? new Date(entry.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : ''

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm shrink-0">
          {icon}
        </div>
      </div>

      <div className="flex-1 min-w-0 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{entry.title}</p>
            {entry.description && (
              <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
                {entry.description}
              </p>
            )}
            {entry.activity_type === 'status_change' && entry.old_value && entry.new_value && (
              <p className="text-xs text-muted-foreground mt-1">
                <span className="opacity-60">{entry.old_value}</span>
                {' → '}
                <span className="font-medium text-foreground">{entry.new_value}</span>
              </p>
            )}
          </div>
          <span className="text-xs text-muted-foreground shrink-0 mt-0.5">{time}</span>
        </div>
      </div>
    </div>
  )
}
