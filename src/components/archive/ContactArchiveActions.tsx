'use client'

import { useState,useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RotateCcw,Trash2 } from 'lucide-react'
import { permanentlyDeleteArchivedContact,restoreArchivedContact,type ContactArchiveKind } from '@/lib/actions/contact-archive.actions'

export function ContactArchiveActions({ kind,id,name }:{ kind:ContactArchiveKind; id:string; name:string }) {
  const router = useRouter()
  const [pending,startTransition] = useTransition()
  const [error,setError] = useState('')

  function restore() {
    startTransition(async () => {
      const result = await restoreArchivedContact(kind,id)
      if (!result.success) return setError(result.error)
      router.refresh()
    })
  }

  function remove() {
    if (!window.confirm(`„${name}“ wirklich endgültig löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) return
    startTransition(async () => {
      const result = await permanentlyDeleteArchivedContact(kind,id)
      if (!result.success) return setError(result.error)
      router.refresh()
    })
  }

  return <div><div className="mt-4 grid grid-cols-2 gap-2"><button disabled={pending} onClick={restore} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#5CB800] px-3 py-2.5 text-sm font-extrabold text-white"><RotateCcw className="h-4 w-4" />Wiederherstellen</button><button disabled={pending} onClick={remove} className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-extrabold text-red-700"><Trash2 className="h-4 w-4" />Endgültig löschen</button></div>{error && <p role="alert" className="mt-2 text-xs font-bold text-red-700">{error}</p>}</div>
}
