'use client'

import { useState } from 'react'
import { ClipboardCheck, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getProjectAuditData } from '@/lib/actions/project-audit.actions'
import { generateProjectAuditPdf } from '@/lib/pdf/projectAuditPdf'

interface ProjectAuditPdfButtonProps {
  projectIds: string[]
}

export function ProjectAuditPdfButton({ projectIds }: ProjectAuditPdfButtonProps) {
  const [busy, setBusy] = useState(false)

  async function createPdf() {
    if (!projectIds.length) return toast.error('Keine Projekte für die Prüfung vorhanden.')
    setBusy(true)
    try {
      const result = await getProjectAuditData(projectIds)
      if (!result.success) throw new Error(result.error || 'Projektdaten konnten nicht geladen werden.')
      if (!result.data.length) throw new Error('Keine Projektdaten gefunden.')
      generateProjectAuditPdf(result.data)
      toast.success(`${result.data.length} Projekte wurden geprüft.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Die Prüf-PDF konnte nicht erstellt werden.')
    } finally {
      setBusy(false)
    }
  }

  return <button type="button" onClick={createPdf} disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-[#07142F] shadow-sm disabled:cursor-wait disabled:opacity-60">
    {busy ? <Loader2 className="h-4 w-4 animate-spin text-[#5CB800]" /> : <ClipboardCheck className="h-4 w-4 text-[#5CB800]" />}
    {busy ? 'Projekte werden geprüft …' : 'Projektprüfung als PDF'}
  </button>
}
