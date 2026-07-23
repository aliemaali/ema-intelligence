'use client'

import { useRef, useState } from 'react'
import { CheckCircle2, FileText, FileUp, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  importInvestorProfilePdf,
  previewInvestorProfilePdf,
} from '@/lib/actions/investor-profile-import.actions'
import { INVESTOR_FOCUS_LABELS, type InvestorFocus } from '@/types/investors'

type ImportPreview = {
  fileName: string
  companyName: string
  contactPerson: string
  email: string
  phone: string | null
  positionTitle: string | null
  headquarters: string
  investmentVolumeMinEur: number | null
  investmentVolumeMaxEur: number | null
  focus: InvestorFocus
  technologies: string[]
  regions: string[]
  notes: string | null
}

type ImportStatus = 'idle' | 'previewing' | 'saving'

function formatEur(value: number | null) {
  if (value == null) return '–'
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function InvestorProfileImportButton({ mobile = false }: { mobile?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<ImportStatus>('idle')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)

  const busy = status !== 'idle'

  async function selectFile(file: File | undefined) {
    if (!file) return
    setStatus('previewing')

    const formData = new FormData()
    formData.append('file', file)

    try {
      const result = await previewInvestorProfilePdf(formData)
      if (!result.success) {
        toast.error(result.error)
        setSelectedFile(null)
        setPreview(null)
        return
      }

      setSelectedFile(file)
      setPreview(result.data)
    } finally {
      setStatus('idle')
    }
  }

  async function saveInvestor() {
    if (!selectedFile || !preview) return
    setStatus('saving')

    const formData = new FormData()
    formData.append('file', selectedFile)

    try {
      const result = await importInvestorProfilePdf(formData)
      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success(`${result.data.companyName} wurde als Investor gespeichert.`)
      window.location.assign(`/investors/${result.data.investorId}`)
    } finally {
      setStatus('idle')
    }
  }

  function closePreview() {
    if (busy) return
    setPreview(null)
    setSelectedFile(null)
  }

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className={mobile
          ? 'inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13px] font-semibold text-[#1B2C4E] shadow-sm disabled:opacity-60'
          : 'inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[13.5px] font-medium text-[#1B2C4E] shadow-sm transition hover:bg-slate-50 disabled:opacity-60'}
      >
        {status === 'previewing' ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
        {status === 'previewing' ? 'Suchprofil wird geprüft …' : 'Suchprofil importieren'}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        disabled={busy}
        onChange={(event) => {
          selectFile(event.target.files?.[0])
          event.currentTarget.value = ''
        }}
      />

      {preview && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="investor-import-title">
          <button type="button" className="absolute inset-0 bg-black/45" onClick={closePreview} aria-label="Vorschau schließen" />

          <div className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:max-w-xl sm:rounded-3xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#5CB800]">Noch nicht gespeichert</p>
                <h2 id="investor-import-title" className="mt-1 text-lg font-extrabold text-[#07142F]">Suchprofil prüfen</h2>
              </div>
              <button type="button" onClick={closePreview} disabled={busy} className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 disabled:opacity-50" aria-label="Schließen">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="flex items-start gap-3 rounded-2xl border border-[#5CB800]/20 bg-[#5CB800]/5 p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#5CB800]" />
                <p className="text-sm leading-6 text-slate-600">Die Angaben wurden aus dem PDF erkannt. Der Investor und die Originaldatei werden erst angelegt, wenn du unten auf <strong>Speichern</strong> tippst.</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <PreviewField label="Firmenname" value={preview.companyName} full />
                <PreviewField label="Ansprechpartner" value={preview.contactPerson} full />
                <PreviewField label="Position" value={preview.positionTitle || '–'} />
                <PreviewField label="Firmensitz" value={preview.headquarters || '–'} />
                <PreviewField label="E-Mail" value={preview.email} />
                <PreviewField label="Telefon" value={preview.phone || '–'} />
                <PreviewField label="Investitionsvolumen min." value={formatEur(preview.investmentVolumeMinEur)} />
                <PreviewField label="Investitionsvolumen max." value={formatEur(preview.investmentVolumeMaxEur)} />
                <PreviewField label="Fokus" value={INVESTOR_FOCUS_LABELS[preview.focus]} />
                <PreviewField label="Datei" value={preview.fileName} />
              </div>

              <PreviewBadges label="Technologien" values={preview.technologies} />
              <PreviewBadges label="Regionen" values={preview.regions} />

              {preview.notes && (
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Notizen</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{preview.notes}</p>
                </div>
              )}

              <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                <FileText className="h-4 w-4" /> Das PDF wird nach dem Speichern privat in der Investorenakte abgelegt.
              </div>
            </div>

            <div className="sticky bottom-0 grid grid-cols-2 gap-3 border-t border-slate-100 bg-white p-4">
              <button type="button" onClick={closePreview} disabled={busy} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 disabled:opacity-50">Abbrechen</button>
              <button type="button" onClick={saveInvestor} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#5CB800] px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50">
                {status === 'saving' && <Loader2 className="h-4 w-4 animate-spin" />}
                {status === 'saving' ? 'Speichert …' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function PreviewField({ label, value, full = false }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 ${full ? 'sm:col-span-2' : ''}`}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-[#1B2C4E]">{value}</p>
    </div>
  )
}

function PreviewBadges({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {values.length ? values.map((value) => (
          <span key={value} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{value}</span>
        )) : <span className="text-sm text-slate-400">Keine Angabe</span>}
      </div>
    </div>
  )
}
