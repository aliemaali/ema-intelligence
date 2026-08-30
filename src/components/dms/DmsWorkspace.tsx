'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload as TusUpload } from 'tus-js-client'
import {
  Archive, ChevronRight, FileArchive, FileSearch, FileText, Folder,
  FolderPlus, Loader2, Search, ShieldCheck, UploadCloud,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import {
  archiveDmsDocument, createDmsFolder, findDmsDuplicate,
  getDmsDocumentUrl, registerDmsUpload,
} from '@/lib/actions/dms.actions'
import type { DmsDataRoom, DmsDocument, DmsFolder, DmsProjectOption } from '@/lib/dms/types'

const SMALL_UPLOAD_LIMIT = 6 * 1024 * 1024
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

type Props = {
  userId: string
  documents: DmsDocument[]
  folders: DmsFolder[]
  dataRooms: DmsDataRoom[]
  projects: DmsProjectOption[]
}

function safeName(name: string) {
  const cleaned = name.normalize('NFKC').replace(/[\\/\u0000-\u001f]+/g, '_').replace(/\s+/g, ' ').trim()
  return cleaned.slice(0, 180) || 'Dokument'
}

function bytesLabel(bytes: number | null) {
  if (!bytes) return '—'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB`
}

async function sha256(file: File) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, '0')).join('')
}

function uploadWithTus(file: File, objectName: string, token: string, onProgress: (progress: number) => void) {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!baseUrl) return Promise.reject(new Error('DMS-Speicher ist nicht konfiguriert.'))
  const projectRef = new URL(baseUrl).hostname.split('.')[0]
  const endpoint = `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable`

  return new Promise<void>((resolve, reject) => {
    const upload = new TusUpload(file, {
      endpoint,
      retryDelays: [0, 1000, 3000, 5000],
      headers: { authorization: `Bearer ${token}`, 'x-upsert': 'false' },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: 'ema-dms',
        objectName,
        contentType: file.type || 'application/octet-stream',
        cacheControl: '3600',
      },
      chunkSize: 6 * 1024 * 1024,
      onError: (error) => reject(error),
      onProgress: (uploaded, total) => onProgress(total ? Math.round((uploaded / total) * 100) : 0),
      onSuccess: () => resolve(),
    })
    upload.findPreviousUploads().then((previous) => {
      if (previous.length > 0) upload.resumeFromPreviousUpload(previous[0])
      upload.start()
    }).catch(reject)
  })
}

export function DmsWorkspace({ userId, documents, folders, dataRooms, projects }: Props) {
  const router = useRouter()
  const fileInput = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [folderId, setFolderId] = useState<string>('all')
  const [projectId, setProjectId] = useState('')
  const [profile, setProfile] = useState<'pv' | 'bess' | 'pv_bess'>('pv')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [newFolder, setNewFolder] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('de-DE')
    return documents.filter((document) => {
      if (folderId === 'data-rooms' && !document.is_data_room_archive) return false
      if (folderId !== 'all' && folderId !== 'data-rooms' && document.folder_id !== folderId) return false
      if (!needle) return true
      return [document.display_name, document.file_name, document.source_app, document.source_kind]
        .some((value) => value?.toLocaleLowerCase('de-DE').includes(needle))
    })
  }, [documents, folderId, query])

  async function uploadOne(original: File) {
    if (original.size <= 0 || original.size > MAX_UPLOAD_BYTES) throw new Error(`${original.name}: maximal 50 MB pro Datei.`)
    const isZip = /\.zip$/i.test(original.name) || ['application/zip', 'application/x-zip-compressed'].includes(original.type)
    const contentType = isZip ? 'application/zip' : (original.type || 'application/octet-stream')
    const file = original.type === contentType ? original : new File([original], original.name, { type: contentType })
    const fingerprint = await sha256(file)
    const duplicate = await findDmsDuplicate(fingerprint)
    if (duplicate.error) throw new Error(duplicate.error)
    if (duplicate.document) {
      toast.info(`„${file.name}“ ist bereits im DMS gespeichert.`)
      return
    }

    const supabase = createClient()
    const date = new Date()
    const objectName = `${userId}/${date.getUTCFullYear()}/${date.getUTCMonth() + 1}/${crypto.randomUUID()}-${safeName(file.name)}`
    if (file.size > SMALL_UPLOAD_LIMIT) {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Sitzung abgelaufen. Bitte erneut anmelden.')
      await uploadWithTus(file, objectName, session.access_token, setProgress)
    } else {
      const { error } = await supabase.storage.from('ema-dms').upload(objectName, file, {
        contentType,
        cacheControl: '3600',
        upsert: false,
      })
      if (error) throw error
      setProgress(100)
    }

    const registered = await registerDmsUpload({
      displayName: file.name.replace(/\.[^.]+$/, ''),
      fileName: file.name,
      filePath: objectName,
      fileSizeBytes: file.size,
      mimeType: contentType,
      sha256: fingerprint,
      folderId: folderId !== 'all' && folderId !== 'data-rooms' ? folderId : null,
      projectId: projectId || null,
      documentType: 'sonstiges',
      isDataRoom: isZip,
      dataRoomProfile: isZip ? profile : undefined,
    })
    if (registered.duplicate) {
      await supabase.storage.from('ema-dms').remove([objectName])
      toast.info(`„${file.name}“ ist bereits im DMS gespeichert.`)
      return
    }
    if (registered.error) {
      await supabase.storage.from('ema-dms').remove([objectName])
      throw new Error(registered.error)
    }

    if (registered.dataRoomId) {
      const response = await fetch(`/api/dms/data-rooms/${registered.dataRoomId}/extract`, { method: 'POST' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) toast.warning(payload?.error ?? 'Datenraum wurde gespeichert, konnte aber noch nicht entpackt werden.')
      else toast.success('Datenraum wurde importiert und für die DD vorbereitet.')
    } else {
      toast.success('Dokument wurde zentral im EMA DMS gespeichert.')
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return
    setUploading(true)
    setProgress(0)
    try {
      for (const file of Array.from(files)) await uploadOne(file)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload fehlgeschlagen.')
    } finally {
      setUploading(false)
      setProgress(0)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function openDocument(id: string) {
    const result = await getDmsDocumentUrl(id)
    if (result.error || !result.url) return toast.error(result.error ?? 'Dokument konnte nicht geöffnet werden.')
    window.open(result.url, '_blank', 'noopener,noreferrer')
  }

  async function archiveDocument(id: string) {
    if (!window.confirm('Dokument in den DMS-Papierkorb verschieben?')) return
    const result = await archiveDmsDocument(id)
    if (result.error) return toast.error(result.error)
    toast.success('Dokument wurde in den Papierkorb verschoben.')
    router.refresh()
  }

  async function addFolder() {
    if (!newFolder.trim()) return
    setCreatingFolder(true)
    const result = await createDmsFolder(newFolder)
    setCreatingFolder(false)
    if (result.error) return toast.error(result.error)
    setNewFolder('')
    router.refresh()
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="rounded-[1.7rem] border border-white/10 bg-[#071a32]/90 p-4 text-white shadow-[0_20px_55px_rgba(0,0,0,.25)] backdrop-blur-xl">
        <p className="px-2 text-[10px] font-extrabold uppercase tracking-[.18em] text-[#8eee51]">Ablage</p>
        <div className="mt-2 space-y-1">
          <button type="button" onClick={() => setFolderId('all')} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold ${folderId === 'all' ? 'bg-[#5CB800] text-white' : 'text-slate-200 hover:bg-white/5'}`}><Folder className="h-4 w-4" /> Alle Dokumente</button>
          <button type="button" onClick={() => setFolderId('data-rooms')} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold ${folderId === 'data-rooms' ? 'bg-[#5CB800] text-white' : 'text-slate-200 hover:bg-white/5'}`}><FileArchive className="h-4 w-4" /> Datenräume</button>
          {folders.map((folder) => <button type="button" key={folder.id} onClick={() => setFolderId(folder.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold ${folderId === folder.id ? 'bg-[#5CB800] text-white' : 'text-slate-200 hover:bg-white/5'}`}><Folder className="h-4 w-4" /><span className="truncate">{folder.name}</span></button>)}
        </div>
        <div className="mt-4 border-t border-white/10 pt-4">
          <label className="text-[10px] font-extrabold uppercase tracking-[.16em] text-slate-400">Neuer Ordner</label>
          <div className="mt-2 flex gap-2"><input value={newFolder} onChange={(event) => setNewFolder(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void addFolder() }} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500" placeholder="Ordnername" /><button type="button" onClick={addFolder} disabled={creatingFolder} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white"><FolderPlus className="h-4 w-4" /></button></div>
        </div>
      </aside>

      <section className="min-w-0 space-y-4">
        <div className="rounded-[1.7rem] border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_180px]">
            <label className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm font-medium text-[#07142F] outline-none focus:border-[#5CB800]" placeholder="Dokumente durchsuchen …" /></label>
            <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-[#07142F]"><option value="">Keinem Projekt zuordnen</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.label}</option>)}</select>
            <select value={profile} onChange={(event) => setProfile(event.target.value as typeof profile)} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-[#07142F]" title="DD-Prüfprofil"><option value="pv">DD: PV</option><option value="bess">DD: BESS</option><option value="pv_bess">DD: PV + BESS</option></select>
          </div>
          <input ref={fileInput} type="file" multiple className="hidden" accept=".zip,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.jpg,.jpeg,.png,.webp" onChange={(event) => void onFiles(event.target.files)} />
          <button type="button" onClick={() => fileInput.current?.click()} disabled={uploading} className="mt-3 flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[#5CB800] px-5 text-sm font-extrabold text-white shadow-[0_12px_30px_rgba(92,184,0,.24)] disabled:opacity-60">{uploading ? <><Loader2 className="h-5 w-5 animate-spin" /> Upload läuft · {progress}%</> : <><UploadCloud className="h-5 w-5" /> Dokumente oder ZIP-Datenraum hochladen</>}</button>
          <p className="mt-2 text-center text-xs text-slate-500">PDF, Office-Dateien, Bilder und ZIP · maximal 50 MB je Datei · größere Uploads werden automatisch fortgesetzt</p>
        </div>

        {dataRooms.length > 0 && folderId === 'data-rooms' && <div className="grid gap-3 sm:grid-cols-2">{dataRooms.map((room) => <div key={room.id} className="rounded-2xl border border-blue-100 bg-[#071a32] p-4 text-white shadow-sm"><div className="flex items-start justify-between gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#5CB800]/15 text-[#8eee51]"><ShieldCheck className="h-5 w-5" /></span><span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-slate-300">{room.status}</span></div><h3 className="mt-4 truncate font-extrabold">{room.name}</h3><p className="mt-1 text-xs text-slate-400">{room.file_count} Dateien · {bytesLabel(room.total_uncompressed_bytes)}</p><a href={`/dms/data-rooms/${room.id}`} className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold">DD öffnen <ChevronRight className="h-4 w-4" /></a></div>)}</div>}

        <div className="overflow-hidden rounded-[1.7rem] border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 md:px-5"><div><h2 className="font-extrabold text-[#07142F]">Zentrale Dokumente</h2><p className="mt-0.5 text-xs text-slate-500">Eine Datei, überall verfügbar</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-600">{filtered.length}</span></div>
          {filtered.length === 0 ? <div className="px-5 py-14 text-center"><FileSearch className="mx-auto h-10 w-10 text-slate-300" /><h3 className="mt-3 font-extrabold text-[#07142F]">Noch keine passenden Dokumente</h3><p className="mt-1 text-sm text-slate-500">Lade ein Dokument oder einen vollständigen Datenraum hoch.</p></div> : <div className="divide-y divide-slate-100">{filtered.map((document) => <div key={document.id} className="flex items-center gap-3 px-4 py-3.5 md:px-5"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${document.is_data_room_archive ? 'bg-violet-50 text-violet-700' : 'bg-emerald-50 text-emerald-700'}`}>{document.is_data_room_archive ? <FileArchive className="h-5 w-5" /> : <FileText className="h-5 w-5" />}</span><button type="button" onClick={() => void openDocument(document.id)} className="min-w-0 flex-1 text-left"><p className="truncate text-sm font-extrabold text-[#07142F]">{document.display_name}</p><p className="mt-1 truncate text-xs text-slate-500">{bytesLabel(document.file_size_bytes)} · {document.source_app === 'ema_office' ? 'EMA Office' : document.source_kind === 'template' ? 'Vorlage' : 'EMA Intelligence'}</p></button>{document.ai_analyzed && <span className="hidden rounded-full bg-[#5CB800]/10 px-2.5 py-1 text-[10px] font-extrabold text-[#3f8500] sm:inline">EMA gelesen</span>}<button type="button" onClick={() => void archiveDocument(document.id)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Dokument archivieren"><Archive className="h-4 w-4" /></button></div>)}</div>}
        </div>
      </section>
    </div>
  )
}
