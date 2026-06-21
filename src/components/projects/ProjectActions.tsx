'use client'

import { useState, useTransition } from 'react'
import { MoreVertical, Archive, Trash2 } from 'lucide-react'
import { archiveProject } from '@/lib/actions/project.actions'
import { ConfirmDialog, LoadingSpinner } from '@/components/ui'
import { toast } from 'sonner'

interface ProjectActionsProps {
  projectId:   string
  projectName: string
}

export function ProjectActions({ projectId, projectName }: ProjectActionsProps) {
  const [open,          setOpen]          = useState(false)
  const [confirmOpen,   setConfirmOpen]   = useState(false)
  const [pending,       startTransition]  = useTransition()

  const handleArchive = () => {
    startTransition(async () => {
      try {
        await archiveProject(projectId)
        toast.success('Projekt archiviert')
      } catch (err) {
        const e = err as Error
        if (!e.message?.includes('NEXT_REDIRECT')) {
          toast.error('Fehler beim Archivieren')
        }
      }
    })
  }

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="btn-icon text-muted-foreground hover:text-foreground"
          aria-label="Weitere Aktionen"
        >
          <MoreVertical className="w-5 h-5" />
        </button>

        {open && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

            {/* Dropdown */}
            <div className="absolute right-0 top-10 z-50 w-48 bg-card border border-border rounded-lg shadow-lg py-1 animate-fade-in">
              <button
                onClick={() => { setOpen(false); setConfirmOpen(true) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Archive className="w-4 h-4" />
                Projekt archivieren
              </button>
            </div>
          </>
        )}
      </div>

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
