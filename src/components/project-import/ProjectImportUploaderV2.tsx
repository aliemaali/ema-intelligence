'use client'

import { useState, useTransition } from 'react'
import { BadgeEuro, CloudUpload, FileText, FolderOpen, Image, Loader2, MapPin, Sparkles, Trash2, X, Zap } from 'lucide-react'
import { createProjectFromImport, prepareProjectImport, uploadProjectImportFiles } from '@/lib/actions/project-import.actions'

function text(v: unknown, fallback = '–') {
  if (v === null || v === undefined || v === '') return fallback
  return String(v)
}

function eur(v: unknown) {
  if (!v) return '–'
  const n = Number(v)
  return Number.isFinite(n) ? `${n.toLocaleString('de-DE')} €` : String(v)
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/80 bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-extrabold text-[#07142F]">{value}</p>
    </div>
  )
}

function InputField({ name, label, defaultValue = '' }: { name: string; label: string; defaultValue?: string }) {
  return (
    <label className="block rounded-2xl border border-border/80 bg-white px-4 py-3 shadow-sm">
      <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      <input name={name} defaultValue={defaultValue} className="mt-2 w-full bg-transparent text-sm font-extrabold text-[#07142F] outline-none" />
    </label>
  )
}

function FileStatus({ status }: { status?: string }) {
  const label = status === 'read' ? 'gelesen' : status === 'skipped' ? 'ohne Text' : status === 'error' ? 'Fehler' : 'gespeichert'
  const className = status === 'read'
    ? 'bg-[#5CB800]/10 text-[#2F8A00]'
    : status === 'error'
      ? 'bg-red-50 text-red-600'
      : 'bg-slate-100 text-slate-600'

  return <span className={`rounded-full px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] ${className}`}>{label}</span>
}

export function ProjectImportUploaderV2() {
  const [files, setFiles] = useState<File[]>([])
  const [importId, setImportId] = useState<string | null>(null)
  const [result, setResult] = useState<Record<string, any> | null>(null)
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  const raw = (result?.raw_result ?? {}) as Record<string, any>
  const tariff = text(raw.tariff, '')
  const specificYield = text(raw.specific_yield, '')
  const plantType = text(raw.plant_type, '')
  const importedFiles = Array.isArray(raw.data_room_files) ? raw.data_room_files : []

  const reset = () => {
    setImportId(null)
    setResult(null)
    setMessage('')
  }

  const clearFiles = () => {
    setFiles([])
    reset()
  }

  const uploadOnly = () => {
    if (!files.length) return
    const formData = new FormData()
    files.forEach((file) => formData.append('files', file))
    startTransition(async () => {
      setMessage('Dateien werden gespeichert ...')
      const response = await uploadProjectImportFiles(formData)
      if ('error' in response && response.error) return setMessage(`Fehler: ${response.error}`)
      const id = 'importId' in response ? response.importId : null
      setImportId(id ?? null)
      setMessage('Dateien gespeichert.')
    })
  }

  const readData = () => {
    if (!files.length && !importId) return
    const formData = new FormData()
    files.forEach((file) => formData.append('files', file))
    startTransition(async () => {
      setResult(null)
      setMessage('Projektdateien werden analysiert ...')
      let id = importId
      if (!id) {
        const uploadResponse = await uploadProjectImportFiles(formData)
        if ('error' in uploadResponse && uploadResponse.error) return setMessage(`Fehler: ${uploadResponse.error}`)
        id = 'importId' in uploadResponse ? uploadResponse.importId ?? null : null
        setImportId(id)
      }
      if (!id) return setMessage('Import-ID fehlt. Bitte Datei erneut auswählen.')
      const response = await prepareProjectImport(id)
      if ('error' in response && response.error) return setMessage(`Fehler: ${response.error}`)
      setResult('result' in response ? (response.result as Record<string, any>) : null)
      setMessage('Dateien wurden analysiert. Bitte prüfen.')
    })
  }

  const createProject = (formData: FormData) => {
    startTransition(async () => {
      try {
        setMessage('Projektakte wird erstellt ...')
        const response = await createProjectFromImport(formData)
        if (response?.error) setMessage(`Fehler beim Erstellen: ${response.error}`)
      } catch (error) {
        const err = error as Error
        if (!err.message?.includes('NEXT_REDIRECT')) setMessage('Fehler beim Erstellen der Projektakte.')
      }
    })
  }

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1fr]">
      <div className="card-padded rounded-[2rem]">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#5CB800]/10 text-[#2F8A00]"><FolderOpen className="h-5 w-5" /></div>
          <div>
            <h2 className="text-lg font-extrabold text-[#07142F]">Projektdateien importieren</h2>
            <p className="text-sm text-muted-foreground">Exposé, Fotos, Pläne, Netzunterlagen oder Screenshots auswählen.</p>
          </div>
        </div>

        <label className="flex min-h-[240px] cursor-pointer flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-[#5CB800]/35 bg-gradient-to-br from-[#5CB800]/8 via-white to-blue-50/70 p-6 text-center">
          <input
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.heic,.webp,.txt,image/*,application/pdf,text/plain"
            className="hidden"
            onChange={(event) => {
              setFiles(Array.from(event.target.files ?? []))
              reset()
              event.currentTarget.value = ''
            }}
          />
          <CloudUpload className="h-12 w-12 text-[#2F8A00]" />
          <p className="mt-4 text-2xl font-extrabold text-[#07142F]">Dateien hier ablegen</p>
          <p className="mt-2 text-sm text-muted-foreground">Mehrere Dateien gleichzeitig auswählen</p>
        </label>

        {files.length > 0 && (
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">{files.length} ausgewählte Datei{files.length !== 1 ? 'en' : ''}</p>
              <button type="button" onClick={clearFiles} className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1.5 text-xs font-extrabold text-red-600"><Trash2 className="h-3.5 w-3.5" /> Auswahl leeren</button>
            </div>
            {files.map((file, index) => (
              <div key={`${file.name}-${index}`} className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2 shadow-sm">
                {file.type.startsWith('image/') ? <Image className="h-5 w-5 text-[#2F8A00]" /> : <FileText className="h-5 w-5 text-[#132060]" />}
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-[#07142F]">{file.name}</span>
                <button type="button" onClick={() => { setFiles((current) => current.filter((_, i) => i !== index)); reset() }} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-muted-foreground"><X className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button type="button" onClick={uploadOnly} disabled={!files.length || isPending} className="rounded-xl bg-white px-4 py-3 text-sm font-extrabold text-[#07142F] shadow-sm ring-1 ring-border disabled:opacity-50">Nur speichern</button>
          <button type="button" onClick={readData} disabled={(!files.length && !importId) || isPending} className="btn-primary justify-center py-3 disabled:opacity-50">{isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />} Dateien analysieren</button>
        </div>
        {importId && <button type="button" onClick={readData} disabled={isPending} className="mt-3 w-full rounded-xl bg-[#07142F] px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50">Dateien erneut analysieren</button>}
        {message && <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm font-bold text-[#07142F]">{message}</p>}
      </div>

      <div className="space-y-5">
        <div className="card-padded rounded-[2rem]">
          <div className="mb-4 flex items-center gap-3"><Sparkles className="h-5 w-5 text-[#5CB800]" /><h2 className="text-lg font-extrabold text-[#07142F]">Projekt-Vorschau</h2></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="EMA-Projektnummer" value="Automatisch" />
            <Field label="Projektname" value={text(result?.project_name, 'Nicht erkannt')} />
            <Field label="PV-Leistung" value={result?.pv_kwp ? `${text(result.pv_kwp)} kWp` : 'Nicht erkannt'} />
            <Field label="EK-Preis" value={eur(result?.purchase_price)} />
            <Field label="Vergütung" value={tariff || 'Nicht erkannt'} />
            <Field label="Spezifischer Ertrag" value={specificYield || 'Nicht erkannt'} />
          </div>
        </div>

        {importedFiles.length > 0 && (
          <div className="card-padded rounded-[2rem]">
            <div className="mb-4 flex items-center gap-3"><FolderOpen className="h-5 w-5 text-[#5CB800]" /><h2 className="text-lg font-extrabold text-[#07142F]">Importierte Dateien</h2></div>
            <div className="space-y-2">
              {importedFiles.map((file: any, index: number) => (
                <div key={`${file.name}-${index}`} className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2 shadow-sm">
                  <FileText className="h-5 w-5 text-[#132060]" />
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-[#07142F]">{text(file.name, `Datei ${index + 1}`)}</span>
                  <FileStatus status={file.status} />
                </div>
              ))}
            </div>
          </div>
        )}

        {result && (
          <form action={createProject} className="card-padded rounded-[2rem] border-[#5CB800]/30">
            <input type="hidden" name="import_id" value={importId ?? ''} />
            <div className="mb-4 flex items-center gap-3"><FileText className="h-5 w-5 text-[#5CB800]" /><h2 className="text-lg font-extrabold text-[#07142F]">Daten prüfen und Projektakte erstellen</h2></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InputField name="project_name" label="Projektname" defaultValue={text(result?.project_name, '')} />
              <InputField name="plant_type" label="Anlagenart" defaultValue={plantType} />
              <InputField name="location_city" label="Ort" defaultValue={text(result?.location_city, '')} />
              <InputField name="location_state" label="Bundesland" defaultValue={text(result?.location_state, '')} />
              <InputField name="pv_kwp" label="PV-Leistung" defaultValue={result?.pv_kwp ? `${text(result.pv_kwp)} kWp` : ''} />
              <InputField name="bess_mwh" label="BESS-Leistung" defaultValue={result?.bess_mwh ? `${text(result.bess_mwh)} MWh` : ''} />
              <InputField name="feed_in_type" label="Einspeiseart" defaultValue={text(result?.feed_in_type, '')} />
              <InputField name="purchase_price" label="EK-Kaufpreis" defaultValue={result?.purchase_price ? eur(result.purchase_price) : ''} />
              <InputField name="tariff" label="Vergütung" defaultValue={tariff} />
              <InputField name="specific_yield" label="Spezifischer Ertrag" defaultValue={specificYield} />
            </div>
            <button type="submit" disabled={isPending} className="btn-primary mt-4 w-full justify-center py-3 disabled:opacity-50">
              {isPending ? 'Projektakte wird erstellt ...' : 'Projektakte erstellen'}
            </button>
          </form>
        )}

        <div className="card-padded rounded-[2rem]">
          <div className="mb-4 flex items-center gap-3"><MapPin className="h-5 w-5 text-[#5CB800]" /><h2 className="text-lg font-extrabold text-[#07142F]">Standort</h2></div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Adresse" value={text(result?.location_address)} />
            <Field label="Ort" value={text(result?.location_city)} />
            <Field label="Bundesland" value={text(result?.location_state)} />
            <Field label="GPS" value="–" />
          </div>
        </div>

        <div className="card-padded rounded-[2rem]">
          <div className="mb-4 flex items-center gap-3"><Zap className="h-5 w-5 text-[#5CB800]" /><h2 className="text-lg font-extrabold text-[#07142F]">Technische Daten</h2></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="PV-Leistung" value={result?.pv_kwp ? `${text(result.pv_kwp)} kWp` : '–'} />
            <Field label="BESS-Leistung" value={result?.bess_mwh ? `${text(result.bess_mwh)} MWh` : '–'} />
            <Field label="Einspeiseart" value={text(result?.feed_in_type, 'Voll / PPA')} />
          </div>
        </div>

        <div className="card-padded rounded-[2rem]">
          <div className="mb-4 flex items-center gap-3"><BadgeEuro className="h-5 w-5 text-[#5CB800]" /><h2 className="text-lg font-extrabold text-[#07142F]">Wirtschaftlich</h2></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="EK-Preis" value={eur(result?.purchase_price)} />
            <Field label="Vergütung" value={tariff || '–'} />
            <Field label="Spezifischer Ertrag" value={specificYield || '–'} />
          </div>
        </div>
      </div>
    </div>
  )
}
