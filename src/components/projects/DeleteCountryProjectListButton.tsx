'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Trash2 } from 'lucide-react'

export function DeleteCountryProjectListButton({ id, name }: { id: string; name: string }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    const confirmed = window.confirm(`„${name}“ wirklich löschen? Die PDF wird dauerhaft entfernt.`)
    if (!confirmed) return

    setDeleting(true)
    setError('')

    try {
      const response = await fetch(`/api/country-project-lists/${encodeURIComponent(id)}`, { method: 'DELETE' })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Die Projektliste konnte nicht gelöscht werden.')
      router.refresh()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Die Projektliste konnte nicht gelöscht werden.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-extrabold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        {deleting ? 'Wird gelöscht …' : 'Löschen'}
      </button>
      {error && <p className="mt-2 text-xs font-bold text-red-600">{error}</p>}
    </div>
  )
}
