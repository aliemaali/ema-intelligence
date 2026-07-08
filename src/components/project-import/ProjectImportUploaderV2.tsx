'use client'

import { useState, useTransition } from 'react'
import { BadgeEuro, CloudUpload, FileText, Image, Loader2, MapPin, Sparkles, Zap } from 'lucide-react'
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

  const upload = () => {
    const formData = new FormData()
    files.forEach((file) => formData.append('files', file))

    startTransition(async () => {
      setMessage('')
      const response = await uploadProjectImportFiles(formData)
      if ('error' in response && response.error) {
        setMessage(response.error)
        return
      }
      const id = 'importId' in response ? response.importId : null
      setImportId(id ?? null)
      setMessage('Dateien gespeichert. Du kannst jetzt die KI-Analyse starten.')
    })
  }

  const analyze = () => {
    if (!importId) return
    startTransition(async () => {
      setMessage('')
      const response = await analyzeProjectImport(importId)
      if ('error' in response && response.error) {
        setMessage(response.error)
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

        <label className="flex min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-[#5CB800]/35 bg-gradient-to-br from-[#5CB800]/8 via-white to-blue-50/70 p-6 text-center">
          <input
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.heic,image/*,application/pdf"
            className="hidden"
            onChange={(event) => {
              setFiles(Array.from(event.target.files ?? []))
              setImportId(null)
              setResult(null)
              setMessage('')
            }}
          />
          <CloudUpload className="h-12 w-12 text-[#2F8A00]" />
          <p className="mt-4 text-2xl font-extrabold text-[#07142F]">Projekt hier ablegen</p>
          <p className="mt-2 text-sm text-muted-foreground">Antippen und Datei auswählen</p>
        </label>

        {files.length > 0 && (
          <div className="mt-5 space-y-2">
            {files.map((file) => (
              <div key={`${file.name}-${file.size}`} className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2 shadow-sm">
                {file.type.startsWith('image/') ? <Image className="h-5 w-5 text-[#2F8A00]" /> : <FileText className="h-5 w-5 text-[#132060]" />}
                <span className="truncate text-sm font-bold text-[#07142F]">{file.name}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button type="button" onClick={upload} disabled={files.length === 0 || isPending} className="btn-primary justify-center py-3">
            {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <CloudUpload className="h-5 w-5" />} Speichern
          </button>
          <button type="button" onClick={analyze} disabled={!importId || isPending} className="rounded-xl bg-[#07142F] px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50">
            {isPending ? 'Bitte warten ...' : 'KI analysieren'}
          </button>
        </div>

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
            <button type="button" disabled={!result} className="btn-primary justify-center py-3">Projekt erstellen</button>
          </div>
        </div>
      </div>
    </div>
  )
}
