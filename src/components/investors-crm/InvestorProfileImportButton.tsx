'use client'

import { useRef, useState, useTransition } from 'react'
import { FileUp, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { importInvestorProfilePdf } from '@/lib/actions/investor-profile-import.actions'

export function InvestorProfileImportButton({ mobile = false }: { mobile?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()
  const [fileName, setFileName] = useState('')

  function selectFile(file: File | undefined) {
    if (!file) return
    setFileName(file.name)
    const formData = new FormData()
    formData.append('file', file)

    startTransition(async () => {
      const result = await importInvestorProfilePdf(formData)
      if (!result.success) {
        toast.error(result.error)
        setFileName('')
        return
      }
      toast.success(`${result.data.companyName} wurde als Investor angelegt.`)
      window.location.assign(`/investors/${result.data.investorId}`)
    })
  }

  return (
    <>
      <button
        type="button"
        disabled={isPending}
        onClick={() => inputRef.current?.click()}
        className={mobile
          ? 'inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13px] font-semibold text-[#1B2C4E] shadow-sm disabled:opacity-60'
          : 'inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[13.5px] font-medium text-[#1B2C4E] shadow-sm transition hover:bg-slate-50 disabled:opacity-60'}
      >
        {isPending ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
        {isPending ? `Importiert ${fileName || 'PDF'} …` : 'Suchprofil importieren'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        disabled={isPending}
        onChange={(event) => {
          selectFile(event.target.files?.[0])
          event.currentTarget.value = ''
        }}
      />
    </>
  )
}
