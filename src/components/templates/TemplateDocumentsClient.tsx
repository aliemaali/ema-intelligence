'use client'

import { useMemo, useRef, useState } from 'react'
import { Download, FileText, FolderOpen, Link2, Trash2, Upload, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import {
  archiveTemplateDocument,
  createTemplateDocumentRecord,
  getTemplateDocumentUrl,
  saveDocumentAssignments,
  type DocumentEntityType,
} from '@/lib/actions/template-document.actions'
import { formatFileSize } from '@/lib/utils'

const CATEGORIES = [
  ['nda', 'NDA / Vertraulichkeit'],
  ['anfrageformular', 'Anfrageformular'],
  ['vollmacht', 'Vollmacht'],
  ['checkliste', 'Checkliste'],
  ['vertrag', 'Vertrag'],
  ['sonstiges', 'Sonstiges'],
] as const

type TemplateDocument = {
  id: string
  display_name: string
  category: string
  file_name: string
  file_path: string
  file_size_bytes: number | null
  mime_type: string | null
  created_at: string
}

type EntityOption = { id: string; label: string; subtitle?: string | null }
type Assignment = { document_id: string; entity_type: DocumentEntityType; entity_id: string }

type Props = {
  userId: string
  documents: TemplateDocument[]
  partners: EntityOption[]
  investors: EntityOption[]
  projects: EntityOption[]
  assignments: Assignment[]
}

export function TemplateDocumentsClient({ userId, documents, partners, investors, projects, assignments }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [category, setCategory] = useState('sonstiges')
  const [uploading, setUploading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [assigningDocument, setAssigningDocument] = useState<TemplateDocument | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const assignmentCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of assignments) map.set(item.document_id, (map.get(item.document_id) ?? 0) + 1)
    return map
  }, [assignments])

  const selectFile = (selectedFile: File) => {
    if (selectedFile.size > 50 * 1024 * 1024) {
      toast.error('Die Datei darf maximal 50 MB groß sein.')
      return
    }
    setFile(selectedFile)
    setDisplayName(selectedFile.name.replace(/\.[^/.]+$/, ''))
  }

  const upload = async () => {
    if (!file) return
    setUploading(true)
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_')
    const filePath = `${userId}/${Date.now()}_${safeName}`

    try {
      const { error: uploadError } = await supabase.storage
        .from('template-documents')
        .upload(filePath, file, { cacheControl: '3600', upsert: false })
      if (uploadError) throw uploadError

      const result = await createTemplateDocumentRecord({
        displayName: displayName.trim() || file.name,
        category,
        fileName: file.name,
        filePath,
        fileSizeBytes: file.size,
        mimeType: file.type || 'application/octet-stream',
      })
      if (result.error) {
        await supabase.storage.from('template-documents').remove([filePath])
        throw new Error(result.error)
      }

      toast.success('Dokument wurde gespeichert.')
      setFile(null)
      setDisplayName('')
      setCategory('sonstiges')
      if (inputRef.current) inputRef.current.value = ''
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload fehlgeschlagen.')
    } finally {
      setUploading(false)
    }
  }

  const download = async (document: TemplateDocument) => {
    setBusyId(document.id)
    const result = await getTemplateDocumentUrl(document.file_path)
    setBusyId(null)
    if (result.error || !result.url) return toast.error(result.error || 'Datei konnte nicht geöffnet werden.')
    window.open(result.url, '_blank', 'noopener,noreferrer')
  }

  const archive = async (document: TemplateDocument) => {
    if (!window.confirm(`„${document.display_name}“ aus Dokumente entfernen?`)) return
    setBusyId(document.id)
    const result = await archiveTemplateDocument(document.id)
    setBusyId(null)
    if (result.error) return toast.error(result.error)
    toast.success('Dokument entfernt.')
    router.refresh()
  }

  const openAssignments = (document: TemplateDocument) => {
    setAssigningDocument(document)
    setSelected(new Set(assignments
      .filter((item) => item.document_id === document.id)
      .map((item) => `${item.entity_type}:${item.entity_id}`)))
  }

  const toggle = (type: DocumentEntityType, id: string) => {
    const key = `${type}:${id}`
    setSelected((current) => {
      const next = new Set(current)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const saveAssignments = async () => {
    if (!assigningDocument) return
    setBusyId(assigningDocument.id)
    const result = await saveDocumentAssignments({
      documentId: assigningDocument.id,
      assignments: Array.from(selected).map((key) => {
        const [entityType, entityId] = key.split(':')
        return { entityType: entityType as DocumentEntityType, entityId }
      }),
    })
    setBusyId(null)
    if (result.error) return toast.error(result.error)
    toast.success('Zuordnungen gespeichert.')
    setAssigningDocument(null)
    router.refresh()
  }

  const group = (title: string, type: DocumentEntityType, options: EntityOption[]) => (
    <div>
      <h3 className="mb-2 text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">{title}</h3>
      <div className="max-h-48 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 p-3">
        {options.length === 0 ? <p className="text-sm text-muted-foreground">Keine Einträge vorhanden.</p> : options.map((option) => {
          const key = `${type}:${option.id}`
          return <label key={key} className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-slate-50">
            <input type="checkbox" checked={selected.has(key)} onChange={() => toggle(type, option.id)} className="h-4 w-4 accent-[#5CB800]" />
            <span className="min-w-0"><strong className="block truncate text-sm text-[#07142F]">{option.label}</strong>{option.subtitle && <span className="block truncate text-xs text-muted-foreground">{option.subtitle}</span>}</span>
          </label>
        })}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm md:p-7">
        <div className="flex items-center gap-4"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5CB800]/12 text-[#2F8A00]"><Upload className="h-6 w-6" /></span><div><h2 className="text-xl font-extrabold text-[#07142F]">Dokument hochladen</h2><p className="mt-1 text-sm text-muted-foreground">PDF, Word, Excel, PowerPoint oder Bilddatei bis 50 MB.</p></div></div>
        <div className="mt-5 space-y-4">
          <button type="button" onClick={() => inputRef.current?.click()} className="w-full rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center transition hover:border-[#5CB800]/50 hover:bg-[#5CB800]/5">
            {file ? <span className="flex items-center justify-center gap-3"><FileText className="h-6 w-6 text-[#2F8A00]" /><span className="min-w-0 text-left"><strong className="block truncate text-sm text-[#07142F]">{file.name}</strong><span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span></span><X onClick={(event) => { event.stopPropagation(); setFile(null) }} className="h-5 w-5 text-muted-foreground" /></span> : <span><FolderOpen className="mx-auto h-9 w-9 text-[#2F8A00]" /><strong className="mt-3 block text-sm text-[#07142F]">Datei auswählen</strong><span className="mt-1 block text-xs text-muted-foreground">oder hier ablegen</span></span>}
          </button>
          <input ref={inputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.txt,.zip" onChange={(event) => { const chosen = event.target.files?.[0]; if (chosen) selectFile(chosen) }} />
          {file && <div className="grid gap-4 md:grid-cols-2"><div><label className="form-label">Bezeichnung</label><input className="form-input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="z. B. NDA Standard deutsch" /></div><div><label className="form-label">Kategorie</label><select className="form-input" value={category} onChange={(event) => setCategory(event.target.value)}>{CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><button type="button" onClick={upload} disabled={uploading} className="btn-primary md:col-span-2">{uploading ? 'Wird hochgeladen…' : 'Dokument speichern'}</button></div>}
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm md:p-7">
        <div className="mb-5"><h2 className="text-xl font-extrabold text-[#07142F]">Gespeicherte Dokumente</h2><p className="mt-1 text-sm text-muted-foreground">{documents.length} Dokument{documents.length === 1 ? '' : 'e'}</p></div>
        {documents.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center"><FolderOpen className="mx-auto h-10 w-10 text-slate-400" /><p className="mt-3 font-extrabold text-[#07142F]">Noch keine Dokumente</p></div> : <div className="grid gap-3 md:grid-cols-2">{documents.map((document) => {
          const categoryLabel = CATEGORIES.find(([value]) => value === document.category)?.[1] || 'Sonstiges'
          const count = assignmentCounts.get(document.id) ?? 0
          return <div key={document.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#1F2A44]/8 text-[#1F2A44]"><FileText className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="truncate font-extrabold text-[#07142F]">{document.display_name}</p><p className="mt-1 truncate text-xs text-muted-foreground">{categoryLabel} · {document.file_size_bytes ? formatFileSize(document.file_size_bytes) : document.file_name}</p><p className="mt-1 text-xs font-bold text-[#2F8A00]">{count === 0 ? 'Noch nicht zugeordnet' : `${count} Zuordnung${count === 1 ? '' : 'en'}`}</p></div><button type="button" disabled={busyId === document.id} onClick={() => download(document)} className="btn-icon text-[#2F8A00]" aria-label="Herunterladen"><Download className="h-5 w-5" /></button><button type="button" disabled={busyId === document.id} onClick={() => archive(document)} className="btn-icon text-slate-400 hover:text-red-600" aria-label="Entfernen"><Trash2 className="h-5 w-5" /></button></div><button type="button" onClick={() => openAssignments(document)} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1F2A44] px-4 py-2.5 text-sm font-extrabold text-white"><Link2 className="h-4 w-4" /> Partner, Investoren und Projekte zuordnen</button></div>
        })}</div>}
      </section>

      {assigningDocument && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-3 md:items-center"><div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] bg-white p-5 shadow-2xl md:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#2F8A00]">Dokument zuordnen</p><h2 className="mt-1 text-2xl font-extrabold text-[#07142F]">{assigningDocument.display_name}</h2></div><button type="button" onClick={() => setAssigningDocument(null)} className="btn-icon"><X className="h-5 w-5" /></button></div><div className="mt-5 grid gap-5 md:grid-cols-3">{group('Partner', 'partner', partners)}{group('Investoren', 'investor', investors)}{group('Projekte', 'project', projects)}</div><div className="mt-6 flex gap-3"><button type="button" onClick={() => setAssigningDocument(null)} className="btn-secondary flex-1">Abbrechen</button><button type="button" onClick={saveAssignments} disabled={busyId === assigningDocument.id} className="btn-primary flex-1">Zuordnungen speichern</button></div></div></div>}
    </div>
  )
}
