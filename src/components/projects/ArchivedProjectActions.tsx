'use client'

import { useState, useTransition } from 'react'
import { RotateCcw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui'
import { permanentlyDeleteProject, restoreProject } from '@/lib/actions/project-archive.actions'

interface ArchivedProjectActionsProps {
  projectId: string
  projectName: string
}

export function ArchivedProjectActions({ projectId, projectName }: ArchivedProjectActionsProps) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const restore = () => startTransition(async () => {
    const result = await restoreProject(projectId)
    if (result?.error) toast.error(result.error)
    else toast.success('Projekt wiederhergestellt')
  })

  const remove = () => startTransition(async () => {
    const result = await permanentlyDeleteProject(projectId)
    if (result?.error) toast.error(result.error)
    else {
      setDeleteOpen(false)
      toast.success('Projekt endgültig gelöscht')
    }
  })

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={restore} disabled={pending} className="btn-secondary justify-center gap-2">
          <RotateCcw className="h-4 w-4" /> Wiederherstellen
        </button>
        <button type="button" onClick={() => setDeleteOpen(true)} disabled={pending} className="btn justify-center gap-2 bg-red-600 text-white hover:bg-red-700">
          <Trash2 className="h-4 w-4" /> Endgültig löschen
        </button>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={remove}
        title="Projekt endgültig löschen?"
        description={`„${projectName}" und die zugehörigen Projektdaten werden unwiderruflich gelöscht. Dieser Vorgang kann nicht rückgängig gemacht werden.`}
        confirmLabel="Endgültig löschen"
        danger
        loading={pending}
      />
    </>
  )
}
