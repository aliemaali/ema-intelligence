'use client'

import Link from 'next/link'
import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload as TusUpload } from 'tus-js-client'
import {
  ChevronRight, Files, Folder, FolderOpen, FolderPlus,
  Inbox, Loader2, ShieldCheck, UploadCloud,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { createDmsFolder, findDmsDuplicate, registerDmsUpload } from '@/lib/actions/dms.actions'
import { DmsDocumentList } from '@/components/dms/DmsDocumentList'
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
        bucketName: 'ema-dms', objectName,
        contentType: file.type || 'application/octet-stream', cacheControl: '3600',
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
  const [projectId, setProjectId] = useState('')
  const [uploadFolderId, setUploadFolderId] = useState('')
  const [profile, setProfile] = useState<'pv' | 'bess' | 'pv_bess'>('pv')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [newFolder, setNewFolder] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)

  const folderCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const document of documents) {
      if (document.folder_id) counts.set(document.folder_id, (counts.get(document.folder_id) ?? 0) + 1)
    }
    return counts
  }, [documents])
  const unassignedDocuments = useMemo(
    () => documents.filter((document) => !document.folder_id),
    [documents],
  )
  const unassignedCount = unassignedDocuments.length

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
      const { error } = await supabase.storage.from('ema-dms').upload(objectName, file, { contentType, cacheControl: '3600', upsert: false })
      if (error) throw error
      setProgress(100)
    }

    const registered = await registerDmsUpload({
      displayName: file.name.replace(/\.[^.]+$/, ''), fileName: file.name,
      filePath: objectName, fileSizeBytes: file.size, mimeType: contentType,
      sha256: fingerprint, folderId: uploadFolderId || null, projectId: projectId || null,
      documentType: 'sonstiges', isDataRoom: isZip,
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

  async function addFolder() {
    if (!newFolder.trim()) return
    setCreatingFolder(true)
    const result = await createDmsFolder(newFolder)
    setCreatingFolder(false)
    if (result.error) return toast.error(result.error)
    setNewFolder('')
    toast.success('Ordner wurde erstellt.')
    router.refresh()
  }

  return (
    <div className="space-y-5">
      <section className="dms-section rounded-[1.7rem] border border-white/10 p-4 shadow-sm md:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#8eee51]">Ablage</p>
            <h2 className="mt-1 text-xl font-extrabold text-white">Ordner</h2>
            <p className="mt-1 text-xs text-slate-400">Jeder Ordner öffnet sich auf einer eigenen Seite.</p>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <input value={newFolder} onChange={(event) => setNewFolder(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void addFolder() }} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#020e20]/60 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 sm:w-52" placeholder="Neuer Ordner" />
            <button type="button" onClick={() => void addFolder()} disabled={creatingFolder || !newFolder.trim()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#5CB800] text-white disabled:opacity-50" aria-label="Ordner erstellen">{creatingFolder ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-5 w-5" />}</button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          <Link href="/dms/folders/all" className="dms-folder-tile group flex aspect-square min-h-36 flex-col justify-between rounded-2xl border border-white/10 bg-white/[.045] p-4 text-white hover:border-[#8eee51]/40 hover:bg-white/[.075]">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#5CB800]/15 text-[#8eee51]"><Files className="h-5 w-5" /></span>
            <span><strong className="block text-sm font-extrabold">Alle Dokumente</strong><small className="mt-1 block text-xs text-slate-400">{documents.length} Dateien</small></span>
          </Link>
          <Link href="/dms/folders/unassigned" className="dms-folder-tile group flex aspect-square min-h-36 flex-col justify-between rounded-2xl border border-white/10 bg-white/[.045] p-4 text-white hover:border-[#8eee51]/40 hover:bg-white/[.075]">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400/15 text-amber-200"><Inbox className="h-5 w-5" /></span>
            <span><strong className="block text-sm font-extrabold">Ohne Ordner</strong><small className="mt-1 block text-xs text-slate-400">{unassignedCount} Dateien</small></span>
          </Link>
          {folders.map((folder) => (
            <Link key={folder.id} href={`/dms/folders/${folder.id}`} className="dms-folder-tile group flex aspect-square min-h-36 flex-col justify-between rounded-2xl border border-white/10 bg-white/[.045] p-4 text-white hover:border-[#8eee51]/40 hover:bg-white/[.075]">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-400/15 text-blue-200"><Folder className="h-5 w-5" /></span>
              <span className="min-w-0"><strong className="block break-words text-sm font-extrabold leading-snug">{folder.name}</strong><small className="mt-1 block text-xs text-slate-400">{folderCounts.get(folder.id) ?? 0} Dateien</small></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="dms-panel rounded-[1.7rem] border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="grid gap-3 md:grid-cols-3">
          <select value={uploadFolderId} onChange={(event) => setUploadFolderId(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-[#07142F]"><option value="">Upload ohne Ordner</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>In {folder.name}</option>)}</select>
          <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-[#07142F]"><option value="">Keinem Projekt zuordnen</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.label}</option>)}</select>
          <select value={profile} onChange={(event) => setProfile(event.target.value as typeof profile)} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-[#07142F]" title="DD-Prüfprofil"><option value="pv">DD: PV</option><option value="bess">DD: BESS</option><option value="pv_bess">DD: PV + BESS</option></select>
        </div>
        <input ref={fileInput} type="file" multiple className="hidden" accept=".zip,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.jpg,.jpeg,.png,.webp" onChange={(event) => void onFiles(event.target.files)} />
        <button type="button" onClick={() => fileInput.current?.click()} disabled={uploading} className="mt-3 flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[#5CB800] px-5 text-sm font-extrabold text-white shadow-[0_12px_30px_rgba(92,184,0,.24)] disabled:opacity-60">{uploading ? <><Loader2 className="h-5 w-5 animate-spin" /> Upload läuft · {progress}%</> : <><UploadCloud className="h-5 w-5" /> Dokumente oder ZIP-Datenraum hochladen</>}</button>
        <p className="mt-2 text-center text-xs text-slate-500">PDF, Office-Dateien, Bilder und ZIP · maximal 50 MB je Datei · Zielordner vor dem Upload auswählbar</p>
      </section>

      {dataRooms.length > 0 && (
        <section id="datenraeume" className="dms-section rounded-[1.7rem] border border-white/10 p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#8eee51]">Due Diligence</p><h2 className="mt-1 text-xl font-extrabold text-white">Datenräume</h2></div><FolderOpen className="h-6 w-6 text-[#8eee51]" /></div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{dataRooms.map((room) => <div key={room.id} className="dms-data-room-card flex min-h-44 flex-col justify-between rounded-2xl border border-blue-100 bg-[#071a32] p-4 text-white shadow-sm"><div className="flex items-start justify-between gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#5CB800]/15 text-[#8eee51]"><ShieldCheck className="h-5 w-5" /></span><span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[9px] font-extrabold uppercase tracking-wide text-slate-300">{room.status}</span></div><div><h3 className="mt-4 break-words text-sm font-extrabold">{room.name}</h3><p className="mt-1 text-[11px] text-slate-400">{room.file_count} Dateien · {bytesLabel(room.total_uncompressed_bytes)}</p><Link href={`/dms/data-rooms/${room.id}`} className="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold">DD öffnen <ChevronRight className="h-4 w-4" /></Link></div></div>)}</div>
        </section>
      )}

      <DmsDocumentList
        documents={unassignedDocuments}
        folders={folders}
        heading="Noch nicht einsortiert"
        description="Nur Dokumente ohne Ordner"
        emptyTitle="Alles ist aufgeräumt"
        emptyText="Alle Dokumente befinden sich bereits in einem Ordner."
      />
    </div>
  )
}
