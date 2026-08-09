'use client'

import { useState, useTransition } from 'react'
import { BrainCircuit, Download, Loader2, Trash2 } from 'lucide-react'
import { archiveDocument, getDocumentUrl } from '@/lib/actions/document.actions'
import { ConfirmDialog } from '@/components/ui'
import { DOCUMENT_TYPE_LABELS } from '@/lib/types/constants'
import { formatDate, formatFileSize } from '@/lib/utils'
import { clearDocumentViewerMarker, markDocumentViewerOpen } from '@/lib/ema/appIntroNavigation'
import { toast } from 'sonner'
import type { Document, DocumentType } from '@/lib/types/database.types'

interface DocumentListProps {
  documents: Document[]
  projectId: string
  emaKnowledgeEnabled?: boolean
}

function isPdfDocument(document: Document) {
  return document.mime_type === 'application/pdf'
    || document.file_name.toLocaleLowerCase('de-DE').endsWith('.pdf')
}

function openDocumentUrl(url: string) {
  markDocumentViewerOpen()
  const openedWindow = window.open(url, '_blank')
  if (!openedWindow) clearDocumentViewerMarker()
}

function isDocumentIndexed(document: Document) {
  return document.ai_analyzed === true
    && document.ai_extracted_data !== null
    && document.ai_extracted_data !== undefined
}

export function DocumentList({ documents, projectId, emaKnowledgeEnabled = false }: DocumentListProps) {
  const [indexedIds, setIndexedIds] = useState<Set<string>>(
    () => new Set(documents.filter(isDocumentIndexed).map((document) => document.id)),
  )
  const [busyDocumentId, setBusyDocumentId] = useState<string | null>(null)
  const [bulkPending, setBulkPending] = useState(false)

  const pdfDocuments = documents.filter(isPdfDocument)
  const indexedPdfCount = pdfDocuments.filter((document) => indexedIds.has(document.id)).length

  const indexDocument = async (documentId: string, quiet = false) => {
    setBusyDocumentId(documentId)
    try {
      const response = await fetch('/api/ema/documents/index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_id: documentId }),
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok || payload?.indexed !== true) {
        if (!quiet) toast.error(payload?.error ?? 'EMA konnte das Dokument nicht einlesen')
        return false
      }

      setIndexedIds((current) => {
        const next = new Set(current)
        next.add(documentId)
        return next
      })
      if (!quiet) toast.success(payload.cached ? 'EMA kannte dieses Dokument bereits' : 'Dokument ist jetzt für EMA verfügbar')
      return true
    } catch {
      if (!quiet) toast.error('EMA konnte das Dokument nicht einlesen')
      return false
    } finally {
      setBusyDocumentId(null)
    }
  }

  const handleIndexAll = async () => {
    const pendingDocuments = pdfDocuments.filter((document) => !indexedIds.has(document.id))
    if (pendingDocuments.length === 0) {
      toast.success('EMA kennt bereits alle PDFs in diesem Projekt')
      return
    }

    setBulkPending(true)
    let succeeded = 0
    let failed = 0

    try {
      for (const document of pendingDocuments) {
        if (await indexDocument(document.id, true)) succeeded += 1
        else failed += 1
      }

      if (failed === 0) toast.success(`${succeeded} PDF${succeeded === 1 ? '' : 's'} für EMA eingelesen`)
      else toast.error(`${succeeded} eingelesen · ${failed} fehlgeschlagen`)
    } finally {
      setBulkPending(false)
    }
  }

  // Group by document type
  const grouped = documents.reduce((acc, doc) => {
    const key = doc.document_type
    if (!acc[key]) acc[key] = []
    acc[key].push(doc)
    return acc
  }, {} as Record<string, Document[]>)

  return (
    <div className="divide-y divide-border">
      {emaKnowledgeEnabled && pdfDocuments.length > 0 ? (
        <div className="flex items-center justify-between gap-3 bg-[#F6FAF2] px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <BrainCircuit className="h-4 w-4 shrink-0 text-[#5CB800]" />
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-[#1F2A44]">EMA-Wissen</p>
              <p className="text-[11px] text-slate-500">
                {indexedPdfCount} von {pdfDocuments.length} PDFs eingelesen
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleIndexAll}
            disabled={bulkPending || indexedPdfCount === pdfDocuments.length}
            className="shrink-0 rounded-full bg-[#5CB800] px-3 py-2 text-xs font-extrabold text-white transition-opacity disabled:cursor-default disabled:opacity-45"
          >
            {bulkPending ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Einlesen …
              </span>
            ) : indexedPdfCount === pdfDocuments.length ? 'EMA bereit' : 'Alle einlesen'}
          </button>
        </div>
      ) : null}

      {Object.entries(grouped).map(([type, docs]) => (
        <div key={type}>
          <div className="px-4 py-2 bg-muted/30">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {DOCUMENT_TYPE_LABELS[type as DocumentType] ?? type}
            </span>
          </div>
          {docs.map((doc) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              projectId={projectId}
              emaKnowledgeEnabled={emaKnowledgeEnabled}
              indexed={indexedIds.has(doc.id)}
              indexing={busyDocumentId === doc.id}
              bulkPending={bulkPending}
              onIndex={indexDocument}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

function DocumentRow({
  doc,
  projectId,
  emaKnowledgeEnabled,
  indexed,
  indexing,
  bulkPending,
  onIndex,
}: {
  doc: Document
  projectId: string
  emaKnowledgeEnabled: boolean
  indexed: boolean
  indexing: boolean
  bulkPending: boolean
  onIndex: (documentId: string) => Promise<boolean>
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const handleDownload = async () => {
    if (doc.external_url) {
      openDocumentUrl(doc.external_url)
      return
    }
    const result = await getDocumentUrl(doc.file_path, doc.external_provider)
    if (result.url) {
      openDocumentUrl(result.url)
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
  const showEmaAction = emaKnowledgeEnabled && isPdfDocument(doc)

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-muted-foreground">{ext}</span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {doc.display_name}
          </p>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
            <span>
              {formatDate(doc.created_at)}
              {doc.file_size_bytes && ` · ${formatFileSize(doc.file_size_bytes)}`}
              {doc.version > 1 && ` · v${doc.version}`}
            </span>
            {showEmaAction && indexed ? (
              <span className="rounded-full bg-[#EAF6DE] px-1.5 py-0.5 text-[10px] font-bold text-[#4A9400]">EMA bereit</span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {showEmaAction && !indexed ? (
            <button
              type="button"
              onClick={() => void onIndex(doc.id)}
              disabled={indexing || bulkPending}
              className="btn-icon text-[#5CB800] hover:text-[#4A9400] disabled:opacity-40"
              title="Für EMA einlesen"
              aria-label={`${doc.display_name} für EMA einlesen`}
            >
              {indexing ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleDownload}
            className="btn-icon text-muted-foreground hover:text-[#5CB800]"
            title="Herunterladen"
            aria-label={`${doc.display_name} herunterladen`}
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="btn-icon text-muted-foreground hover:text-destructive"
            title="Entfernen"
            aria-label={`${doc.display_name} entfernen`}
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
        description={`„${doc.display_name}“ wird aus der Projektansicht entfernt.`}
        confirmLabel="Entfernen"
        danger
        loading={pending}
      />
    </>
  )
}
