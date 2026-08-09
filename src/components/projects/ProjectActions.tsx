'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { archiveProject } from '@/lib/actions/project-archive.actions'
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
      const result = await archiveProject(projectId)
      if (result?.error) {
        toast.error(result.error)
      } else {
        setConfirmOpen(false)
        toast.success('Projekt ins Archiv verschoben')
        router.push('/projects')
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
        title="Projekt ins Archiv verschieben?"
        description={`„${projectName}" wird aus den aktiven Projekten entfernt. Alle Projektdaten und Dokumente bleiben erhalten und können im Archiv wiederhergestellt werden.`}
        confirmLabel="Ins Archiv"
        danger
        loading={pending}
      />
    </>
  )
}
