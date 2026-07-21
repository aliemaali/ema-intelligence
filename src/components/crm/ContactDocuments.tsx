'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Download, FileText, Trash2, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface ContactDocument {
  id: string
  document_type: string
  file_name: string
  storage_path: string
  created_at: string
}

type ChecklistStatus = 'vorhanden' | 'fehlt' | 'nicht_erforderlich'

interface ContactDocumentsProps {
  entityType: 'partner' | 'investor'
  entityId: string
  documentTypes: string[]
}

const STATUS_LABELS: Record<ChecklistStatus, string> = {
  vorhanden: 'Vorhanden',
  fehlt: 'Fehlt',
  nicht_erforderlich: 'Nicht erforderlich',
}

export function ContactDocuments({ entityType, entityId, documentTypes }: ContactDocumentsProps) {
  const supabase = createClient()
  const [documents, setDocuments] = useState<ContactDocument[]>([])
  const [statuses, setStatuses] = useState<Record<string, ChecklistStatus>>({})
  const [documentType, setDocumentType] = useState(documentTypes[0])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadData() {
    const [{ data, error: loadError }, { data: checklist, error: checklistError }] = await Promise.all([
      supabase
        .from('contact_documents')
        .select('id, document_type, file_name, storage_path, created_at')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false }),
      supabase
        .from('contact_document_checklists')
        .select('document_type, status')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId),
    ])

    if (loadError || checklistError) {
      setError(loadError?.message ?? checklistError?.message ?? 'Daten konnten nicht geladen werden')
      return
    }

    const loadedDocuments = (data ?? []) as ContactDocument[]
    setDocuments(loadedDocuments)

    const next: Record<string, ChecklistStatus> = {}
    documentTypes.forEach((type) => {
      next[type] = loadedDocuments.some((document) => document.document_type === type) ? 'vorhanden' : 'fehlt'
    })
    ;(checklist ?? []).forEach((item: any) => {
      next[item.document_type] = item.status as ChecklistStatus
    })
    setStatuses(next)
  }

  useEffect(() => {
    loadData()
  }, [entityType, entityId])

  const relevantTypes = useMemo(() => documentTypes.filter((type) => type !== 'Sonstiges'), [documentTypes])
  const requiredTypes = relevantTypes.filter((type) => statuses[type] !== 'nicht_erforderlich')
  const presentCount = requiredTypes.filter((type) => statuses[type] === 'vorhanden').length

  async function setChecklistStatus(type: string, status: ChecklistStatus) {
    setError(null)
    const { data: userData } = await supabase.auth.getUser()
    const user = userData.user
    if (!user) return setError('Nicht angemeldet')

    const { error: saveError } = await supabase.from('contact_document_checklists').upsert({
      user_id: user.id,
      entity_type: entityType,
      entity_id: entityId,
      document_type: type,
      status,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,entity_type,entity_id,document_type' })

    if (saveError) return setError(saveError.message)
    setStatuses((current) => ({ ...current, [type]: status }))
  }

  async function uploadFile(file: File) {
    setUploading(true)
    setError(null)

    const { data: userData } = await supabase.auth.getUser()
    const user = userData.user
    if (!user) {
      setError('Nicht angemeldet')
      setUploading(false)
      return
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${user.id}/${entityType}/${entityId}/${crypto.randomUUID()}-${safeName}`
    const { error: uploadError } = await supabase.storage.from('contact-documents').upload(storagePath, file, { upsert: false })

    if (uploadError) {
      setError(uploadError.message)
      setUploading(false)
      return
    }

    const { error: insertError } = await supabase.from('contact_documents').insert({
      user_id: user.id,
      entity_type: entityType,
      entity_id: entityId,
      document_type: documentType,
      file_name: file.name,
      storage_path: storagePath,
      mime_type: file.type || null,
      size_bytes: file.size,
    })

    if (insertError) {
      await supabase.storage.from('contact-documents').remove([storagePath])
      setError(insertError.message)
      setUploading(false)
      return
    }

    await supabase.from('contact_document_checklists').upsert({
      user_id: user.id,
      entity_type: entityType,
      entity_id: entityId,
      document_type: documentType,
      status: 'vorhanden',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,entity_type,entity_id,document_type' })

    setUploading(false)
    await loadData()
  }

  async function openDocument(document: ContactDocument) {
    const { data, error: signedError } = await supabase.storage.from('contact-documents').createSignedUrl(document.storage_path, 60)
    if (signedError || !data?.signedUrl) return setError(signedError?.message ?? 'Dokument konnte nicht geöffnet werden')
    window.location.href = data.signedUrl
  }

  async function deleteDocument(document: ContactDocument) {
    if (!window.confirm(`Dokument „${document.file_name}“ wirklich löschen?`)) return
    const { error: storageError } = await supabase.storage.from('contact-documents').remove([document.storage_path])
    if (storageError) return setError(storageError.message)
    const { error: deleteError } = await supabase.from('contact_documents').delete().eq('id', document.id)
    if (deleteError) return setError(deleteError.message)
    await loadData()
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-[#07142F]">Dokumente</h2>
          <p className="mt-1 text-sm text-slate-500">Dokumente: {presentCount} von {requiredTypes.length} vorhanden</p>
        </div>
        <FileText className="h-5 w-5 text-[#5CB800]" />
      </div>

      <div className="mt-5 space-y-2">
        {relevantTypes.map((type) => {
          const status = statuses[type] ?? 'fehlt'
          return (
            <div key={type} className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_190px] sm:items-center">
              <div className="flex items-center gap-2">
                <CheckCircle2 className={`h-4 w-4 ${status === 'vorhanden' ? 'text-[#5CB800]' : status === 'fehlt' ? 'text-amber-500' : 'text-slate-400'}`} />
                <span className="text-sm font-bold text-[#07142F]">{type}</span>
              </div>
              <select className="form-input py-2" value={status} onChange={(event) => setChecklistStatus(type, event.target.value as ChecklistStatus)}>
                {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          )
        })}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
        <select className="form-input" value={documentType} onChange={(event) => setDocumentType(event.target.value)}>
          {documentTypes.map((type) => <option key={type} value={type}>{type}</option>)}
        </select>
        <label className="btn-primary cursor-pointer justify-center">
          <Upload className="h-4 w-4" /> {uploading ? 'Lädt hoch …' : 'Dokument hochladen'}
          <input className="hidden" type="file" accept=".pdf,.jpg,.jpeg,.png,.docx" disabled={uploading} onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) uploadFile(file)
            event.currentTarget.value = ''
          }} />
        </label>
      </div>

      {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-5 space-y-2">
        {documents.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">Noch keine Dokumente hinterlegt.</p>
        ) : documents.map((document) => (
          <div key={document.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[#07142F]">{document.file_name}</p>
              <p className="mt-0.5 text-xs text-slate-500">{document.document_type} · {new Date(document.created_at).toLocaleDateString('de-DE')}</p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button type="button" className="btn-icon" onClick={() => openDocument(document)} aria-label="Dokument öffnen"><Download className="h-4 w-4" /></button>
              <button type="button" className="btn-icon text-red-600" onClick={() => deleteDocument(document)} aria-label="Dokument löschen"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
