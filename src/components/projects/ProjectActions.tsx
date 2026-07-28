'use client'

import { useState, useTransition } from 'react'
import { Archive } from 'lucide-react'
import { archiveProject } from '@/lib/actions/project.actions'
import { ConfirmDialog } from '@/components/ui'
import { toast } from 'sonner'

interface ProjectActionsProps {
  projectId: string
  projectName: string
}

export function ProjectActions({ projectId, projectName }: ProjectActionsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const handleArchive = () => {
    startTransition(async () => {
      try {
        await archiveProject(projectId)
        toast.success('Projekt archiviert')
      } catch (err) {
        const error = err as Error
        if (!error.message?.includes('NEXT_REDIRECT')) {
          toast.error('Fehler beim Archivieren')
        }
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="btn-secondary btn-sm gap-1.5"
        aria-label="Projekt archivieren"
      >
        <Archive className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Archivieren</span>
      </button>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleArchive}
        title="Projekt archivieren?"
        description={`„${projectName}" wird archiviert und nicht mehr in der Liste angezeigt. Die Daten bleiben erhalten.`}
        confirmLabel="Archivieren"
        danger
        loading={pending}
      />
    </>
  )
}
