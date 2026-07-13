'use client'

import { ChangeEvent, FormEvent, useMemo, useState } from 'react'
import { CheckCircle2, FileText, Loader2, Trash2, UploadCloud } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const MAX_FILES = 10
const MAX_FILE_SIZE = 25 * 1024 * 1024
const ALLOWED_TYPES = new Set([
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

type SelectedFile = { id: string; file: File; documentType: string }

function safeFileName(name: string) {
  return name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-')
}

export function PartnerReviewResponseForm({ submissionId, userId }: { submissionId: string; userId: string }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [files, setFiles] = useState<SelectedFile[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addFiles(event: ChangeEvent<HTMLInputElement>) {
    setError(null)
    const incoming = Array.from(event.target.files ?? [])
    if (files.length + incoming.length > MAX_FILES) {
      setError(`Es können höchstens ${MAX_FILES} Dateien nachgereicht werden.`)
      event.target.value = ''
      return
    }
    const invalid = incoming.find((file) => !ALLOWED_TYPES.has(file.type) || file.size > MAX_FILE_SIZE)
    if (invalid) {
      setError(`„${invalid.name}“ ist nicht erlaubt oder größer als 25 MB.`)
      event.target.value = ''
      return
    }
    setFiles((current) => [...current, ...incoming.map((file) => ({
      id: crypto.randomUUID(),
      file,
      documentType: file.type === 'application/pdf' ? 'sonstiges' : file.type.startsWith('image/') ? 'bild' : 'sonstiges',
    }))])
    event.target.value = ''
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(false)
    const form = new FormData(event.currentTarget)
    const response = String(form.get('partner_response') ?? '').trim()
    if (!response && files.length === 0) {
      setError('Bitte antworte auf die Rückfrage oder reiche mindestens eine Unterlage nach.')
      setSubmitting(false)
      return
    }

    const uploadedPaths: string[] = []
    try {
      for (const entry of files) {
        const path = `${userId}/${submissionId}/${crypto.randomUUID()}-${safeFileName(entry.file.name)}`
        const { error: uploadError } = await supabase.storage.from('partner-submissions').upload(path, entry.file, { upsert: false })
        if (uploadError) throw uploadError
        uploadedPaths.push(path)
      }

      if (files.length > 0) {
        const { error: documentError } = await supabase.from('submission_documents').insert(files.map((entry, index) => ({
          submission_id: submissionId,
          partner_user_id: userId,
          document_type: entry.documentType,
          display_name: entry.file.name,
          file_name: entry.file.name,
          file_path: uploadedPaths[index],
          file_size_bytes: entry.file.size,
          mime_type: entry.file.type,
        })))
        if (documentError) throw documentError
      }

      const { error: updateError } = await supabase.from('project_submissions').update({
        partner_response: response || 'Unterlagen wurden nachgereicht.',
        partner_responded_at: new Date().toISOString(),
        status: 'eingereicht',
      }).eq('id', submissionId).eq('partner_user_id', userId).eq('status', 'rueckfrage')
      if (updateError) throw updateError

      setSuccess(true)
      setFiles([])
      event.currentTarget.reset()
      router.refresh()
    } catch (caught) {
      if (uploadedPaths.length > 0) await supabase.storage.from('partner-submissions').remove(uploadedPaths)
      setError(caught instanceof Error ? caught.message : 'Die Nachreichung konnte nicht gespeichert werden.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-[1.75rem] border border-orange-200 bg-orange-50/70 p-5 sm:p-7">
      <div>
        <h2 className="text-xl font-extrabold text-[#1F2A44]">Rückfrage beantworten</h2>
        <p className="mt-1 text-sm text-slate-600">Antwort eintragen und fehlende Unterlagen direkt nachreichen.</p>
      </div>
      {success && <div className="flex gap-2 rounded-2xl bg-[#5CB800]/10 p-4 text-sm font-bold text-[#2F8A00]"><CheckCircle2 className="h-5 w-5" /> Antwort wurde an EMA übermittelt.</div>}
      {error && <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
      <textarea name="partner_response" rows={4} placeholder="Antwort an EMA …" className="w-full rounded-2xl border border-orange-200 bg-white px-4 py-3 outline-none focus:border-[#5CB800]" />
      <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-orange-200 bg-white px-4 text-center">
        <UploadCloud className="h-6 w-6 text-[#2F8A00]" />
        <span className="mt-2 text-sm font-extrabold">Fehlende Unterlagen auswählen</span>
        <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx" onChange={addFiles} className="sr-only" />
      </label>
      {files.map((entry) => (
        <div key={entry.id} className="rounded-2xl border border-orange-200 bg-white p-3">
          <div className="flex items-center gap-3"><FileText className="h-5 w-5" /><span className="min-w-0 flex-1 truncate text-sm font-bold">{entry.file.name}</span><button type="button" onClick={() => setFiles((current) => current.filter((item) => item.id !== entry.id))} className="rounded-xl p-2 text-red-600"><Trash2 className="h-4 w-4" /></button></div>
          <select value={entry.documentType} onChange={(event) => setFiles((current) => current.map((item) => item.id === entry.id ? { ...item, documentType: event.target.value } : item))} className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
            <option value="expose">Exposé</option><option value="lageplan">Lageplan</option><option value="netzanschluss">Netzanschluss</option><option value="pachtvertrag">Pachtvertrag</option><option value="genehmigung">Genehmigung</option><option value="gutachten">Gutachten</option><option value="bild">Bild</option><option value="sonstiges">Sonstiges</option>
          </select>
        </div>
      ))}
      <button type="submit" disabled={submitting} className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#5CB800] px-5 py-3.5 font-extrabold text-white disabled:opacity-60">
        {submitting ? <><Loader2 className="h-5 w-5 animate-spin" /> Wird übermittelt …</> : 'Antwort und Unterlagen senden'}
      </button>
    </form>
  )
}
