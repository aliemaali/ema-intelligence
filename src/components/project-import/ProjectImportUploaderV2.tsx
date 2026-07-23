'use client'

import { useMemo, useState, useTransition } from 'react'
import { AlertTriangle, CheckCircle2, CloudUpload, FileText, FolderOpen, Image, Loader2, Sparkles, Trash2, X } from 'lucide-react'
import { prepareProjectImport, uploadProjectImportFiles } from '@/lib/actions/project-import.actions'
import { createVerifiedProjectFromImport } from '@/lib/actions/safe-project-import.actions'
import {
  isGermanProjectCountry,
  normalizeProjectCountry,
  PROJECT_COUNTRIES,
  sanitizeImportedLocationCity,
} from '@/lib/projects/location'

function plainNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return ''
  const number = Number(value)
  return Number.isFinite(number) ? String(number) : String(value).replace(/[^0-9,.-]/g, '')
}

function tariffNumber(value: unknown) {
  const raw = String(value ?? '').replace(/\s/g, '')
  const match = raw.match(/[0-9.,]+/)
  if (!match) return ''
  const normalized = match[0].includes(',') ? match[0].replace(/\./g, '').replace(',', '.') : match[0]
  const number = Number(normalized)
  if (!Number.isFinite(number)) return ''
  return String(number <= 1 ? number * 100 : number)
}

function yieldNumber(value: unknown) {
  const raw = String(value ?? '').replace(/\s/g, '')
  const match = raw.match(/[0-9.,]+/)
  if (!match) return ''
  const normalized = match[0].includes(',') ? match[0].replace(/\./g, '').replace(',', '.') : match[0]
  const number = Number(normalized)
  return Number.isFinite(number) ? String(number) : ''
}

const inputClass = 'mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-extrabold text-[#07142F] outline-none [color-scheme:light] focus:border-[#5CB800] focus:ring-2 focus:ring-[#5CB800]/15'

function InputField({ name, label, defaultValue = '', type = 'text', unit }: { name: string; label: string; defaultValue?: string; type?: string; unit?: string }) {
  return (
    <label className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">{label}</span>
      <div className="relative">
        <input name={name} type={type} step={type === 'number' ? 'any' : undefined} min={type === 'number' ? '0' : undefined} defaultValue={defaultValue} className={`${inputClass} ${unit ? 'pr-20' : ''}`} />
        {unit && <span className="absolute right-3 top-1/2 mt-1 -translate-y-1/2 text-xs font-bold text-slate-400">{unit}</span>}
      </div>
    </label>
  )
}

export function ProjectImportUploaderV2() {
  const [files, setFiles] = useState<File[]>([])
  const [importId, setImportId] = useState<string | null>(null)
  const [result, setResult] = useState<Record<string, any> | null>(null)
  const [locationCountry, setLocationCountry] = useState('Deutschland')
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  const raw = (result?.raw_result ?? {}) as Record<string, any>
  const importedFiles = Array.isArray(raw.data_room_files) ? raw.data_room_files : []
  const countryOptions = Array.from(new Set([locationCountry, ...PROJECT_COUNTRIES]))

  const warnings = useMemo(() => {
    const list: string[] = []
    const pv = Number(result?.pv_kwp)
    const price = Number(result?.purchase_price)
    const type = String(raw.plant_type ?? '').toLowerCase()
    if (Number.isFinite(pv) && type.includes('dach') && pv > 20000) list.push('Dachleistung wirkt unplausibel hoch. Einheit und Dezimaltrennzeichen prüfen.')
    if (Number.isFinite(price) && price > 1000000000) list.push('EK-Kaufpreis wirkt unplausibel hoch.')
    if ((result?.confidence_score ?? 0) < 0.7) list.push('Die Erkennung ist unsicher. Bitte alle Werte mit den Unterlagen vergleichen.')
    if (result?.location_city && !sanitizeImportedLocationCity(result.location_city)) list.push('Der erkannte Ort war nur eine Dokumentüberschrift und wurde deshalb geleert.')
    return list
  }, [result, raw.plant_type])

  function reset() {
    setImportId(null)
    setResult(null)
    setLocationCountry('Deutschland')
    setMessage('')
  }

  function analyze() {
    if (!files.length && !importId) return
    const data = new FormData()
    files.forEach((file) => data.append('files', file))
    startTransition(async () => {
      setMessage('Projektdateien werden analysiert ...')
      setResult(null)
      let id = importId
      if (!id) {
        const upload = await uploadProjectImportFiles(data)
        if ('error' in upload && upload.error) return setMessage(`Fehler: ${upload.error}`)
        id = 'importId' in upload ? upload.importId ?? null : null
        setImportId(id)
      }
      if (!id) return setMessage('Import-ID fehlt.')
      const response = await prepareProjectImport(id)
      if ('error' in response && response.error) return setMessage(`Fehler: ${response.error}`)
      const nextResult = 'result' in response ? response.result as Record<string, any> : null
      setResult(nextResult)
      setLocationCountry(normalizeProjectCountry(nextResult?.location_country ?? nextResult?.raw_result?.location_country))
      setMessage('Analyse abgeschlossen. Werte jetzt mit den Unterlagen prüfen und bei Bedarf ändern.')
    })
  }

  function createProject(formData: FormData) {
    startTransition(async () => {
      try {
        setMessage('Geprüfte Projektakte wird erstellt ...')
        const response = await createVerifiedProjectFromImport(formData)
        if (response?.error) setMessage(`Fehler: ${response.error}`)
      } catch (error) {
        if (!(error as Error).message?.includes('NEXT_REDIRECT')) setMessage('Projekt konnte nicht erstellt werden.')
      }
    })
  }

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="card-padded rounded-[2rem]">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#5CB800]/10 text-[#2F8A00]"><FolderOpen className="h-5 w-5" /></div>
          <div><h2 className="text-lg font-extrabold text-[#07142F]">Projektdateien importieren</h2><p className="text-sm text-slate-500">Exposé, PV-Sol, Wirtschaftlichkeit und weitere Unterlagen gemeinsam auswählen.</p></div>
        </div>

        <label className="flex min-h-[240px] cursor-pointer flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-[#5CB800]/35 bg-gradient-to-br from-[#5CB800]/8 via-white to-blue-50/70 p-6 text-center">
          <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.heic,.webp,.txt,image/*,application/pdf,text/plain" className="hidden" onChange={(event) => { setFiles(Array.from(event.target.files ?? [])); reset(); event.currentTarget.value = '' }} />
          <CloudUpload className="h-12 w-12 text-[#2F8A00]" />
          <p className="mt-4 text-2xl font-extrabold text-[#07142F]">Dateien hier ablegen</p>
          <p className="mt-2 text-sm text-slate-500">Mehrere Dateien gleichzeitig auswählen</p>
        </label>

        {files.length > 0 && <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between"><p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">{files.length} Dateien</p><button type="button" onClick={() => { setFiles([]); reset() }} className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1.5 text-xs font-extrabold text-red-600"><Trash2 className="h-3.5 w-3.5" /> Leeren</button></div>
          {files.map((file, index) => <div key={`${file.name}-${index}`} className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2 shadow-sm">{file.type.startsWith('image/') ? <Image className="h-5 w-5 text-[#2F8A00]" /> : <FileText className="h-5 w-5 text-[#132060]" />}<span className="min-w-0 flex-1 truncate text-sm font-bold text-[#07142F]">{file.name}</span><button type="button" onClick={() => { setFiles((current) => current.filter((_, i) => i !== index)); reset() }} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100"><X className="h-4 w-4" /></button></div>)}
        </div>}

        <button type="button" onClick={analyze} disabled={!files.length || isPending} className="btn-primary mt-5 w-full justify-center py-3 disabled:opacity-50">{isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />} Dateien analysieren</button>
        {message && <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm font-bold text-[#07142F]">{message}</p>}
      </section>

      <div className="space-y-5">
        {!result && <section className="card-padded rounded-[2rem]"><div className="flex items-center gap-3"><Sparkles className="h-5 w-5 text-[#5CB800]" /><h2 className="text-lg font-extrabold text-[#07142F]">Geprüfte Projekt-Vorschau</h2></div><p className="mt-4 text-sm leading-6 text-slate-500">Die KI legt kein Projekt ungeprüft an. Nach der Analyse kannst du jeden Wert manuell korrigieren.</p></section>}

        {result && <form action={createProject} className="card-padded rounded-[2rem] border border-[#5CB800]/30">
          <input type="hidden" name="import_id" value={importId ?? ''} />
          <div className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-[#5CB800]" /><div><h2 className="text-lg font-extrabold text-[#07142F]">Werte prüfen und korrigieren</h2><p className="text-sm text-slate-500">Nur diese bestätigten Werte werden ins Projekt und Exposé übernommen.</p></div></div>

          {warnings.length > 0 && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">{warnings.map((warning) => <p key={warning} className="flex gap-2 text-sm font-bold text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{warning}</p>)}</div>}

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InputField name="project_name" label="Projektname" defaultValue={String(result.project_name ?? '')} />
            <InputField name="plant_type" label="Anlagenart" defaultValue={String(raw.plant_type ?? '')} />
            <label className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">Land</span>
              <select name="location_country" value={locationCountry} onChange={(event) => setLocationCountry(event.target.value)} className={inputClass}>
                {countryOptions.map((country) => <option key={country} value={country}>{country}</option>)}
              </select>
            </label>
            <InputField name="location_city" label="Ort" defaultValue={sanitizeImportedLocationCity(result.location_city)} />
            {isGermanProjectCountry(locationCountry) && <InputField name="location_state" label="Bundesland" defaultValue={String(result.location_state ?? '')} />}
            <InputField name="pv_kwp" label="PV-Leistung" type="number" unit="kWp" defaultValue={plainNumber(result.pv_kwp)} />
            <InputField name="bess_mwh" label="BESS-Kapazität" type="number" unit="MWh" defaultValue={plainNumber(result.bess_mwh)} />
            <InputField name="purchase_price" label="EK-Kaufpreis" type="number" unit="€" defaultValue={plainNumber(result.purchase_price)} />
            <InputField name="feed_in_type" label="Einspeiseart" defaultValue={String(result.feed_in_type ?? '')} />
            <InputField name="tariff" label="Vergütung" type="number" unit="ct/kWh" defaultValue={tariffNumber(raw.tariff)} />
            <InputField name="specific_yield" label="Spezifischer Ertrag" type="number" unit="kWh/kWp" defaultValue={yieldNumber(raw.specific_yield)} />
          </div>

          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-[#5CB800]/25 bg-[#5CB800]/8 p-4"><input type="checkbox" name="confirmed" value="yes" required className="mt-1 h-5 w-5 accent-[#5CB800]" /><span className="text-sm font-bold leading-6 text-[#07142F]">Ich habe die Werte mit den Originalunterlagen geprüft. Das Projekt darf mit diesen Angaben angelegt werden.</span></label>
          <button type="submit" disabled={isPending} className="btn-primary mt-4 w-full justify-center py-3 disabled:opacity-50">{isPending ? 'Projekt wird erstellt ...' : 'Geprüftes Projekt anlegen'}</button>
        </form>}

        {importedFiles.length > 0 && <section className="card-padded rounded-[2rem]"><h2 className="text-lg font-extrabold text-[#07142F]">Analysierte Dateien</h2><div className="mt-3 space-y-2">{importedFiles.map((file: any, index: number) => <div key={`${file.name}-${index}`} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm"><FileText className="h-5 w-5 text-[#132060]" /><span className="min-w-0 flex-1 truncate text-sm font-bold text-[#07142F]">{file.name}</span><span className="text-xs font-bold text-[#2F8A00]">{file.status === 'read' ? 'gelesen' : file.status}</span></div>)}</div></section>}
      </div>
    </div>
  )
}
