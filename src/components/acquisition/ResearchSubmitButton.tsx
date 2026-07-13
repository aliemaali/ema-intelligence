'use client'

import { useFormStatus } from 'react-dom'
import { Loader2, Search } from 'lucide-react'

export function ResearchSubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-[#5CB800] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4FA000] disabled:cursor-wait disabled:opacity-70 md:w-auto"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
      {pending ? 'Suche läuft …' : 'Suche starten'}
    </button>
  )
}
