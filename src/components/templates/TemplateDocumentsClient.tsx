'use client'

import { useRef, useState } from 'react'
import { Download, FileText, FolderOpen, Trash2, Upload, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import {
  archiveTemplateDocument,
  createTemplateDocumentRecord,
  getTemplateDocumentUrl,
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

export function TemplateDocumentsClient({ userId, documents }: { userId: string; documents: TemplateDocument[] }) {
  const router = useRouter()
  const supabase = createClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [category, setCategory] = useState('sonstiges')
  const [uploading, setUploading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const selectFile = (selected: File) => {
    if (selected.size > 50 * 1024 * 1024) {
      toast.error('Die Datei darf maximal 50 MB groß sein.')
      return
    }
    setFile(selected)
    setDisplayName(selected.name.replace(/\.[^/.]+$/, ''))
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

      toast.success('Musterformular wurde gespeichert.')
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
    if (result.error || !result.url) {
      toast.error(result.error || 'Datei konnte nicht geöffnet werden.')
      return
    }
    window.open(result.url, '_blank', 'noopener,noreferrer')
  }

  const archive = async (document: TemplateDocument) => {
    if (!window.confirm(`„${document.display_name}“ aus dem Ordner entfernen?`)) return
    setBusyId(document.id)
    const result = await archiveTemplateDocument(document.id)
    setBusyId(null)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Musterformular entfernt.')
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm md:p-7">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5CB800]/12 text-[#2F8A00]"><Upload className="h-6 w-6" /></span>
          <div><h2 className="text-xl font-extrabold text-[#07142F]">Musterformular hochladen</h2><p className="mt-1 text-sm text-muted-foreground">PDF, Word, Excel, PowerPoint oder Bilddatei bis 50 MB.</p></div>
        </div>

        <div className="mt-5 space-y-4">
          <button type="button" onClick={() => inputRef.current?.click()} className="w-full rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center transition hover:border-[#5CB800]/50 hover:bg-[#5CB800]/5">
            {file ? <span className="flex items-center justify-center gap-3"><FileText className="h-6 w-6 text-[#2F8A00]" /><span className="min-w-0 text-left"><strong className="block truncate text-sm text-[#07142F]">{file.name}</strong><span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span></span><X onClick={(event) => { event.stopPropagation(); setFile(null) }} className="h-5 w-5 text-muted-foreground" /></span> : <span><FolderOpen className="mx-auto h-9 w-9 text-[#2F8A00]" /><strong className="mt-3 block text-sm text-[#07142F]">Datei auswählen</strong><span className="mt-1 block text-xs text-muted-foreground">oder hier ablegen</span></span>}
          </button>
          <input ref={inputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.txt,.zip" onChange={(event) => { const selected = event.target.files?.[0]; if (selected) selectFile(selected) }} />

          {file && <div className="grid gap-4 md:grid-cols-2">
            <div><label className="form-label">Bezeichnung</label><input className="form-input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="z. B. NDA Standard deutsch" /></div>
            <div><label className="form-label">Kategorie</label><select className="form-input" value={category} onChange={(event) => setCategory(event.target.value)}>{CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            <button type="button" onClick={upload} disabled={uploading} className="btn-primary md:col-span-2">{uploading ? 'Wird hochgeladen…' : 'Musterformular speichern'}</button>
          </div>}
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm md:p-7">
        <div className="mb-5 flex items-center justify-between gap-3"><div><h2 className="text-xl font-extrabold text-[#07142F]">Gespeicherte Vorlagen</h2><p className="mt-1 text-sm text-muted-foreground">{documents.length} Musterformular{documents.length === 1 ? '' : 'e'}</p></div></div>
        {documents.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center"><FolderOpen className="mx-auto h-10 w-10 text-slate-400" /><p className="mt-3 font-extrabold text-[#07142F]">Noch keine Musterformulare</p><p className="mt-1 text-sm text-muted-foreground">Lade oben deine erste NDA- oder Anfrageformular-Vorlage hoch.</p></div> : <div className="grid gap-3 md:grid-cols-2">{documents.map((document) => {
          const categoryLabel = CATEGORIES.find(([value]) => value === document.category)?.[1] || 'Sonstiges'
          return <div key={document.id} className="flex items-center gap-4 rounded-2xl border border-slate-200 p-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#1F2A44]/8 text-[#1F2A44]"><FileText className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1"><p className="truncate font-extrabold text-[#07142F]">{document.display_name}</p><p className="mt-1 truncate text-xs text-muted-foreground">{categoryLabel} · {document.file_size_bytes ? formatFileSize(document.file_size_bytes) : document.file_name}</p></div>
            <button type="button" disabled={busyId === document.id} onClick={() => download(document)} className="btn-icon text-[#2F8A00]" aria-label="Herunterladen"><Download className="h-5 w-5" /></button>
            <button type="button" disabled={busyId === document.id} onClick={() => archive(document)} className="btn-icon text-slate-400 hover:text-red-600" aria-label="Entfernen"><Trash2 className="h-5 w-5" /></button>
          </div>
        })}</div>}
      </section>
    </div>
  )
}
