'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { markProjectOutputGenerated, type ProjectOutputType } from '@/lib/actions/project-output.actions'

interface ProjectDocumentPrintButtonProps {
  projectId: string
  type: ProjectOutputType
}

export function ProjectDocumentPrintButton({ projectId, type }: ProjectDocumentPrintButtonProps) {
  const [busy, setBusy] = useState(false)

  const printDocument = async () => {
    if (busy) return
    setBusy(true)
    try {
      const result = await markProjectOutputGenerated(projectId, type)
      if (result.error) throw new Error(result.error)
      window.print()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Das Dokument konnte nicht vorbereitet werden.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button onClick={printDocument} disabled={busy} className="print:hidden inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#5CB800] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
      <Download className="h-4 w-4" />
      {busy ? 'Wird vorbereitet…' : 'Als PDF speichern'}
    </button>
  )
}
