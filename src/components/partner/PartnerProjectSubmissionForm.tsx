'use client'

import dynamic from 'next/dynamic'
import { ChangeEvent, FormEvent, useMemo, useState } from 'react'
import { CheckCircle2, FileText, Loader2, Trash2, UploadCloud } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const PartnerLocationMap = dynamic(
  () => import('./PartnerLocationMap').then((module) => module.PartnerLocationMap),
  { ssr: false, loading: () => <div className="h-72 animate-pulse rounded-2xl bg-slate-100" /> }
)

const MAX_FILES = 10
const MAX_FILE_SIZE = 25 * 1024 * 1024
const ALLOWED_TYPES = new Set(['application/pdf','image/jpeg','image/png','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])

type SelectedFile = { id: string; file: File; documentType: string }
type Position = { lat: number; lng: number }

function safeFileName(name: string) {
  return name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-')
}

function numberOrNull(value: FormDataEntryValue | null) {
  const raw = String(value ?? '').trim().replace(',', '.')
  if (!raw) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

const inputClass = 'mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-[#5CB800]'

export function PartnerProjectSubmissionForm({ userId }: { userId: string }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [files, setFiles] = useState<SelectedFile[]>([])
  const [position, setPosition] = useState<Position | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addFiles(event: ChangeEvent<HTMLInputElement>) {
    setError(null)
    const incoming = Array.from(event.target.files ?? [])
    if (files.length + incoming.length > MAX_FILES) {
      setError(`Es können höchstens ${MAX_FILES} Dateien hochgeladen werden.`)
      event.target.value = ''
      return
    }
    const invalid = incoming.find((file) => !ALLOWED_TYPES.has(file.type) || file.size > MAX_FILE_SIZE)
    if (invalid) {
      setError(`„${invalid.name}“ ist nicht erlaubt oder größer als 25 MB.`)
      event.target.value = ''
      return
    }
    setFiles((current) => [...current, ...incoming.map((file) => ({ id: crypto.randomUUID(), file, documentType: file.type === 'application/pdf' ? 'expose' : file.type.startsWith('image/') ? 'bild' : 'sonstiges' }))])
    event.target.value = ''
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(false)

    const form = new FormData(event.currentTarget)
    const projectName = String(form.get('project_name') ?? '').trim()
    const locationCity = String(form.get('location_city') ?? '').trim()
    const remunerationModel = String(form.get('remuneration_model') ?? '')
    const remunerationCtKwh = numberOrNull(form.get('remuneration_ct_kwh'))

    if (!projectName || !locationCity || !position) {
      setError('Bitte Projektname und Ort ausfüllen und den Standort auf der Karte markieren.')
      setSubmitting(false)
      return
    }
    if (!remunerationModel || remunerationCtKwh === null) {
      setError('Bitte Einspeiseart und Vergütung vollständig angeben.')
      setSubmitting(false)
      return
    }

    const submissionId = crypto.randomUUID()
    const uploadedPaths: string[] = []

    try {
      for (const entry of files) {
        const path = `${userId}/${submissionId}/${crypto.randomUUID()}-${safeFileName(entry.file.name)}`
        const { error: uploadError } = await supabase.storage.from('partner-submissions').upload(path, entry.file, { cacheControl: '3600', upsert: false })
        if (uploadError) throw uploadError
        uploadedPaths.push(path)
      }

      const { error: submissionError } = await supabase.from('project_submissions').insert({
        id: submissionId,
        partner_user_id: userId,
        project_name: projectName,
        project_type: String(form.get('project_type') ?? 'pv_freiflaeche'),
        location_address: String(form.get('location_address') ?? '').trim() || null,
        location_city: locationCity,
        location_state: String(form.get('location_state') ?? '').trim() || null,
        location_lat: position.lat,
        location_lng: position.lng,
        pv_kwp: numberOrNull(form.get('pv_kwp')),
        bess_mw: numberOrNull(form.get('bess_mw')),
        bess_mwh: numberOrNull(form.get('bess_mwh')),
        remuneration_model: remunerationModel,
        remuneration_ct_kwh: remunerationCtKwh,
        ppa_term_years: remunerationModel === 'ppa' ? numberOrNull(form.get('ppa_term_years')) : null,
        contact_name: String(form.get('contact_name') ?? '').trim() || null,
        contact_email: String(form.get('contact_email') ?? '').trim() || null,
        contact_phone: String(form.get('contact_phone') ?? '').trim() || null,
        notes: String(form.get('notes') ?? '').trim() || null,
        status: 'eingereicht',
      })
      if (submissionError) throw submissionError

      if (files.length > 0) {
        const documents = files.map((entry, index) => ({ submission_id: submissionId, partner_user_id: userId, document_type: entry.documentType, display_name: entry.file.name, file_name: entry.file.name, file_path: uploadedPaths[index], file_size_bytes: entry.file.size, mime_type: entry.file.type }))
        const { error: documentError } = await supabase.from('submission_documents').insert(documents)
        if (documentError) throw documentError
      }

      setSuccess(true)
      setFiles([])
      setPosition(null)
      event.currentTarget.reset()
      router.refresh()
    } catch (caught) {
      if (uploadedPaths.length > 0) await supabase.storage.from('partner-submissions').remove(uploadedPaths)
      await supabase.from('project_submissions').delete().eq('id', submissionId).eq('partner_user_id', userId)
      setError(caught instanceof Error ? caught.message : 'Die Einreichung konnte nicht gespeichert werden.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {success && <div className="flex items-start gap-3 rounded-2xl border border-[#5CB800]/25 bg-[#5CB800]/10 p-4 text-sm font-semibold text-[#2F8A00]"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />Das Projekt wurde sicher an EMA Enterprise übermittelt.</div>}
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

      <section className="rounded-[1.75rem] bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-xl font-extrabold text-[#1F2A44]">Projektdaten und Standort</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2"><span className="text-sm font-bold">Projektname *</span><input name="project_name" required className={inputClass} /></label>
          <label><span className="text-sm font-bold">Projektart *</span><select name="project_type" className={inputClass}><option value="pv_freiflaeche">PV-Freifläche</option><option value="pv_dach">PV-Dach</option><option value="bess">BESS</option><option value="hybrid">Hybrid</option></select></label>
          <label><span className="text-sm font-bold">Ort *</span><input name="location_city" required className={inputClass} /></label>
          <label><span className="text-sm font-bold">Adresse</span><input name="location_address" className={inputClass} /></label>
          <label><span className="text-sm font-bold">Bundesland</span><input name="location_state" className={inputClass} /></label>
          <label><span className="text-sm font-bold">PV-Leistung (kWp)</span><input name="pv_kwp" inputMode="decimal" className={inputClass} /></label>
          <label><span className="text-sm font-bold">BESS-Leistung (MW)</span><input name="bess_mw" inputMode="decimal" className={inputClass} /></label>
          <label><span className="text-sm font-bold">BESS-Kapazität (MWh)</span><input name="bess_mwh" inputMode="decimal" className={inputClass} /></label>
          <div className="sm:col-span-2"><PartnerLocationMap value={position} onChange={setPosition} /></div>
        </div>
      </section>

      <section className="rounded-[1.75rem] bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-xl font-extrabold text-[#1F2A44]">EEG / Vermarktung</h2>
        <p className="mt-1 text-sm text-slate-500">Einspeiseart und tatsächlich vereinbarte Vergütung erfassen.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label><span className="text-sm font-bold">Einspeiseart *</span><select name="remuneration_model" required className={inputClass}><option value="">Bitte auswählen</option><option value="ppa">PPA</option><option value="volleinspeisung">Volleinspeisung</option><option value="teileinspeisung">Teileinspeisung</option></select></label>
          <label><span className="text-sm font-bold">Vergütung (ct/kWh) *</span><input name="remuneration_ct_kwh" required inputMode="decimal" placeholder="z. B. 6,20" className={inputClass} /></label>
          <label className="sm:col-span-2"><span className="text-sm font-bold">PPA-Laufzeit (Jahre, nur bei PPA)</span><input name="ppa_term_years" inputMode="numeric" className={inputClass} /></label>
        </div>
      </section>

      <section className="rounded-[1.75rem] bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-xl font-extrabold text-[#1F2A44]">Ansprechpartner</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label><span className="text-sm font-bold">Name</span><input name="contact_name" className={inputClass} /></label>
          <label><span className="text-sm font-bold">E-Mail</span><input name="contact_email" type="email" className={inputClass} /></label>
          <label><span className="text-sm font-bold">Telefon</span><input name="contact_phone" type="tel" className={inputClass} /></label>
          <label className="sm:col-span-2"><span className="text-sm font-bold">Hinweise</span><textarea name="notes" rows={4} className={inputClass} /></label>
        </div>
      </section>

      <section className="rounded-[1.75rem] bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-start gap-3"><UploadCloud className="mt-0.5 h-6 w-6 text-[#2F8A00]" /><div><h2 className="text-xl font-extrabold text-[#1F2A44]">Exposé und Unterlagen</h2><p className="mt-1 text-sm text-slate-500">PDF, Bilder, Word oder Excel · maximal 10 Dateien · je 25 MB</p></div></div>
        <label className="mt-5 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 text-center hover:border-[#5CB800]/50"><UploadCloud className="h-7 w-7 text-[#2F8A00]" /><span className="mt-2 text-sm font-extrabold">Dateien auswählen oder fotografieren</span><input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx" onChange={addFiles} className="sr-only" /></label>
        {files.length > 0 && <div className="mt-4 space-y-3">{files.map((entry) => <div key={entry.id} className="rounded-2xl border border-slate-200 p-3"><div className="flex items-center gap-3"><FileText className="h-5 w-5 shrink-0" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{entry.file.name}</p><p className="text-xs text-slate-500">{(entry.file.size / 1024 / 1024).toFixed(1)} MB</p></div><button type="button" onClick={() => setFiles((current) => current.filter((item) => item.id !== entry.id))} className="rounded-xl p-2 text-red-600"><Trash2 className="h-5 w-5" /></button></div><select value={entry.documentType} onChange={(event) => setFiles((current) => current.map((item) => item.id === entry.id ? { ...item, documentType: event.target.value } : item))} className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><option value="expose">Exposé</option><option value="lageplan">Lageplan</option><option value="netzanschluss">Netzanschluss</option><option value="pachtvertrag">Pachtvertrag</option><option value="genehmigung">Genehmigung</option><option value="gutachten">Gutachten</option><option value="bild">Bild</option><option value="sonstiges">Sonstiges</option></select></div>)}</div>}
      </section>

      <button type="submit" disabled={submitting} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#5CB800] px-5 py-4 text-base font-extrabold text-white shadow-lg shadow-[#5CB800]/20 disabled:opacity-60">{submitting ? <><Loader2 className="h-5 w-5 animate-spin" /> Wird sicher übermittelt …</> : 'Projekt an EMA übermitteln'}</button>
    </form>
  )
}
