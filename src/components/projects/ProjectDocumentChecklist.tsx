'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, CircleAlert, MinusCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type ChecklistStatus = 'vorhanden' | 'fehlt' | 'nicht_erforderlich'

interface ChecklistItem {
  type: string
  label: string
  status: ChecklistStatus | null
  autoDetected: boolean
}

interface Props {
  projectId: string
  userId: string
  items: ChecklistItem[]
}

const STATUS_OPTIONS: Array<{ value: ChecklistStatus; label: string }> = [
  { value: 'vorhanden', label: 'Vorhanden' },
  { value: 'fehlt', label: 'Fehlt' },
  { value: 'nicht_erforderlich', label: 'Nicht erforderlich' },
]

export function ProjectDocumentChecklist({ projectId, userId, items }: Props) {
  const supabase = createClient()
  const [statuses, setStatuses] = useState<Record<string, ChecklistStatus | null>>(
    Object.fromEntries(items.map((item) => [item.type, item.status])),
  )
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const availableCount = useMemo(
    () => items.filter((item) => (statuses[item.type] ?? (item.autoDetected ? 'vorhanden' : null)) === 'vorhanden').length,
    [items, statuses],
  )
  const requiredCount = useMemo(
    () => items.filter((item) => statuses[item.type] !== 'nicht_erforderlich').length,
    [items, statuses],
  )

  async function setStatus(type: string, status: ChecklistStatus) {
    setSaving(type)
    setError(null)

    const { error: saveError } = await supabase
      .from('project_document_checklists')
      .upsert({
        user_id: userId,
        project_id: projectId,
        document_type: type,
        status,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'project_id,document_type' })

    if (saveError) {
      setError(saveError.message)
      setSaving(null)
      return
    }

    setStatuses((current) => ({ ...current, [type]: status }))
    setSaving(null)
  }

  return (
    <section className="card-padded">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-foreground">Kernunterlagen prüfen</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Manuell bestätigte Angaben haben in der Analyse Vorrang vor der automatischen Erkennung.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-[#5CB800]/10 px-3 py-1 text-xs font-bold text-[#4A9200]">
          {availableCount} von {requiredCount} vorhanden
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {items.map((item) => {
          const explicitStatus = statuses[item.type]
          const effectiveStatus = explicitStatus ?? (item.autoDetected ? 'vorhanden' : 'fehlt')
          const Icon = effectiveStatus === 'vorhanden'
            ? CheckCircle2
            : effectiveStatus === 'nicht_erforderlich'
              ? MinusCircle
              : CircleAlert

          return (
            <div key={item.type} className="rounded-xl border border-border p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Icon className={`h-5 w-5 shrink-0 ${effectiveStatus === 'vorhanden' ? 'text-[#5CB800]' : effectiveStatus === 'nicht_erforderlich' ? 'text-slate-400' : 'text-amber-500'}`} />
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{item.label}</p>
                    {explicitStatus === null && item.autoDetected && (
                      <p className="text-xs text-muted-foreground">Automatisch anhand der Datei erkannt</p>
                    )}
                  </div>
                </div>

                <select
                  className="form-input !w-auto min-w-[148px] text-sm"
                  value={explicitStatus ?? effectiveStatus}
                  disabled={saving === item.type}
                  onChange={(event) => setStatus(item.type, event.target.value as ChecklistStatus)}
                  aria-label={`${item.label} Status`}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )
        })}
      </div>

      {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </section>
  )
}
