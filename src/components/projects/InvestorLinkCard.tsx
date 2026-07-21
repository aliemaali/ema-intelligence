'use client'

import { useRef, useState } from 'react'
import { MoreVertical, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { InvestorExposeShareActions } from '@/components/projects/InvestorExposeShareActions'
import type { MemorandumPdfData } from '@/lib/pdf/memorandumPdf'

interface Props {
  linkId: string
  projectId: string
  investor: {
    full_name: string
    company: string | null
    email: string | null
  }
  status: string
  pdfData: MemorandumPdfData
}

const STATUS_OPTIONS = [
  ['verknuepft', 'Verknüpft'],
  ['vorgestellt', 'Vorgestellt'],
  ['rueckmeldung_offen', 'Rückmeldung offen'],
  ['interesse', 'Interesse'],
  ['kein_interesse', 'Kein Interesse'],
  ['reserviert', 'Reserviert'],
  ['abgelehnt', 'Abgelehnt'],
] as const

function normalizeStatus(status: string) {
  if (status === 'kontaktiert') return 'verknuepft'
  return status
}

export function InvestorLinkCard({ linkId, projectId, investor, status, pdfData }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [currentStatus, setCurrentStatus] = useState(normalizeStatus(status))
  const [offset, setOffset] = useState(0)
  const [busy, setBusy] = useState(false)
  const startX = useRef<number | null>(null)

  async function updateStatus(nextStatus: string) {
    setBusy(true)
    const { error } = await supabase.from('project_investors').update({ status: nextStatus, updated_at: new Date().toISOString() }).eq('id', linkId)
    setBusy(false)
    if (error) return window.alert(`Status konnte nicht gespeichert werden: ${error.message}`)
    setCurrentStatus(nextStatus)
    router.refresh()
  }

  async function removeLink() {
    if (!window.confirm(`Zuordnung zu ${investor.full_name} wirklich entfernen? Der Investor selbst bleibt erhalten.`)) return
    setBusy(true)
    const { error } = await supabase.from('project_investors').delete().eq('id', linkId)
    setBusy(false)
    if (error) return window.alert(`Zuordnung konnte nicht entfernt werden: ${error.message}`)
    router.refresh()
  }

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div className="absolute inset-y-0 right-0 flex w-28 items-center justify-center bg-red-600 text-white">
        <button type="button" onClick={removeLink} disabled={busy} className="flex flex-col items-center gap-1 text-xs font-bold">
          <Trash2 className="h-5 w-5" /> Entfernen
        </button>
      </div>

      <div
        className="card-padded relative bg-card transition-transform duration-200"
        style={{ transform: `translateX(${offset}px)` }}
        onTouchStart={(event) => { startX.current = event.touches[0]?.clientX ?? null }}
        onTouchMove={(event) => {
          if (startX.current === null) return
          const delta = (event.touches[0]?.clientX ?? startX.current) - startX.current
          setOffset(Math.max(-112, Math.min(0, delta)))
        }}
        onTouchEnd={() => {
          setOffset((current) => current < -55 ? -112 : 0)
          startX.current = null
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-sm text-foreground">{investor.full_name}</p>
            {investor.company && <p className="text-xs text-muted-foreground">{investor.company}</p>}
            {investor.email && <p className="mt-0.5 text-xs text-muted-foreground">{investor.email}</p>}
          </div>
          <details className="relative">
            <summary className="btn-icon cursor-pointer list-none" aria-label="Weitere Aktionen"><MoreVertical className="h-4 w-4" /></summary>
            <div className="absolute right-0 z-20 mt-2 w-52 rounded-xl border border-border bg-card p-2 shadow-xl">
              <button type="button" onClick={removeLink} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50">
                <Trash2 className="h-4 w-4" /> Zuordnung entfernen
              </button>
            </div>
          </details>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-[150px_1fr] sm:items-center">
          <label className="text-xs font-bold text-muted-foreground">Investorenstatus</label>
          <select className="form-input py-2" value={currentStatus} disabled={busy} onChange={(event) => updateStatus(event.target.value)}>
            {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>

        <InvestorExposeShareActions projectId={projectId} investorEmail={investor.email} data={pdfData} />
        <p className="mt-3 text-[11px] text-muted-foreground sm:hidden">Zum Entfernen nach links wischen.</p>
      </div>
    </div>
  )
}
