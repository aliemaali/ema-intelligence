'use client'

import { useState, useRef, useTransition } from 'react'
import { Upload, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createDocumentRecord } from '@/lib/actions/document.actions'
import { LoadingSpinner } from '@/components/ui'
import { DOCUMENT_TYPE_LABELS } from '@/lib/types/constants'
import { toast } from 'sonner'
import { cn, formatFileSize } from '@/lib/utils'
import type { DocumentType } from '@/lib/types/database.types'

interface DocumentUploaderProps {
  projectId: string
  userId:    string
}

export function DocumentUploader({ projectId, userId }: DocumentUploaderProps) {
  const [file,        setFile]        = useState<File | null>(null)
  const [docType,     setDocType]     = useState<DocumentType>('sonstiges')
  const [displayName, setDisplayName] = useState('')
  const [dragging,    setDragging]    = useState(false)
  const [uploading,   setUploading]   = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const handleFile = (f: File) => {
    setFile(f)
    setDisplayName(f.name.replace(/\.[^/.]+$/, '')) // strip extension
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)

    try {
      // Storage path: {userId}/{projectId}/{timestamp}_{filename}
      const ext       = file.name.split('.').pop()
      const timestamp = Date.now()
      const storagePath = `${userId}/${projectId}/${timestamp}_${file.name}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('project-documents')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert:       false,
        })

      if (uploadError) {
        toast.error(`Upload fehlgeschlagen: ${uploadError.message}`)
        return
      }

      // Create DB record (trigger will log activity)
      const result = await createDocumentRecord({
        projectId,
        displayName:   displayName.trim() || file.name,
        fileName:      file.name,
        filePath:      storagePath,
        fileSizeBytes: file.size,
        mimeType:      file.type,
        documentType:  docType,
      })

      if (result.error) {
        toast.error(result.error)
        // Clean up storage if DB insert failed
        await supabase.storage.from('project-documents').remove([storagePath])
        return
      }

      toast.success('Dokument hochgeladen')
      setFile(null)
      setDisplayName('')
      setDocType('sonstiges')

    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-3">

      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !file && inputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-lg p-6 text-center transition-all',
          dragging
            ? 'border-[#5CB800] bg-[#5CB800]/5'
            : file
            ? 'border-border bg-muted/30'
            : 'border-border hover:border-[#5CB800]/50 cursor-pointer'
        )}
      >
        {file ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <span className="text-lg">📄</span>
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setFile(null) }}
              className="btn-icon text-muted-foreground hover:text-destructive shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="w-8 h-8 text-muted-foreground mx-auto" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Datei hier ablegen
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                oder klicken zum Auswählen · max. 50 MB
              </p>
            </div>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.docx,.doc,.pptx,.txt,.zip"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
          }}
        />
      </div>

      {/* File options (shown after file selected) */}
      {file && (
        <div className="space-y-3">
          <div>
            <label className="form-label text-xs">Bezeichnung</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Dokumentname..."
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label text-xs">Kategorie</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as DocumentType)}
              className="form-input"
            >
              {(Object.entries(DOCUMENT_TYPE_LABELS) as [DocumentType, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading}
            className="btn-primary w-full"
          >
            {uploading
              ? <><LoadingSpinner size="sm" /> Wird hochgeladen…</>
              : '↑ Hochladen'}
          </button>
        </div>
      )}
    </div>
  )
}
