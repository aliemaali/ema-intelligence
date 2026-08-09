'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { permanentlyDeleteProject } from '@/lib/actions/project-archive.actions'
import { ConfirmDialog } from '@/components/ui'
import { toast } from 'sonner'

interface ProjectActionsProps {
  projectId: string
  projectName: string
}

export function ProjectActions({ projectId, projectName }: ProjectActionsProps) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const handleDelete = () => {
    startTransition(async () => {
      const result = await permanentlyDeleteProject(projectId)
      if (result?.error) {
        toast.error(result.error)
      } else {
        setConfirmOpen(false)
        toast.success('Projekt endgültig gelöscht')
        router.refresh()
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="btn-secondary btn-sm gap-1.5 text-red-700 hover:border-red-200 hover:bg-red-50"
        aria-label="Projekt löschen"
      >
        <Trash2 className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Löschen</span>
      </button>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Projekt endgültig löschen?"
        description={`„${projectName}" und alle zugehörigen Projektdaten werden sofort und unwiderruflich gelöscht. Dieser Vorgang kann nicht rückgängig gemacht werden.`}
        confirmLabel="Endgültig löschen"
        danger
        loading={pending}
      />
    </>
  )
}
