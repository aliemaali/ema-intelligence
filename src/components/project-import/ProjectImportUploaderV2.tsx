'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  AlertTriangle,
  BatteryCharging,
  CheckCircle2,
  CloudUpload,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Layers3,
  Loader2,
  Server,
  Sparkles,
  Sun,
  Trash2,
  Warehouse,
  Wind,
  X,
} from 'lucide-react'
import { prepareProjectImport, uploadProjectImportFiles } from '@/lib/actions/project-import.actions'
import { prepareProjectListImport } from '@/lib/actions/project-list-import.actions'
import { prepareDataCenterImport } from '@/lib/actions/data-center-import.actions'
import { createVerifiedProjectFromImport } from '@/lib/actions/safe-project-import.actions'
import { DataCenterImportPreview } from './DataCenterImportPreview'
import { ProjectListImportPreview } from './ProjectListImportPreview'
import {
  formatProjectCountryLabel,
  isGermanProjectCountry,
  normalizeProjectCountry,
  PROJECT_COUNTRIES,
  sanitizeImportedLocationCity,
} from '@/lib/projects/location'
import type { DataCenterImport } from '@/lib/ai/data-center-import'
import type { ProjectType } from '@/lib/types/database.types'
import { BessPortfolioEditor } from '@/components/projects/BessPortfolioEditor'
import { normalizeBessPortfolio } from '@/lib/projects/bessPortfolio'

type ImportMode = 'single' | 'list'

const projectTypes: Array<{
  value: ProjectType
  label: string
  icon: typeof Sun
}> = [
  { value: 'pv_freiflaeche', label: 'PV-Freifläche', icon: Sun },
  { value: 'pv_dach', label: 'PV-Dach', icon: Warehouse },
  { value: 'bess', label: 'BESS', icon: BatteryCharging },
  { value: 'hybrid', label: 'Hybrid', icon: Layers3 },
  { value: 'wind', label: 'Wind', icon: Wind },
  { value: 'rechenzentrum', label: 'Rechenzentrum', icon: Server },
  { value: 'sonstiges', label: 'Sonstiges', icon: FolderOpen },
]

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

function InputField({ name, label, defaultValue = '', type = 'text', unit }: {
  name: string
  label: string
  defaultValue?: string
  type?: string
  unit?: string
}) {
  return (
    <label className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">{label}</span>
      <div className="relative">
        <input
          name={name}
          type={type}
          step={type === 'number' ? 'any' : undefined}
          min={type === 'number' ? '0' : undefined}
          defaultValue={defaultValue}
          className={`${inputClass} ${unit ? 'pr-20' : ''}`}
        />
        {unit ? <span className="absolute right-3 top-1/2 mt-1 -translate-y-1/2 text-xs font-bold text-slate-400">{unit}</span> : null}
      </div>
    </label>
  )
}

export function ProjectImportUploaderV2() {
  const [files, setFiles] = useState<File[]>([])
  const [importId, setImportId] = useState<string | null>(null)
  const [result, setResult] = useState<Record<string, any> | null>(null)
  const [dataCenter, setDataCenter] = useState<DataCenterImport | null>(null)
  const [projectList, setProjectList] = useState<any[]>([])
  const [importMode, setImportMode] = useState<ImportMode>('single')
  const [projectType, setProjectType] = useState<ProjectType | null>(null)
  const [listReadFailed, setListReadFailed] = useState(false)
  const [locationCountry, setLocationCountry] = useState('Deutschland')
  const [message, setMessage] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  const raw = (result?.raw_result ?? {}) as Record<string, any>
  const importedBessPortfolio = normalizeBessPortfolio(raw.bess_portfolio)
  const countryOptions = Array.from(new Set([locationCountry, ...PROJECT_COUNTRIES]))
  const showPvFields = projectType !== null && ['pv_freiflaeche', 'pv_dach', 'hybrid'].includes(projectType)
  const showBessFields = projectType !== null && ['bess', 'hybrid'].includes(projectType)

  const warnings = useMemo(() => {
    const list: string[] = []
    const pv = Number(result?.pv_kwp)
    const price = Number(result?.purchase_price)
    if (Number.isFinite(pv) && projectType === 'pv_dach' && pv > 20_000) {
      list.push('Dachleistung wirkt unplausibel hoch. Einheit und Dezimaltrennzeichen prüfen.')
    }
    if (Number.isFinite(price) && price > 1_000_000_000) list.push('EK-Kaufpreis wirkt unplausibel hoch.')
    if ((result?.confidence_score ?? 0) < 0.7) list.push('Die Erkennung ist unsicher. Bitte alle Werte mit den Unterlagen vergleichen.')
    if (result?.location_city && !sanitizeImportedLocationCity(result.location_city)) {
      list.push('Der erkannte Ort war nur eine Dokumentüberschrift und wurde deshalb geleert.')
    }
    return list
  }, [projectType, result])

  function clearAnalysis({ clearImport = false }: { clearImport?: boolean } = {}) {
    if (clearImport) setImportId(null)
    setResult(null)
    setDataCenter(null)
    setProjectList([])
    setListReadFailed(false)
    setMessage('')
    setSaveMessage('')
  }

  function changeMode(mode: ImportMode) {
    setImportMode(mode)
    setProjectType(null)
    setFiles([])
    setLocationCountry(mode === 'list' ? 'Frankreich' : 'Deutschland')
    clearAnalysis({ clearImport: true })
  }

  function analyze() {
    if (!files.length && !importId) return
    if (importMode === 'single' && !projectType) {
      setMessage('Bitte wähle zuerst den Projekttyp aus.')
      return
    }

    const data = new FormData()
    files.forEach((file) => data.append('files', file))

    startTransition(async () => {
      setMessage(importMode === 'list' ? 'Projektliste wird gelesen ...' : 'Projektdateien werden analysiert ...')
      setResult(null)
      setDataCenter(null)
      setProjectList([])
      setListReadFailed(false)

      let id = importId
      if (!id) {
        const upload = await uploadProjectImportFiles(data)
        if ('error' in upload && upload.error) return setMessage(`Fehler: ${upload.error}`)
        id = 'importId' in upload ? upload.importId ?? null : null
        setImportId(id)
      }
      if (!id) return setMessage('Import-ID fehlt.')

      if (importMode === 'list') {
        const listResponse = await prepareProjectListImport(id)
        if ('error' in listResponse && listResponse.error) {
          setListReadFailed(true)
          setMessage(`Fehler: ${listResponse.error}`)
          return
        }
        const rows = 'projects' in listResponse && Array.isArray(listResponse.projects) ? listResponse.projects : []
        if (rows.length > 0) {
          setProjectList(rows)
          setLocationCountry('Frankreich')
          setMessage(`${rows.length} Projekte erkannt. Bitte die Liste prüfen und gewünschte Zeilen auswählen.`)
          return
        }
        setListReadFailed(true)
        setLocationCountry('Frankreich')
        setMessage('Die Tabelle konnte aus dieser PDF nicht sicher gelesen werden. Bitte dieselbe Liste als Excel oder CSV hochladen. Es wurde kein Einzelprojekt angelegt.')
        return
      }

      if (projectType === 'rechenzentrum') {
        const dataCenterResponse = await prepareDataCenterImport(id)
        if ('error' in dataCenterResponse && dataCenterResponse.error) {
          setMessage(`Fehler: ${dataCenterResponse.error}`)
          return
        }
        if ('data' in dataCenterResponse && dataCenterResponse.data) {
          setDataCenter(dataCenterResponse.data)
          setLocationCountry('Deutschland')
          setMessage('Rechenzentrum analysiert. Bitte alle erkannten Angaben prüfen und ergänzen.')
        }
        return
      }

      const singleResponse = await prepareProjectImport(id)
      if ('error' in singleResponse && singleResponse.error) return setMessage(`Fehler: ${singleResponse.error}`)
      const nextResult = 'result' in singleResponse ? singleResponse.result as Record<string, any> : null
      setResult(nextResult)
      setLocationCountry(normalizeProjectCountry(nextResult?.location_country ?? nextResult?.raw_result?.location_country))
      setMessage('Analyse abgeschlossen. Werte jetzt mit den Unterlagen prüfen und bei Bedarf ändern.')
    })
  }

  function createProject(formData: FormData) {
    startTransition(async () => {
      try {
        const pendingMessage = 'Geprüfte Projektakte wird erstellt ...'
        setMessage(pendingMessage)
        setSaveMessage(pendingMessage)
        const response = await createVerifiedProjectFromImport(formData)
        if (response?.error) {
          const errorMessage = `Fehler: ${response.error}`
          setMessage(errorMessage)
          setSaveMessage(errorMessage)
        }
      } catch (error) {
        if (!(error as Error).message?.includes('NEXT_REDIRECT')) {
          const errorMessage = 'Fehler: Projekt konnte nicht erstellt werden.'
          setMessage(errorMessage)
          setSaveMessage(errorMessage)
        }
      }
    })
  }

  const canAnalyze = files.length > 0 && !isPending && (importMode === 'list' || Boolean(projectType))

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="card-padded rounded-[2rem]">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#5CB800]/10 text-[#2F8A00]"><FolderOpen className="h-5 w-5" /></div>
          <div>
            <h2 className="text-lg font-extrabold text-[#07142F]">Projektdateien importieren</h2>
            <p className="text-sm text-slate-500">Wähle zuerst Inhalt und Projekttyp. EMA nutzt danach die passenden Prüffelder.</p>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5">
          <button type="button" onClick={() => changeMode('single')} className={`rounded-xl px-3 py-3 text-sm font-extrabold transition ${importMode === 'single' ? 'bg-white text-[#07142F] shadow-sm' : 'text-slate-500'}`}>Einzelprojekt</button>
          <button type="button" onClick={() => changeMode('list')} className={`rounded-xl px-3 py-3 text-sm font-extrabold transition ${importMode === 'list' ? 'bg-[#5CB800] text-white shadow-sm' : 'text-slate-500'}`}>Projektliste</button>
        </div>

        {importMode === 'single' ? (
          <div className="mb-5">
            <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">1. Projekttyp auswählen</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {projectTypes.map((option) => {
                const Icon = option.icon
                const selected = projectType === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setProjectType(option.value)
                      clearAnalysis()
                    }}
                    className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl border px-2 py-3 text-center text-xs font-extrabold transition ${selected ? 'border-[#5CB800] bg-[#5CB800]/10 text-[#2F8A00] shadow-sm' : 'border-slate-200 bg-white text-[#07142F]'}`}
                  >
                    <Icon className="h-5 w-5" />
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">{importMode === 'single' ? '2. Dateien auswählen' : 'Projektliste auswählen'}</p>
        <label className={`flex min-h-[240px] flex-col items-center justify-center rounded-[2rem] border-2 border-dashed p-6 text-center transition ${importMode === 'single' && !projectType ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-55' : 'cursor-pointer border-[#5CB800]/35 bg-gradient-to-br from-[#5CB800]/8 via-white to-blue-50/70'}`}>
          <input
            type="file"
            multiple={importMode === 'single'}
            disabled={importMode === 'single' && !projectType}
            accept={projectType === 'rechenzentrum' ? '.pdf,application/pdf' : '.pdf,.jpg,.jpeg,.png,.heic,.webp,.txt,.csv,.xlsx,.xls,image/*,application/pdf,text/plain,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}
            className="hidden"
            onChange={(event) => {
              setFiles(Array.from(event.target.files ?? []))
              clearAnalysis({ clearImport: true })
              event.currentTarget.value = ''
            }}
          />
          <CloudUpload className="h-12 w-12 text-[#2F8A00]" />
          <p className="mt-4 text-2xl font-extrabold text-[#07142F]">{projectType ? 'Dateien hier ablegen' : 'Zuerst Projekttyp wählen'}</p>
          <p className="mt-2 text-sm text-slate-500">
            {importMode === 'list'
              ? 'Projektliste als PDF, Excel oder CSV'
              : projectType === 'rechenzentrum'
                ? 'Rechenzentrum-Standortdatenblatt oder Projekt-PDF'
                : 'Unterlagen zu einem einzelnen Projekt'}
          </p>
        </label>

        {files.length > 0 ? (
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">{files.length} Dateien</p>
              <button type="button" onClick={() => { setFiles([]); clearAnalysis({ clearImport: true }) }} className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1.5 text-xs font-extrabold text-red-600"><Trash2 className="h-3.5 w-3.5" /> Leeren</button>
            </div>
            {files.map((file, index) => (
              <div key={`${file.name}-${index}`} className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2 shadow-sm">
                {file.type.startsWith('image/') ? <ImageIcon className="h-5 w-5 text-[#2F8A00]" /> : <FileText className="h-5 w-5 text-[#132060]" />}
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-[#07142F]">{file.name}</span>
                <button type="button" onClick={() => { setFiles((current) => current.filter((_, i) => i !== index)); clearAnalysis({ clearImport: true }) }} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100" aria-label="Datei entfernen"><X className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        ) : null}

        <button type="button" onClick={analyze} disabled={!canAnalyze} className="btn-primary mt-5 w-full justify-center py-3 disabled:opacity-50">
          {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
          {importMode === 'list' ? 'Projektliste analysieren' : 'Dateien analysieren'}
        </button>
        {message ? <p className={`mt-4 rounded-2xl p-3 text-sm font-bold ${listReadFailed ? 'border border-amber-200 bg-amber-50 text-amber-900' : 'bg-slate-50 text-[#07142F]'}`}>{message}</p> : null}
      </section>

      <div className={`space-y-5 ${projectList.length > 0 ? 'xl:col-span-2' : ''}`}>
        {!result && !dataCenter && projectList.length === 0 && !listReadFailed ? (
          <section className="card-padded rounded-[2rem]">
            <div className="flex items-center gap-3"><Sparkles className="h-5 w-5 text-[#5CB800]" /><h2 className="text-lg font-extrabold text-[#07142F]">Geprüfte Import-Vorschau</h2></div>
            <p className="mt-4 text-sm leading-6 text-slate-500">EMA legt nichts ungeprüft an. Nach der Analyse kannst du jeden Wert kontrollieren und korrigieren.</p>
          </section>
        ) : null}

        {listReadFailed && importMode === 'list' ? (
          <section className="card-padded rounded-[2rem] border border-amber-200 bg-amber-50">
            <div className="flex items-start gap-3"><AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-amber-700" /><div><h2 className="text-lg font-extrabold text-amber-900">Projektliste nicht lesbar</h2><p className="mt-2 text-sm leading-6 text-amber-800">Diese PDF enthält keine sicher auslesbaren Tabellenzeilen. Bitte lade die Liste als Excel oder CSV hoch. Es wird kein Einzelprojekt angelegt.</p></div></div>
          </section>
        ) : null}

        {projectList.length > 0 && importId ? <ProjectListImportPreview importId={importId} initialRows={projectList} /> : null}

        {dataCenter && projectType === 'rechenzentrum' && importMode === 'single' ? (
          <form action={createProject} className="card-padded rounded-[2rem] border border-[#5CB800]/30">
            <input type="hidden" name="import_id" value={importId ?? ''} />
            <input type="hidden" name="project_type" value="rechenzentrum" />
            <input type="hidden" name="plant_type" value="Rechenzentrum" />
            <input type="hidden" name="location_country" value="Deutschland" />
            <div className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-[#5CB800]" /><div><h2 className="text-lg font-extrabold text-[#07142F]">Rechenzentrum prüfen</h2><p className="text-sm text-slate-500">Standort-, Netz- und Glasfaserdaten wurden getrennt ausgelesen.</p></div></div>
            <DataCenterImportPreview data={dataCenter} />
            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-[#5CB800]/25 bg-[#5CB800]/8 p-4"><input type="checkbox" name="confirmed" value="yes" required className="mt-1 h-5 w-5 accent-[#5CB800]" /><span className="text-sm font-bold leading-6 text-[#07142F]">Ich habe die Werte mit der Original-PDF geprüft. Das Rechenzentrum-Projekt darf angelegt werden.</span></label>
            <button type="submit" disabled={isPending} className="btn-primary mt-4 w-full justify-center py-3 disabled:opacity-50">{isPending ? 'Projekt wird erstellt ...' : 'Geprüftes Rechenzentrum anlegen'}</button>
            {saveMessage ? <p role="status" aria-live="polite" className={`mt-3 rounded-2xl border p-3 text-sm font-bold ${saveMessage.startsWith('Fehler:') ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-slate-50 text-[#07142F]'}`}>{saveMessage}</p> : null}
          </form>
        ) : null}

        {result && projectType && projectType !== 'rechenzentrum' && importMode === 'single' ? (
          <form action={createProject} className="card-padded rounded-[2rem] border border-[#5CB800]/30">
            <input type="hidden" name="import_id" value={importId ?? ''} />
            <input type="hidden" name="project_type" value={projectType} />
            <div className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-[#5CB800]" /><div><h2 className="text-lg font-extrabold text-[#07142F]">Werte prüfen und korrigieren</h2><p className="text-sm text-slate-500">Der ausgewählte Projekttyp wird verbindlich übernommen.</p></div></div>
            {warnings.length > 0 ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">{warnings.map((warning) => <p key={warning} className="flex gap-2 text-sm font-bold text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{warning}</p>)}</div> : null}
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InputField name="project_name" label="Projektname" defaultValue={String(result.project_name ?? '')} />
              <InputField name="plant_type" label="Erkannte Anlagenart" defaultValue={String(raw.plant_type ?? '')} />
              <label className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">Land</span><select name="location_country" value={locationCountry} onChange={(event) => setLocationCountry(event.target.value)} className={inputClass}>{countryOptions.map((country) => <option key={country} value={country}>{formatProjectCountryLabel(country)}</option>)}</select></label>
              <InputField name="location_city" label="Ort" defaultValue={sanitizeImportedLocationCity(result.location_city)} />
              {isGermanProjectCountry(locationCountry) ? <InputField name="location_state" label="Bundesland" defaultValue={String(result.location_state ?? '')} /> : null}
              {showPvFields ? <InputField name="pv_kwp" label="PV-Leistung" type="number" unit="kWp" defaultValue={plainNumber(result.pv_kwp)} /> : null}
              {showBessFields ? <InputField name="bess_mw" label="BESS-Leistung" type="number" unit="MW" defaultValue={plainNumber(raw.bess_mw)} /> : null}
              {showBessFields ? <InputField name="bess_mwh" label="BESS-Kapazität" type="number" unit="MWh" defaultValue={plainNumber(result.bess_mwh)} /> : null}
              {showBessFields ? <InputField name="bess_duration_h" label="Speicherdauer" type="number" unit="h" defaultValue={plainNumber(raw.bess_duration_h)} /> : null}
              <InputField name="purchase_price" label="EK-Kaufpreis" type="number" unit="€" defaultValue={plainNumber(result.purchase_price)} />
              {showPvFields ? <InputField name="feed_in_type" label="Einspeiseart" defaultValue={String(result.feed_in_type ?? '')} /> : null}
              {showPvFields ? <InputField name="tariff" label="Vergütung" type="number" unit="ct/kWh" defaultValue={tariffNumber(raw.tariff)} /> : null}
              {showPvFields ? <InputField name="specific_yield" label="Spezifischer Ertrag" type="number" unit="kWh/kWp" defaultValue={yieldNumber(raw.specific_yield)} /> : null}
            </div>
            {projectType === 'bess' && importedBessPortfolio ? <div className="mt-5"><BessPortfolioEditor initialPortfolio={importedBessPortfolio} /></div> : null}
            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-[#5CB800]/25 bg-[#5CB800]/8 p-4"><input type="checkbox" name="confirmed" value="yes" required className="mt-1 h-5 w-5 accent-[#5CB800]" /><span className="text-sm font-bold leading-6 text-[#07142F]">Ich habe die Werte mit den Originalunterlagen geprüft. Das Projekt darf mit diesen Angaben angelegt werden.</span></label>
            <button type="submit" disabled={isPending} className="btn-primary mt-4 w-full justify-center py-3 disabled:opacity-50">{isPending ? 'Projekt wird erstellt ...' : 'Geprüftes Projekt anlegen'}</button>
            {saveMessage ? <p role="status" aria-live="polite" className={`mt-3 rounded-2xl border p-3 text-sm font-bold ${saveMessage.startsWith('Fehler:') ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-slate-50 text-[#07142F]'}`}>{saveMessage}</p> : null}
          </form>
        ) : null}

        {(result || dataCenter) && files.length > 0 && importMode === 'single' ? (
          <section className="card-padded rounded-[2rem]">
            <h2 className="text-lg font-extrabold text-[#07142F]">Analysierte Dateien</h2>
            <div className="mt-3 space-y-2">{files.map((file, index) => <div key={`${file.name}-${index}`} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm"><FileText className="h-5 w-5 text-[#132060]" /><span className="min-w-0 flex-1 truncate text-sm font-bold text-[#07142F]">{file.name}</span><span className="text-xs font-bold text-[#2F8A00]">gelesen</span></div>)}</div>
          </section>
        ) : null}
      </div>
    </div>
  )
}
