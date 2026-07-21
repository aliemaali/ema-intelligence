'use client'

import { useMemo, useState, useTransition } from 'react'
import { AlertTriangle, CheckCircle2, CloudUpload, FileText, FolderOpen, Image, Loader2, ShieldCheck, Sparkles, Trash2, X } from 'lucide-react'
import {
  createVerifiedProjectFromImport,
  prepareVerifiedProjectImport,
  uploadProjectImportFiles,
} from '@/lib/actions/project-import-safe.actions'

function text(value: unknown, fallback = '') {
  if (value === null || value === undefined || value === '') return fallback
  return String(value)
}

function money(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? `${number.toLocaleString('de-DE', { maximumFractionDigits: 2 })} €` : text(value)
}

function InputField({ name, label, defaultValue = '', hint }: { name: string; label: string; defaultValue?: string; hint?: string }) {
  return (
    <label className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm focus-within:border-[#5CB800] focus-within:ring-2 focus-within:ring-[#5CB800]/10">
      <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <input name={name} defaultValue={defaultValue} className="mt-2 w-full bg-transparent text-sm font-extrabold text-[#07142F] outline-none" />
      {hint && <span className="mt-1 block text-[11px] font-semibold text-slate-400">{hint}</span>}
    </label>
  )
}

function FileStatus({ status }: { status?: string }) {
  const label = status === 'read' ? 'gelesen' : status === 'error' ? 'Fehler' : 'gespeichert'
  return <span className={`rounded-full px-2 py-1 text-[10px] font-extrabold uppercase ${status === 'read' ? 'bg-[#5CB800]/10 text-[#2F8A00]' : status === 'error' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'}`}>{label}</span>
}

export function ProjectImportUploaderV2() {
  const [files, setFiles] = useState<File[]>([])
  const [importId, setImportId] = useState<string | null>(null)
  const [result, setResult] = useState<Record<string, any> | null>(null)
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  const raw = result?.raw_result ?? {}
  const tariff = text(raw.tariff)
  const specificYield = text(raw.specific_yield)
  const plantType = text(raw.plant_type)
  const importedFiles = Array.isArray(raw.data_room_files) ? raw.data_room_files : []

  const warnings = useMemo(() => {
    const items: string[] = []
    const pv = Number(result?.pv_kwp)
    const price = Number(result?.purchase_price)
    const type = plantType.toLowerCase()
    if (Number.isFinite(pv) && pv > 20_000 && (type.includes('dach') || type.includes('aufdach'))) items.push('Ungewöhnlich hohe PV-Leistung für ein Dachprojekt.')
    if (Number.isFinite(price) && price > 100_000_000) items.push('Ungewöhnlich hoher Kaufpreis. Deutsches Zahlenformat prüfen.')
    if (!result?.pv_kwp) items.push('PV-Leistung wurde nicht sicher erkannt.')
    if (!result?.purchase_price) items.push('Kaufpreis wurde nicht sicher erkannt.')
    if (!tariff) items.push('Vergütung wurde nicht sicher erkannt.')
    if (!specificYield) items.push('Spezifischer Ertrag wurde nicht sicher erkannt.')
    return items
  }, [result, plantType, tariff, specificYield])

  function reset() {
    setImportId(null)
    setResult(null)
    setMessage('')
  }

  function uploadOnly() {
    if (!files.length) return
    const formData = new FormData()
    files.forEach((file) => formData.append('files', file))
    startTransition(async () => {
      setMessage('Dateien werden gespeichert ...')
      const response = await uploadProjectImportFiles(formData)
      if ('error' in response && response.error) return setMessage(`Fehler: ${response.error}`)
      setImportId('importId' in response ? response.importId ?? null : null)
      setMessage('Dateien gespeichert.')
    })
  }

  function analyse() {
    if (!files.length && !importId) return
    const formData = new FormData()
    files.forEach((file) => formData.append('files', file))
    startTransition(async () => {
      setMessage('Projektdateien werden analysiert ...')
      let id = importId
      if (!id) {
        const uploaded = await uploadProjectImportFiles(formData)
        if ('error' in uploaded && uploaded.error) return setMessage(`Fehler: ${uploaded.error}`)
        id = 'importId' in uploaded ? uploaded.importId ?? null : null
        setImportId(id)
      }
      if (!id) return setMessage('Import-ID fehlt.')
      const response = await prepareVerifiedProjectImport(id)
      if ('error' in response && response.error) return setMessage(`Fehler: ${response.error}`)
      setResult((response as any).result ?? null)
      setMessage('Analyse abgeschlossen. Bitte alle Werte mit den Originalunterlagen vergleichen.')
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
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#5CB800]/10 text-[#2F8A00]"><FolderOpen className="h-5 w-5" /></span>
          <div><h2 className="text-lg font-extrabold text-[#07142F]">Projektdateien importieren</h2><p className="text-sm text-muted-foreground">Die Analyse schlägt Werte vor. Gespeichert wird erst nach deiner Bestätigung.</p></div>
        </div>

        <label className="flex min-h-[230px] cursor-pointer flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-[#5CB800]/35 bg-gradient-to-br from-[#5CB800]/8 via-white to-blue-50/70 p-6 text-center">
          <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.heic,.webp,.txt,image/*,application/pdf,text/plain" className="hidden" onChange={(event) => { setFiles(Array.from(event.target.files ?? [])); reset(); event.currentTarget.value = '' }} />
          <CloudUpload className="h-12 w-12 text-[#2F8A00]" />
          <p className="mt-4 text-2xl font-extrabold text-[#07142F]">Dateien auswählen</p>
          <p className="mt-2 text-sm text-muted-foreground">Exposé, PV-Sol, Wirtschaftlichkeit, Netzunterlagen und Bilder</p>
        </label>

        {files.length > 0 && <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between"><p className="text-xs font-extrabold text-slate-500">{files.length} Dateien</p><button type="button" onClick={() => { setFiles([]); reset() }} className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1.5 text-xs font-extrabold text-red-600"><Trash2 className="h-3.5 w-3.5" /> Leeren</button></div>
          {files.map((file, index) => <div key={`${file.name}-${index}`} className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2 shadow-sm">{file.type.startsWith('image/') ? <Image className="h-5 w-5 text-[#2F8A00]" /> : <FileText className="h-5 w-5 text-[#132060]" />}<span className="min-w-0 flex-1 truncate text-sm font-bold text-[#07142F]">{file.name}</span><button type="button" onClick={() => { setFiles((current) => current.filter((_, i) => i !== index)); reset() }} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100"><X className="h-4 w-4" /></button></div>)}
        </div>}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={uploadOnly} disabled={!files.length || isPending} className="rounded-xl bg-white px-4 py-3 text-sm font-extrabold text-[#07142F] shadow-sm ring-1 ring-slate-200 disabled:opacity-50">Nur speichern</button>
          <button type="button" onClick={analyse} disabled={(!files.length && !importId) || isPending} className="btn-primary justify-center py-3 disabled:opacity-50">{isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />} Analysieren</button>
        </div>
        {importId && <button type="button" onClick={analyse} disabled={isPending} className="mt-3 w-full rounded-xl bg-[#07142F] px-4 py-3 text-sm font-extrabold text-white">Erneut analysieren</button>}
        {message && <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm font-bold text-[#07142F]">{message}</p>}
      </section>

      <div className="space-y-5">
        {!result && <section className="card-padded rounded-[2rem] text-center"><ShieldCheck className="mx-auto h-10 w-10 text-[#5CB800]" /><h2 className="mt-3 text-xl font-extrabold text-[#07142F]">Sicherer Prüfmodus</h2><p className="mt-2 text-sm text-muted-foreground">Kein Projekt wird automatisch mit ungeprüften Zahlen angelegt.</p></section>}

        {result && <form action={createProject} className="card-padded rounded-[2rem] border border-[#5CB800]/25">
          <input type="hidden" name="import_id" value={importId ?? ''} />
          <div className="mb-4 flex items-center gap-3"><ShieldCheck className="h-6 w-6 text-[#5CB800]" /><div><h2 className="text-lg font-extrabold text-[#07142F]">Werte prüfen und korrigieren</h2><p className="text-xs font-semibold text-slate-500">Alle Felder sind manuell änderbar.</p></div></div>

          {warnings.length > 0 && <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-center gap-2 font-extrabold text-amber-800"><AlertTriangle className="h-5 w-5" /> Prüfung erforderlich</div><ul className="mt-2 space-y-1 text-sm font-semibold text-amber-800">{warnings.map((warning) => <li key={warning}>• {warning}</li>)}</ul></div>}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InputField name="project_name" label="Projektname" defaultValue={text(result.project_name)} />
            <InputField name="plant_type" label="Anlagenart" defaultValue={plantType} />
            <InputField name="location_city" label="Ort" defaultValue={text(result.location_city)} />
            <InputField name="location_state" label="Bundesland" defaultValue={text(result.location_state)} />
            <InputField name="pv_kwp" label="PV-Leistung in kWp" defaultValue={text(result.pv_kwp)} hint="Nur Zahl eingeben, z. B. 425,94" />
            <InputField name="bess_mwh" label="BESS-Kapazität in MWh" defaultValue={text(result.bess_mwh)} />
            <InputField name="feed_in_type" label="Einspeiseart" defaultValue={text(result.feed_in_type)} />
            <InputField name="purchase_price" label="EK-Kaufpreis in €" defaultValue={result.purchase_price ? money(result.purchase_price) : ''} hint="Deutsches Format wird unterstützt: 499.308,81" />
            <InputField name="tariff" label="Vergütung" defaultValue={tariff} hint="z. B. 0,0943 €/kWh oder 9,43 ct/kWh" />
            <InputField name="specific_yield" label="Spezifischer Ertrag" defaultValue={specificYield} hint="kWh/kWp" />
          </div>

          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-[#5CB800]/30 bg-[#5CB800]/8 p-4">
            <input required type="checkbox" name="values_confirmed" className="mt-1 h-5 w-5 accent-[#5CB800]" />
            <span><strong className="block text-sm text-[#07142F]">Ich habe die Werte mit den Originalunterlagen geprüft.</strong><span className="mt-1 block text-xs font-semibold text-slate-500">Erst danach wird das Projekt angelegt und das Exposé mit diesen bestätigten Werten erzeugt.</span></span>
          </label>

          <button type="submit" disabled={isPending} className="btn-primary mt-4 w-full justify-center py-3 disabled:opacity-50">{isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />} Geprüftes Projekt anlegen</button>
        </form>}

        {importedFiles.length > 0 && <section className="card-padded rounded-[2rem]"><h3 className="mb-3 font-extrabold text-[#07142F]">Analysierte Dateien</h3><div className="space-y-2">{importedFiles.map((file: any, index: number) => <div key={`${file.name}-${index}`} className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2 shadow-sm"><FileText className="h-5 w-5 text-[#132060]" /><span className="min-w-0 flex-1 truncate text-sm font-bold">{text(file.name, `Datei ${index + 1}`)}</span><FileStatus status={file.status} /></div>)}</div></section>}
      </div>
    </div>
  )
}
