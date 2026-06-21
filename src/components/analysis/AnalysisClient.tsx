'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Sparkles, CheckCircle2, RefreshCw } from 'lucide-react'
import { generateAndSaveAnalysis, approveAnalysis } from '@/lib/actions/analysis.actions'
import { AnalysisPreview } from './AnalysisPreview'
import { LoadingSpinner, EmptyState } from '@/components/ui'
import { formatDatetime, cn } from '@/lib/utils'
import type { GeneratedAnalysis } from '@/lib/types/analysis.types'

interface AnalysisClientProps {
  projectId: string
  initialAnalysis: {
    id:        string
    analysis:  GeneratedAnalysis
    status:    string
    createdAt: string
  } | null
}

export function AnalysisClient({ projectId, initialAnalysis }: AnalysisClientProps) {
  const [analysis, setAnalysis] = useState(initialAnalysis)
  const [pending, startTransition] = useTransition()

  const handleGenerate = () => {
    startTransition(async () => {
      const result = await generateAndSaveAnalysis(projectId)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success('Analyse wurde erstellt (Entwurf)')
      window.location.reload()
    })
  }

  const handleApprove = () => {
    if (!analysis) return
    startTransition(async () => {
      const result = await approveAnalysis(analysis.id, projectId)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success('Analyse freigegeben')
      setAnalysis({ ...analysis, status: 'approved' })
    })
  }

  return (
    <div className="space-y-4">

      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">KI-Projektanalyse</h2>
          {analysis && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Erstellt am {formatDatetime(analysis.createdAt)} ·{' '}
              <StatusLabel status={analysis.status} />
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {analysis && analysis.status === 'draft' && (
            <button
              onClick={handleApprove}
              disabled={pending}
              className="btn-secondary btn-sm gap-1.5 text-emerald-600 hover:bg-emerald-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Freigeben</span>
            </button>
          )}

          <button
            onClick={handleGenerate}
            disabled={pending}
            className="btn-primary btn-sm gap-1.5"
          >
            {pending ? (
              <LoadingSpinner size="sm" />
            ) : analysis ? (
              <RefreshCw className="w-3.5 h-3.5" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>{analysis ? 'Neu analysieren' : 'Analyse erstellen'}</span>
          </button>
        </div>
      </div>

      {/* ── Freigabe-Hinweis ──────────────────────────────────────────────── */}
      {analysis && analysis.status === 'draft' && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-2">
          <span className="text-amber-600 shrink-0 mt-0.5">⚠️</span>
          <p className="text-sm text-amber-800">
            Diese Analyse ist ein <strong>Entwurf</strong> und basiert ausschließlich auf
            regelbasierter Auswertung der vorhandenen Projektdaten. Bitte prüfen, bevor
            sie als Entscheidungsgrundlage verwendet wird.
          </p>
        </div>
      )}

      {analysis && analysis.status === 'approved' && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <p className="text-sm text-emerald-800">
            Diese Analyse wurde manuell geprüft und freigegeben.
          </p>
        </div>
      )}

      {/* ── Inhalt ───────────────────────────────────────────────────────── */}
      {analysis ? (
        <AnalysisPreview analysis={analysis.analysis} />
      ) : (
        <EmptyState
          icon="🔍"
          title="Noch keine Analyse erstellt"
          description="Analysiere Entwicklungsstand, fehlende Unterlagen, Risiken und Investoren-Eignung auf Basis der vorhandenen Projektdaten."
          action={
            <button
              onClick={handleGenerate}
              disabled={pending}
              className="btn-primary mt-2 gap-1.5"
            >
              {pending ? <LoadingSpinner size="sm" /> : <Sparkles className="w-4 h-4" />}
              Analyse erstellen
            </button>
          }
        />
      )}
    </div>
  )
}

function StatusLabel({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    draft:     { label: 'Entwurf',       className: 'text-amber-600' },
    approved:  { label: 'Freigegeben',   className: 'text-emerald-600' },
    rejected:  { label: 'Abgelehnt',     className: 'text-red-600' },
    published: { label: 'Veröffentlicht',className: 'text-blue-600' },
  }
  const c = config[status] ?? { label: status, className: 'text-muted-foreground' }
  return <span className={cn('font-medium', c.className)}>{c.label}</span>
}
