'use client'

import dynamic from 'next/dynamic'
import { ChangeEvent, FormEvent, useMemo, useState } from 'react'
import { FileText, Loader2, Trash2, UploadCloud } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const PartnerLocationMap = dynamic(
  () => import('./PartnerLocationMap').then((module) => module.PartnerLocationMap),
  { ssr: false, loading: () => <div className="h-72 animate-pulse rounded-2xl bg-slate-100" /> }
)

const MAX_FILES = 10
const MAX_FILE_SIZE = 25 * 1024 * 1024
const ALLOWED_TYPES = new Set(['application/pdf','image/jpeg','image/png','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
const FEDERAL_STATES = ['Baden-Württemberg','Bayern','Berlin','Brandenburg','Bremen','Hamburg','Hessen','Mecklenburg-Vorpommern','Niedersachsen','Nordrhein-Westfalen','Rheinland-Pfalz','Saarland','Sachsen','Sachsen-Anhalt','Schleswig-Holstein','Thüringen']
const EDITABLE_STATUSES = new Set(['eingereicht', 'in_pruefung', 'rueckfrage'])

const inputClass = 'mt-2 w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[#07142F] [color-scheme:light] outline-none focus:border-[#5CB800]'

type Position = { lat: number; lng: number }
type SelectedFile = { id: string; file: File; documentType: string }
type Submission = {
  id: string
  partner_user_id: string
  project_name: string
  project_type: string
  location_address: string | null
  location_city: string
  location_state: string | null
  location_lat: number | null
  location_lng: number | null
  pv_kwp: number | null
  bess_mw: number | null
  bess_mwh: number | null
  remuneration_model: string | null
  remuneration_ct_kwh: number | null
  ppa_term_years: number | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  notes: string | null
  status: string
}

function safeFileName(name: string) {
  return name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-')
}

function numberOrNull(value: FormDataEntryValue | null) {
  const raw = String(value ?? '').trim().replace(',', '.')
  if (!raw) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

async function notifyAdmin(submissionId: string, addedDocumentCount: number) {
  try {
    const response = await fetch('/api/partner-submission-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submissionId,
        event: addedDocumentCount > 0 ? 'documents_added' : 'updated',
        addedDocumentCount,
      }),
    })
    if (!response.ok) console.error('Partner notification failed:', await response.text())
  } catch (error) {
    console.error('Partner notification failed:', error)
  }
}

export function PartnerSubmissionEditForm({ submission, existingDocumentCount }: { submission: Submission; existingDocumentCount: number }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [files, setFiles] = useState<SelectedFile[]>([])
  const [position, setPosition] = useState<Position | null>(submission.location_lat != null && submission.location_lng != null ? { lat: Number(submission.location_lat), lng: Number(submission.location_lng) } : null)
  const [locationCity, setLocationCity] = useState(submission.location_city ?? '')
  const [locationState, setLocationState] = useState(submission.location_state ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const editable = EDITABLE_STATUSES.has(submission.status)

  function addFiles(event: ChangeEvent<HTMLInputElement>) {
    setError(null)
    const incoming = Array.from(event.target.files ?? [])
    if (existingDocumentCount + files.length + incoming.length > MAX_FILES) {
      setError(`Insgesamt sind höchstens ${MAX_FILES} Dateien pro Projekt möglich.`)
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
    if (!editable) return
    setSubmitting(true)
    setError(null)
    const form = new FormData(event.currentTarget)
    const projectName = String(form.get('project_name') ?? '').trim()
    const remunerationModel = String(form.get('remuneration_model') ?? '')
    const remunerationCtKwh = numberOrNull(form.get('remuneration_ct_kwh'))

    if (!projectName || !locationCity || !locationState || !position) {
      setError('Bitte Projektname, Stadt und Bundesland ausfüllen und den Standort auf der Karte bestätigen.')
      setSubmitting(false)
      return
    }
    if (!remunerationModel || remunerationCtKwh === null) {
      setError('Bitte Einspeiseart und Vergütung vollständig angeben.')
      setSubmitting(false)
      return
    }

    const uploadedPaths: string[] = []
    try {
      const { data: current, error: currentError } = await supabase.from('project_submissions').select('status, partner_user_id').eq('id', submission.id).single()
      if (currentError) throw currentError
      if (current.partner_user_id !== submission.partner_user_id || !EDITABLE_STATUSES.has(current.status)) throw new Error('Dieses Projekt kann nicht mehr bearbeitet werden.')

      for (const entry of files) {
        const path = `${submission.partner_user_id}/${submission.id}/${crypto.randomUUID()}-${safeFileName(entry.file.name)}`
        const { error: uploadError } = await supabase.storage.from('partner-submissions').upload(path, entry.file, { cacheControl: '3600', upsert: false })
        if (uploadError) throw uploadError
        uploadedPaths.push(path)
      }

      const { error: updateError } = await supabase.from('project_submissions').update({
        project_name: projectName,
        project_type: String(form.get('project_type') ?? 'pv_freiflaeche'),
        location_address: String(form.get('location_address') ?? '').trim() || null,
        location_city: locationCity.trim(),
        location_state: locationState,
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
      }).eq('id', submission.id).eq('partner_user_id', submission.partner_user_id)
      if (updateError) throw updateError

      if (files.length > 0) {
        const documents = files.map((entry, index) => ({ submission_id: submission.id, partner_user_id: submission.partner_user_id, document_type: entry.documentType, display_name: entry.file.name, file_name: entry.file.name, file_path: uploadedPaths[index], file_size_bytes: entry.file.size, mime_type: entry.file.type }))
        const { error: documentError } = await supabase.from('submission_documents').insert(documents)
        if (documentError) throw documentError
      }

      await notifyAdmin(submission.id, files.length)
      router.push(`/partner/submissions/${submission.id}`)
      router.refresh()
    } catch (caught) {
      if (uploadedPaths.length > 0) await supabase.storage.from('partner-submissions').remove(uploadedPaths)
      setError(caught instanceof Error ? caught.message : 'Die Änderungen konnten nicht gespeichert werden.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-xl font-extrabold">Projektdaten und Standort</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2"><span className="text-sm font-bold">Projektname *</span><input name="project_name" required defaultValue={submission.project_name} className={inputClass} /></label>
          <label><span className="text-sm font-bold">Projektart *</span><select name="project_type" defaultValue={submission.project_type} className={inputClass}><option value="pv_freiflaeche">PV-Freifläche</option><option value="pv_dach">PV-Dach</option><option value="bess">BESS</option><option value="hybrid">Hybrid</option></select></label>
          <label><span className="text-sm font-bold">Stadt *</span><input name="location_city" required value={locationCity} onChange={(e) => { setLocationCity(e.target.value); setPosition(null) }} className={inputClass} /></label>
          <label><span className="text-sm font-bold">Adresse</span><input name="location_address" defaultValue={submission.location_address ?? ''} className={inputClass} /></label>
          <label><span className="text-sm font-bold">Bundesland *</span><select name="location_state" required value={locationState} onChange={(e) => { setLocationState(e.target.value); setPosition(null) }} className={inputClass}><option value="">Bitte auswählen</option>{FEDERAL_STATES.map((state) => <option key={state} value={state}>{state}</option>)}</select></label>
          <label><span className="text-sm font-bold">PV-Leistung (kWp)</span><input name="pv_kwp" inputMode="decimal" defaultValue={submission.pv_kwp ?? ''} className={inputClass} /></label>
          <label><span className="text-sm font-bold">BESS-Leistung (MW)</span><input name="bess_mw" inputMode="decimal" defaultValue={submission.bess_mw ?? ''} className={inputClass} /></label>
          <label><span className="text-sm font-bold">BESS-Kapazität (MWh)</span><input name="bess_mwh" inputMode="decimal" defaultValue={submission.bess_mwh ?? ''} className={inputClass} /></label>
          <div className="sm:col-span-2"><PartnerLocationMap value={position} city={locationCity} state={locationState} onChange={setPosition} /></div>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-xl font-extrabold">EEG / Vermarktung</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label><span className="text-sm font-bold">Einspeiseart *</span><select name="remuneration_model" required defaultValue={submission.remuneration_model ?? ''} className={inputClass}><option value="">Bitte auswählen</option><option value="ppa">PPA</option><option value="volleinspeisung">Volleinspeisung</option><option value="teileinspeisung">Teileinspeisung</option></select></label>
          <label><span className="text-sm font-bold">Vergütung (ct/kWh) *</span><input name="remuneration_ct_kwh" required inputMode="decimal" defaultValue={submission.remuneration_ct_kwh ?? ''} className={inputClass} /></label>
          <label className="sm:col-span-2"><span className="text-sm font-bold">PPA-Laufzeit (Jahre)</span><input name="ppa_term_years" inputMode="numeric" defaultValue={submission.ppa_term_years ?? ''} className={inputClass} /></label>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-xl font-extrabold">Ansprechpartner und Hinweise</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label><span className="text-sm font-bold">Name</span><input name="contact_name" defaultValue={submission.contact_name ?? ''} className={inputClass} /></label>
          <label><span className="text-sm font-bold">E-Mail</span><input name="contact_email" type="email" defaultValue={submission.contact_email ?? ''} className={inputClass} /></label>
          <label><span className="text-sm font-bold">Telefon</span><input name="contact_phone" type="tel" defaultValue={submission.contact_phone ?? ''} className={inputClass} /></label>
          <label className="sm:col-span-2"><span className="text-sm font-bold">Hinweise</span><textarea name="notes" rows={4} defaultValue={submission.notes ?? ''} className={inputClass} /></label>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-start gap-3"><UploadCloud className="mt-0.5 h-6 w-6 text-[#2F8A00]" /><div><h2 className="text-xl font-extrabold">Unterlagen nachreichen</h2><p className="mt-1 text-sm text-slate-500">Vorhanden: {existingDocumentCount} von {MAX_FILES} Dateien. Bestehende Unterlagen bleiben erhalten.</p></div></div>
        <label className="mt-5 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white px-4 text-center hover:border-[#5CB800]/50"><UploadCloud className="h-7 w-7 text-[#2F8A00]" /><span className="mt-2 text-sm font-extrabold">Weitere Dateien auswählen oder fotografieren</span><input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx" onChange={addFiles} className="sr-only" /></label>
        {files.length > 0 && <div className="mt-4 space-y-3">{files.map((entry) => <div key={entry.id} className="rounded-2xl border border-slate-200 p-3"><div className="flex items-center gap-3"><FileText className="h-5 w-5 shrink-0" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{entry.file.name}</p><p className="text-xs text-slate-500">{(entry.file.size / 1024 / 1024).toFixed(1)} MB</p></div><button type="button" onClick={() => setFiles((current) => current.filter((item) => item.id !== entry.id))} className="rounded-xl p-2 text-red-600"><Trash2 className="h-5 w-5" /></button></div><select value={entry.documentType} onChange={(e) => setFiles((current) => current.map((item) => item.id === entry.id ? { ...item, documentType: e.target.value } : item))} className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><option value="expose">Exposé</option><option value="lageplan">Lageplan</option><option value="netzanschluss">Netzanschluss</option><option value="pachtvertrag">Pachtvertrag</option><option value="genehmigung">Genehmigung</option><option value="gutachten">Gutachten</option><option value="bild">Bild</option><option value="sonstiges">Sonstiges</option></select></div>)}</div>}
      </section>

      <button type="submit" disabled={submitting || !editable} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#5CB800] px-5 py-4 text-base font-extrabold text-white shadow-lg shadow-[#5CB800]/20 disabled:opacity-60">{submitting ? <><Loader2 className="h-5 w-5 animate-spin" /> Änderungen werden gespeichert …</> : 'Änderungen und Unterlagen speichern'}</button>
    </form>
  )
}
