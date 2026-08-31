'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Archive,
  Eye,
  FileArchive,
  FileSearch,
  FileText,
  FolderInput,
  MoreHorizontal,
  Pencil,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  archiveDmsDocument,
  moveDmsDocument,
  renameDmsDocument,
} from '@/lib/actions/dms.actions'
import type { DmsDocument, DmsFolder } from '@/lib/dms/types'

type Props = {
  documents: DmsDocument[]
  folders: DmsFolder[]
  heading?: string
  description?: string
  emptyTitle?: string
  emptyText?: string
}

type DialogState =
  | { kind: 'rename'; document: DmsDocument }
  | { kind: 'move'; document: DmsDocument }
  | null

function bytesLabel(bytes: number | null) {
  if (!bytes) return '—'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB`
}

function documentSource(document: DmsDocument) {
  if (document.source_app === 'ema_office') return 'EMA Office'
  if (document.source_kind === 'template') return 'Vorlage'
  return 'EMA Intelligence'
}

export function DmsDocumentList({
  documents,
  folders,
  heading = 'Zentrale Dokumente',
  description = 'Eine Datei, überall verfügbar',
  emptyTitle = 'Noch keine passenden Dokumente',
  emptyText = 'Lade ein Dokument hoch oder verschiebe eine Datei in diesen Ordner.',
}: Props) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogState>(null)
  const [renameValue, setRenameValue] = useState('')
  const [targetFolderId, setTargetFolderId] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('de-DE')
    if (!needle) return documents
    return documents.filter((document) =>
      [document.display_name, document.file_name, document.source_app, document.source_kind]
        .some((value) => value?.toLocaleLowerCase('de-DE').includes(needle)),
    )
  }, [documents, query])

  function openRename(document: DmsDocument) {
    setOpenMenuId(null)
    setRenameValue(document.display_name)
    setDialog({ kind: 'rename', document })
  }

  function openMove(document: DmsDocument) {
    setOpenMenuId(null)
    setTargetFolderId(document.folder_id ?? '')
    setDialog({ kind: 'move', document })
  }

  async function saveRename() {
    if (!dialog || dialog.kind !== 'rename') return
    setBusyId(dialog.document.id)
    const result = await renameDmsDocument(dialog.document.id, renameValue)
    setBusyId(null)
    if (result.error) return toast.error(result.error)
    toast.success('Dokument wurde umbenannt.')
    setDialog(null)
    router.refresh()
  }

  async function saveMove() {
    if (!dialog || dialog.kind !== 'move') return
    setBusyId(dialog.document.id)
    const result = await moveDmsDocument(dialog.document.id, targetFolderId || null)
    setBusyId(null)
    if (result.error) return toast.error(result.error)
    toast.success(targetFolderId ? 'Dokument wurde verschoben.' : 'Ordnerzuordnung wurde entfernt.')
    setDialog(null)
    router.refresh()
  }

  async function archiveDocument(document: DmsDocument) {
    setOpenMenuId(null)
    if (!window.confirm(`„${document.display_name}“ in den DMS-Papierkorb verschieben?`)) return
    setBusyId(document.id)
    const result = await archiveDmsDocument(document.id)
    setBusyId(null)
    if (result.error) return toast.error(result.error)
    toast.success('Dokument wurde in den Papierkorb verschoben.')
    router.refresh()
  }

  return (
    <>
      <section className="dms-panel dms-document-list overflow-hidden rounded-[1.7rem] border border-slate-200 bg-white shadow-sm">
        <div className="dms-list-header border-b border-slate-100 px-4 py-4 md:px-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-extrabold text-[#07142F]">{heading}</h2>
              <p className="mt-0.5 text-xs text-slate-500">{description}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-600">{filtered.length}</span>
          </div>
          <label className="relative mt-3 block">
            <FileSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#020e20]/60 py-2.5 pl-10 pr-3 text-sm font-medium text-white outline-none placeholder:text-slate-500 focus:border-[#5CB800]"
              placeholder="In diesem Bereich suchen …"
            />
          </label>
        </div>

        {filtered.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <FileSearch className="mx-auto h-10 w-10 text-slate-500" />
            <h3 className="mt-3 font-extrabold text-white">{emptyTitle}</h3>
            <p className="mt-1 text-sm text-slate-400">{emptyText}</p>
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {filtered.map((document) => {
              const menuOpen = openMenuId === document.id
              return (
                <article key={document.id} className="dms-document-row px-4 py-3.5 md:px-5">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${document.is_data_room_archive ? 'bg-violet-400/15 text-violet-200' : 'bg-emerald-400/15 text-emerald-200'}`}>
                      {document.is_data_room_archive ? <FileArchive className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                    </span>
                    <a
                      href={`/api/dms/documents/${document.id}/open`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-sm font-extrabold text-white">{document.display_name}</p>
                      <p className="mt-1 truncate text-xs text-slate-400">{bytesLabel(document.file_size_bytes)} · {documentSource(document)}</p>
                    </a>
                    {document.ai_analyzed && <span className="hidden rounded-full bg-[#5CB800]/10 px-2.5 py-1 text-[10px] font-extrabold text-[#8eee51] sm:inline">EMA gelesen</span>}
                    <button
                      type="button"
                      onClick={() => setOpenMenuId(menuOpen ? null : document.id)}
                      disabled={busyId === document.id}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-50"
                      aria-label={`Aktionen für ${document.display_name}`}
                      aria-expanded={menuOpen}
                    >
                      <MoreHorizontal className="h-5 w-5" />
                    </button>
                  </div>

                  {menuOpen && (
                    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/10 pt-3 sm:grid-cols-4">
                      <a href={`/api/dms/documents/${document.id}/open`} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white/5 px-3 text-xs font-extrabold text-white hover:bg-white/10"><Eye className="h-4 w-4 text-[#8eee51]" /> Vorschau</a>
                      <button type="button" onClick={() => openRename(document)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white/5 px-3 text-xs font-extrabold text-white hover:bg-white/10"><Pencil className="h-4 w-4 text-[#8eee51]" /> Umbenennen</button>
                      <button type="button" onClick={() => openMove(document)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white/5 px-3 text-xs font-extrabold text-white hover:bg-white/10"><FolderInput className="h-4 w-4 text-[#8eee51]" /> Verschieben</button>
                      <button type="button" onClick={() => void archiveDocument(document)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-400/10 px-3 text-xs font-extrabold text-red-200 hover:bg-red-400/15"><Archive className="h-4 w-4" /> Papierkorb</button>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>

      {dialog && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#010817]/80 p-3 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="dms-document-dialog-title">
          <div className="dms-panel w-full max-w-md rounded-[1.7rem] border border-white/10 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#8eee51]">Dokument bearbeiten</p>
                <h2 id="dms-document-dialog-title" className="mt-1 text-xl font-extrabold text-white">{dialog.kind === 'rename' ? 'Umbenennen' : 'In Ordner verschieben'}</h2>
              </div>
              <button type="button" onClick={() => setDialog(null)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-slate-300" aria-label="Fenster schließen"><X className="h-5 w-5" /></button>
            </div>
            <p className="mt-3 truncate text-sm text-slate-400">{dialog.document.display_name}</p>

            {dialog.kind === 'rename' ? (
              <input
                autoFocus
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') void saveRename() }}
                className="mt-4 w-full rounded-xl border border-white/10 bg-[#020e20]/70 px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#5CB800]"
                maxLength={160}
                aria-label="Neuer Dokumentname"
              />
            ) : (
              <select
                autoFocus
                value={targetFolderId}
                onChange={(event) => setTargetFolderId(event.target.value)}
                className="mt-4 w-full rounded-xl border border-white/10 bg-[#020e20]/70 px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#5CB800]"
                aria-label="Zielordner"
              >
                <option value="">Ohne Ordner</option>
                {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
              </select>
            )}

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setDialog(null)} className="min-h-12 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-extrabold text-white">Abbrechen</button>
              <button type="button" onClick={() => void (dialog.kind === 'rename' ? saveRename() : saveMove())} disabled={busyId === dialog.document.id || (dialog.kind === 'rename' && !renameValue.trim())} className="min-h-12 rounded-xl bg-[#5CB800] px-4 text-sm font-extrabold text-white shadow-[0_10px_25px_rgba(92,184,0,.22)] disabled:opacity-50">Speichern</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
