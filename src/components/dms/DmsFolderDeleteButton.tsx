'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { deleteDmsFolder } from '@/lib/actions/dms.actions'

export function DmsFolderDeleteButton({ folderId, folderName, compact = false, returnToDms = false }: { folderId: string; folderName: string; compact?: boolean; returnToDms?: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  async function remove() {
    if (busy || !window.confirm(`Ordner „${folderName}“ einschließlich Unterordner löschen? Alle enthaltenen Dateien bleiben unter „Ohne Ordner“ erhalten.`)) return
    setBusy(true)
    try {
      const result = await deleteDmsFolder(folderId)
      if (result.error) { toast.error(result.error); return }
      toast.success('Ordner gelöscht. Die Dateien bleiben erhalten.')
      if (returnToDms) router.push('/dms')
      router.refresh()
    } catch { toast.error('Ordner konnte nicht gelöscht werden. Bitte erneut versuchen.') }
    finally { setBusy(false) }
  }
  return <button type="button" onClick={() => void remove()} disabled={busy} aria-label={`Ordner ${folderName} löschen`} title="Ordner löschen · Dateien bleiben erhalten" className={compact ? 'absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-xl border border-red-300/20 bg-[#1c2436] text-red-200 hover:bg-red-400/20 disabled:opacity-40' : 'mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-300/20 px-3 text-xs font-bold text-red-200 disabled:opacity-40'}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}{!compact && 'Ordner löschen'}</button>
}
