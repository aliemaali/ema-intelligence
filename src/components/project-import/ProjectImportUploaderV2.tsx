'use client'

import { useState, useTransition } from 'react'
import { BadgeEuro, CloudUpload, FileText, Image, Loader2, MapPin, Sparkles, Trash2, X, Zap } from 'lucide-react'
import { analyzeProjectImport, uploadProjectImportFiles } from '@/lib/actions/project-import.actions'

function value(v: unknown, fallback = '–') {
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

export function ProjectImportUploaderV2() {
  const [files, setFiles] = useState<File[]>([])
  const [importId, setImportId] = useState<string | null>(null)
  const [result, setResult] = useState<Record<string, any> | null>(null)
  const [message, setMessage] = useState<string>('')
  const [isPending, startTransition] = useTransition()

  const resetImportState = () => {
    setImportId(null)
    setResult(null)
    setMessage('')
  }

  const removeFile = (index: number) => {
    setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))
    resetImportState()
  }

  const clearFiles = () => {
    setFiles([])
    resetImportState()
  }

  const uploadOnly = () => {
    if (files.length === 0) return
    const formData = new FormData()
    files.forEach((file) => formData.append('files', file))

    startTransition(async () => {
      setMessage('Dateien werden gespeichert ...')
      const response = await uploadProjectImportFiles(formData)
      if ('error' in response && response.error) {
        setMessage(`Fehler beim Speichern: ${response.error}`)
        return
      }
      const id = 'importId' in response ? response.importId : null
      setImportId(id ?? null)
      setMessage(id ? 'Dateien gespeichert. Du kannst jetzt die KI-Analyse starten.' : 'Upload gespeichert, aber Import-ID fehlt.')
    })
  }

  const analyzeOnly = (id: string) => {
    return analyzeProjectImport(id)
  }

  const uploadAndAnalyze = () => {
    if (files.length === 0) return
    const formData = new FormData()
    files.forEach((file) => formData.append('files', file))

    startTransition(async () => {
      setResult(null)
      setMessage('Datei wird gespeichert ...')

      let id = importId
      if (!id) {
        const uploadResponse = await uploadProjectImportFiles(formData)
        if ('error' in uploadResponse && uploadResponse.error) {
          setMessage(`Fehler beim Speichern: ${uploadResponse.error}`)
          return
        }
        id = 'importId' in uploadResponse ? uploadResponse.importId ?? null : null
        setImportId(id)
      }

      if (!id) {
        setMessage('Import-ID fehlt. Bitte Datei erneut auswählen.')
        return
      }

      setMessage('KI analysiert die Datei ...')
      const analysisResponse = await analyzeOnly(id)
      if ('error' in analysisResponse && analysisResponse.error) {
        setMessage(`Fehler bei der KI-Analyse: ${analysisResponse.error}`)
        return
      }
      setResult('result' in analysisResponse ? (analysisResponse.result as Record<string, any>) : null)
      setMessage('KI-Analyse abgeschlossen. Bitte Daten prüfen.')
    })
  }

  const analyzeExisting = () => {
    if (!importId) return
    startTransition(async () => {
      setMessage('KI analysiert die Datei ...')
      const response = await analyzeOnly(importId)
      if ('error' in response && response.error) {
        setMessage(`Fehler bei der KI-Analyse: ${response.error}`)
        return
      }
      setResult('result' in response ? (response.result as Record<string, any>) : null)
      setMessage('KI-Analyse abgeschlossen. Bitte Daten prüfen.')
    })
  }

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1fr]">
      <div className="card-padded rounded-[2rem]">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#5CB800]/10 text-[#2F8A00]"><CloudUpload className="h-5 w-5" /></div>
          <div>
            <h2 className="text-lg font-extrabold text-[#07142F]">Datei hochladen</h2>
            <p className="text-sm text-muted-foreground">PDF, Word, Excel, Foto oder Screenshot auswählen.</p>
          </div>
        </div>

        <label className="flex min-h-[240px] cursor-pointer flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-[#5CB800]/35 bg-gradient-to-br from-[#5CB800]/8 via-white to-blue-50/70 p-6 text-center sm:min-h-[280px]">
          <input
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.heic,image/*,application/pdf"
            className="hidden"
            onChange={(event) => {
              setFiles(Array.from(event.target.files ?? []))
              resetImportState()
              event.currentTarget.value = ''
            }}
          />
          <CloudUpload className="h-12 w-12 text-[#2F8A00]" />
          <p className="mt-4 text-2xl font-extrabold text-[#07142F]">Projekt hier ablegen</p>
          <p className="mt-2 text-sm text-muted-foreground">Antippen und Datei auswählen</p>
        </label>

        {files.length > 0 && (
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">Ausgewählte Dateien</p>
              <button type="button" onClick={clearFiles} className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1.5 text-xs font-extrabold text-red-600">
                <Trash2 className="h-3.5 w-3.5" /> Auswahl leeren
              </button>
            </div>
            {files.map((file, index) => (
              <div key={`${file.name}-${file.size}-${index}`} className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2 shadow-sm">
                {file.type.startsWith('image/') ? <Image className="h-5 w-5 text-[#2F8A00]" /> : <FileText className="h-5 w-5 text-[#132060]" />}
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-[#07142F]">{file.name}</span>
                <button type="button" onClick={() => removeFile(index)} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-muted-foreground" aria-label="Datei entfernen">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button type="button" onClick={uploadOnly} disabled={files.length === 0 || isPending} className="rounded-xl bg-white px-4 py-3 text-sm font-extrabold text-[#07142F] shadow-sm ring-1 ring-border disabled:opacity-50">
            Nur speichern
          </button>
          <button type="button" onClick={uploadAndAnalyze} disabled={files.length === 0 || isPending} className="btn-primary justify-center py-3 disabled:opacity-50">
            {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />} Speichern & KI analysieren
          </button>
        </div>

        {importId && (
          <button type="button" onClick={analyzeExisting} disabled={isPending} className="mt-3 w-full rounded-xl bg-[#07142F] px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50">
            KI erneut analysieren
          </button>
        )}

        {message && <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm font-bold text-[#07142F]">{message}</p>}
      </div>

      <div className="space-y-5">
        <div className="card-padded rounded-[2rem]">
          <div className="mb-4 flex items-center gap-3"><Sparkles className="h-5 w-5 text-[#5CB800]" /><h2 className="text-lg font-extrabold text-[#07142F]">Projekt-Vorschau</h2></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="EMA-Projektnummer" value="Automatisch" />
            <Field label="Partner-Projektnummer" value={value(result?.partner_project_number, 'Aus Exposé')} />
            <Field label="Partner" value={value(result?.detected_partner_name, 'Erkennung')} />
            <Field label="Projektname" value={value(result?.project_name, 'Aus Exposé')} />
          </div>
        </div>

        <div className="card-padded rounded-[2rem]">
          <div className="mb-4 flex items-center gap-3"><MapPin className="h-5 w-5 text-[#5CB800]" /><h2 className="text-lg font-extrabold text-[#07142F]">Standort</h2></div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Adresse" value={value(result?.location_address)} />
            <Field label="Ort" value={value(result?.location_city)} />
            <Field label="Bundesland" value={value(result?.location_state)} />
            <Field label="GPS" value={result?.location_lat && result?.location_lng ? `${result.location_lat}, ${result.location_lng}` : '–'} />
          </div>
        </div>

        <div className="card-padded rounded-[2rem]">
          <div className="mb-4 flex items-center gap-3"><Zap className="h-5 w-5 text-[#5CB800]" /><h2 className="text-lg font-extrabold text-[#07142F]">Technische Daten</h2></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="PV-Leistung" value={result?.pv_kwp ? `${value(result.pv_kwp)} kWp` : '–'} />
            <Field label="BESS-Leistung" value={result?.bess_mwh ? `${value(result.bess_mwh)} MWh` : '–'} />
            <Field label="Einspeiseart" value={value(result?.feed_in_type, 'Voll / PPA')} />
          </div>
        </div>

        <div className="card-padded rounded-[2rem]">
          <div className="mb-4 flex items-center gap-3"><BadgeEuro className="h-5 w-5 text-[#5CB800]" /><h2 className="text-lg font-extrabold text-[#07142F]">Wirtschaftlich</h2></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="EK-Preis" value={eur(result?.purchase_price)} />
            <button type="button" disabled={!result} className="btn-primary justify-center py-3 disabled:opacity-50">Projekt erstellen</button>
          </div>
        </div>
      </div>
    </div>
  )
}
