'use client'

import { useState, useTransition } from 'react'
import { Download, Trash2, FileText } from 'lucide-react'
import { archiveDocument, getDocumentUrl } from '@/lib/actions/document.actions'
import { ConfirmDialog } from '@/components/ui'
import { DOCUMENT_TYPE_LABELS } from '@/lib/types/constants'
import { formatDate, formatFileSize, cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Document, DocumentType } from '@/lib/types/database.types'

interface DocumentListProps {
  documents: Document[]
  projectId: string
}

export function DocumentList({ documents, projectId }: DocumentListProps) {
  // Group by document type
  const grouped = documents.reduce((acc, doc) => {
    const key = doc.document_type
    if (!acc[key]) acc[key] = []
    acc[key].push(doc)
    return acc
  }, {} as Record<string, Document[]>)

  return (
    <div className="divide-y divide-border">
      {Object.entries(grouped).map(([type, docs]) => (
        <div key={type}>
          <div className="px-4 py-2 bg-muted/30">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {DOCUMENT_TYPE_LABELS[type as DocumentType] ?? type}
            </span>
          </div>
          {docs.map((doc) => (
            <DocumentRow key={doc.id} doc={doc} projectId={projectId} />
          ))}
        </div>
      ))}
    </div>
  )
}

function DocumentRow({ doc, projectId }: { doc: Document; projectId: string }) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, startTransition]    = useTransition()

  const handleDownload = async () => {
    if (doc.external_url) {
      window.open(doc.external_url, '_blank')
      return
    }
    const result = await getDocumentUrl(doc.file_path)
    if (result.url) {
      window.open(result.url, '_blank')
    } else {
      toast.error('Download-Link konnte nicht erstellt werden')
    }
  }

  const handleDelete = () => {
    startTransition(async () => {
      const result = await archiveDocument(doc.id, projectId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Dokument entfernt')
        setConfirmOpen(false)
      }
    })
  }

  const ext = doc.file_name.split('.').pop()?.toUpperCase() ?? ''

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
        {/* File icon */}
        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-muted-foreground">{ext}</span>
        </div>

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {doc.display_name}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDate(doc.created_at)}
            {doc.file_size_bytes && ` · ${formatFileSize(doc.file_size_bytes)}`}
            {doc.version > 1 && ` · v${doc.version}`}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleDownload}
            className="btn-icon text-muted-foreground hover:text-[#5CB800]"
            title="Herunterladen"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => setConfirmOpen(true)}
            className="btn-icon text-muted-foreground hover:text-destructive"
            title="Entfernen"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Dokument entfernen?"
        description={`„${doc.display_name}" wird aus der Projektansicht entfernt.`}
        confirmLabel="Entfernen"
        danger
        loading={pending}
      />
    </>
  )
}
