'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileDown,
  FolderPlus,
  ListChecks,
  Loader2,
  Save,
  X,
} from 'lucide-react'
import { createVerifiedProjectsFromList } from '@/lib/actions/project-list-import.actions'

type PlantType = 'Agri-PV' | 'Freiflächen-PV' | 'Carport' | 'Dachanlage' | 'Sonstiges'
type ProjectListLanguage = 'de' | 'en'
type Row = {
  externalNumber: string
  region: string
  projectName: string
  pvKwp: number | null
  gridDistanceKm: number | null
  structure: string
  permissionDate: string
  studiesStart: string
  commissioning: string
  securedLandHa: number | null
  specificYield: number | null
  selected: boolean
  warnings: string[]
}

const plantTypes: PlantType[] = ['Agri-PV', 'Freiflächen-PV', 'Carport', 'Dachanlage', 'Sonstiges']
const countryCodes: Record<string, string> = {
  Frankreich: 'FR',
  Deutschland: 'DE',
  Italien: 'IT',
  Spanien: 'ES',
  Türkei: 'TR',
  Niederlande: 'NL',
}
const englishCountryNames: Record<string, string> = {
  Frankreich: 'France',
  Deutschland: 'Germany',
  Italien: 'Italy',
  Spanien: 'Spain',
  Türkei: 'Türkiye',
  Niederlande: 'Netherlands',
}
const fieldClass =
  'min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-[#07142F] outline-none focus:border-[#5CB800]'

export function ProjectListImportPreview({
  importId,
  initialRows,
}: {
  importId: string
  initialRows: Row[]
}) {
  const router = useRouter()
  const [rows, setRows] = useState(initialRows)
  const [message, setMessage] = useState('')
  const [pending, startTransition] = useTransition()
  const [pdfPending, setPdfPending] = useState(false)
  const [plantType, setPlantType] = useState<PlantType>('Agri-PV')
  const [language, setLanguage] = useState<ProjectListLanguage>('de')
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [saveOpen, setSaveOpen] = useState(false)
  const [savePending, setSavePending] = useState(false)
  const [country, setCountry] = useState('Frankreich')
  const [displayName, setDisplayName] = useState(
    `EMA Projektliste Frankreich ${new Date().getFullYear()}`,
  )
  const selectedCount = useMemo(() => rows.filter((row) => row.selected).length, [rows])

  useEffect(
    () => () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    },
    [pdfUrl],
  )

  function update(index: number, patch: Partial<Row>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function selectedRecords() {
    return rows.filter((row) => row.selected).map((row) => ({ ...row, techType: plantType }))
  }

  async function createPdfBlob(targetLanguage: ProjectListLanguage) {
    const records = selectedRecords()
    const localizedCountry =
      targetLanguage === 'en' ? (englishCountryNames[country] ?? country) : country
    const response = await fetch('/api/projektliste/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        records,
        subtitle: `${localizedCountry} – ${plantType}`,
        language: targetLanguage,
        country,
        countryCode: countryCodes[country] ?? 'XX',
      }),
    })
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      throw new Error(payload?.error || 'PDF-Erstellung fehlgeschlagen')
    }
    return response.blob()
  }

  async function createPdf() {
    try {
      setPdfPending(true)
      setMessage('EMA-Projektliste wird erstellt ...')
      const blob = await createPdfBlob(language)
      if (pdfUrl) URL.revokeObjectURL(pdfUrl)
      const url = URL.createObjectURL(blob)
      setPdfBlob(blob)
      setPdfUrl(url)
      window.open(url, '_blank', 'noopener,noreferrer')
      setMessage(
        `EMA-Projektliste mit ${selectedCount} Projekten wurde erstellt. Sie ist noch nicht gespeichert.`,
      )
    } catch (error) {
      console.error(error)
      setMessage('Die EMA-Projektliste konnte nicht erstellt werden.')
    } finally {
      setPdfPending(false)
    }
  }

  async function saveLanguageVersion(blob: Blob, targetLanguage: ProjectListLanguage) {
    const suffix = targetLanguage.toUpperCase()
    const localizedDisplayName = `${displayName.trim()} (${suffix})`
    const data = new FormData()
    data.append(
      'file',
      new File([blob], `${localizedDisplayName}.pdf`, { type: 'application/pdf' }),
    )
    data.append('country', country)
    data.append('countryCode', countryCodes[country] ?? '')
    data.append('displayName', localizedDisplayName)
    data.append('plantType', plantType)
    data.append('projectCount', String(selectedCount))
    data.append('language', targetLanguage)

    const response = await fetch('/api/projektliste/save', { method: 'POST', body: data })
    const payload = await response.json().catch(() => null)
    if (!response.ok) throw new Error(payload?.error || `${suffix}-Version konnte nicht gespeichert werden`)
  }

  async function savePdf() {
    if (!displayName.trim() || selectedCount === 0) return
    try {
      setSavePending(true)
      setMessage('Deutsche und englische Projektliste werden erstellt und gespeichert ...')

      const germanBlob = await createPdfBlob('de')
      const englishBlob = await createPdfBlob('en')
      await saveLanguageVersion(germanBlob, 'de')
      await saveLanguageVersion(englishBlob, 'en')

      setSaveOpen(false)
      setMessage(
        `Deutsch und Englisch wurden unter Projekte → ${country} → Projektlisten gespeichert.`,
      )
      router.refresh()
    } catch (error) {
      console.error(error)
      setMessage('Die beiden Sprachversionen konnten nicht vollständig gespeichert werden.')
    } finally {
      setSavePending(false)
    }
  }

  function submit(formData: FormData) {
    startTransition(async () => {
      setMessage('Projekte werden angelegt ...')
      const result = await createVerifiedProjectsFromList(formData)
      if ('error' in result && result.error) return setMessage(result.error)
      const created = 'created' in result ? result.created : 0
      setMessage(`${created} Projekte wurden angelegt.`)
      router.push('/projects')
      router.refresh()
    })
  }

  function resetPreview() {
    setPdfBlob(null)
    if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    setPdfUrl(null)
  }

  return (
    <form action={submit} className="card-padded rounded-[2rem] border border-[#5CB800]/30">
      <input type="hidden" name="import_id" value={importId} />
      <input type="hidden" name="row_count" value={rows.length} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <ListChecks className="mt-0.5 h-6 w-6 text-[#5CB800]" />
          <div>
            <h2 className="text-lg font-extrabold text-[#07142F]">Projektliste</h2>
            <p className="text-sm text-slate-500">
              Aus den ausgewählten Zeilen wird eine einzige EMA-PDF erstellt.
            </p>
          </div>
        </div>
        <span className="w-fit rounded-full bg-[#5CB800]/10 px-3 py-1.5 text-xs font-extrabold text-[#2F8A00]">
          {selectedCount} ausgewählt
        </span>
      </div>

      <div className="mt-5 rounded-2xl border border-[#5CB800]/25 bg-[#5CB800]/8 p-4">
        <div className="flex items-start gap-3">
          <FileDown className="mt-0.5 h-6 w-6 shrink-0 text-[#5CB800]" />
          <div>
            <p className="font-extrabold text-[#07142F]">In eigene EMA-Projektliste umwandeln</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Die PDF wird zuerst nur erstellt und geöffnet. Beim Speichern werden Deutsch und
              Englisch automatisch gemeinsam abgelegt.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
            Vorschau-Sprache
          </span>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setLanguage('de')
                resetPreview()
              }}
              className={`min-h-11 rounded-xl border px-4 text-sm font-extrabold ${
                language === 'de'
                  ? 'border-[#5CB800] bg-[#5CB800]/10 text-[#2F8A00]'
                  : 'border-slate-200 bg-white text-[#07142F]'
              }`}
            >
              🇩🇪 Deutsch
            </button>
            <button
              type="button"
              onClick={() => {
                setLanguage('en')
                resetPreview()
              }}
              className={`min-h-11 rounded-xl border px-4 text-sm font-extrabold ${
                language === 'en'
                  ? 'border-[#5CB800] bg-[#5CB800]/10 text-[#2F8A00]'
                  : 'border-slate-200 bg-white text-[#07142F]'
              }`}
            >
              🇬🇧 English
            </button>
          </div>
        </div>

        <label className="mt-4 block">
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Land</span>
          <select
            value={country}
            onChange={(event) => {
              setCountry(event.target.value)
              setDisplayName(`EMA Projektliste ${event.target.value} ${new Date().getFullYear()}`)
              resetPreview()
            }}
            className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-[#07142F]"
          >
            {Object.keys(countryCodes).map((name) => (
              <option key={name}>{name}</option>
            ))}
            <option>Sonstiges</option>
          </select>
        </label>

        <label className="mt-4 block">
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
            Anlagenart
          </span>
          <select
            value={plantType}
            onChange={(event) => {
              setPlantType(event.target.value as PlantType)
              resetPreview()
            }}
            className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-[#07142F]"
          >
            {plantTypes.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={createPdf}
          disabled={!selectedCount || pdfPending}
          className="btn-primary mt-4 w-full justify-center py-3 disabled:opacity-50"
        >
          {pdfPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileDown className="h-5 w-5" />}
          {pdfPending ? 'EMA-PDF wird erstellt ...' : `EMA-PDF mit ${selectedCount} Projekten erstellen`}
        </button>

        {pdfBlob && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => pdfUrl && window.open(pdfUrl, '_blank', 'noopener,noreferrer')}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-[#07142F]"
            >
              <ExternalLink className="h-4 w-4" /> PDF öffnen
            </button>
            <button
              type="button"
              onClick={() => setSaveOpen(true)}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#07142F] px-4 text-sm font-extrabold text-white"
            >
              <FolderPlus className="h-4 w-4" /> Beide Sprachen speichern
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setRows((current) => current.map((row) => ({ ...row, selected: true })))}
          className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold"
        >
          Alle auswählen
        </button>
        <button
          type="button"
          onClick={() => setRows((current) => current.map((row) => ({ ...row, selected: false })))}
          className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold"
        >
          Alle abwählen
        </button>
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[1320px] border-collapse text-left">
          <thead className="bg-[#07142F] text-[11px] uppercase tracking-wider text-white">
            <tr>
              <th className="px-3 py-3">PDF</th><th className="px-3 py-3">Nr.</th><th className="px-3 py-3">Region</th><th className="px-3 py-3">Projektname</th><th className="px-3 py-3">Leistung kWp</th><th className="px-3 py-3">Netz km</th><th className="px-3 py-3">Struktur</th><th className="px-3 py-3">Genehmigung</th><th className="px-3 py-3">Inbetriebnahme</th><th className="px-3 py-3">Fläche ha</th><th className="px-3 py-3">PVSYST</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.externalNumber}-${index}`} className={`border-t border-slate-100 align-top ${row.selected ? '' : 'opacity-45'}`}>
                <td className="px-3 py-3">
                  <input type="hidden" name={`rows.${index}.selected`} value={row.selected ? 'yes' : 'no'} />
                  <input type="checkbox" checked={row.selected} onChange={(event) => update(index, { selected: event.target.checked })} className="h-5 w-5 accent-[#5CB800]" />
                </td>
                <Cell name={`rows.${index}.externalNumber`} value={row.externalNumber} onChange={(value) => update(index, { externalNumber: value })} />
                <Cell name={`rows.${index}.region`} value={row.region} onChange={(value) => update(index, { region: value })} />
                <Cell name={`rows.${index}.projectName`} value={row.projectName} onChange={(value) => update(index, { projectName: value })} wide />
                <Cell name={`rows.${index}.pvKwp`} value={row.pvKwp ?? ''} onChange={(value) => update(index, { pvKwp: Number(value) || null })} type="number" />
                <Cell name={`rows.${index}.gridDistanceKm`} value={row.gridDistanceKm ?? ''} onChange={(value) => update(index, { gridDistanceKm: Number(value) || null })} type="number" />
                <Cell name={`rows.${index}.structure`} value={row.structure} onChange={(value) => update(index, { structure: value })} wide />
                <Cell name={`rows.${index}.permissionDate`} value={row.permissionDate} onChange={(value) => update(index, { permissionDate: value })} type="date" />
                <Cell name={`rows.${index}.commissioning`} value={row.commissioning} onChange={(value) => update(index, { commissioning: value })} type="date" />
                <Cell name={`rows.${index}.securedLandHa`} value={row.securedLandHa ?? ''} onChange={(value) => update(index, { securedLandHa: Number(value) || null })} type="number" />
                <td className="min-w-36 px-3 py-3">
                  <input name={`rows.${index}.specificYield`} type="number" step="any" value={row.specificYield ?? ''} onChange={(event) => update(index, { specificYield: Number(event.target.value) || null })} className={fieldClass} />
                  {row.warnings.length > 0 && <div className="mt-2">{row.warnings.map((warning) => <p key={warning} className="flex gap-1 text-[10px] font-bold text-amber-700"><AlertTriangle className="h-3 w-3" />{warning}</p>)}</div>}
                </td>
                <input type="hidden" name={`rows.${index}.studiesStart`} value={row.studiesStart} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <summary className="cursor-pointer text-sm font-extrabold text-[#07142F]">Optional: ausgewählte Zeilen als einzelne Projektordner anlegen</summary>
        <label className="mt-4 flex gap-3 rounded-2xl border bg-white p-4"><input type="checkbox" name="confirmed" value="yes" className="mt-1 h-5 w-5 accent-[#5CB800]" /><span className="text-sm font-bold">Ich habe die Zeilen geprüft.</span></label>
        <button type="submit" disabled={!selectedCount || pending} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm font-extrabold disabled:opacity-50">{pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}{selectedCount} einzelne Projekte anlegen</button>
      </details>

      {message && <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm font-bold text-[#07142F]">{message}</p>}

      {saveOpen && (
        <div className="fixed inset-0 z-[100] flex items-end bg-black/45 p-3 sm:items-center sm:justify-center">
          <div className="w-full max-w-lg rounded-[2rem] bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-[#5CB800]">Zweisprachig speichern</p>
                <h3 className="mt-1 text-xl font-extrabold text-[#07142F]">Deutsch und Englisch</h3>
              </div>
              <button type="button" onClick={() => setSaveOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <label className="mt-5 block text-xs font-extrabold uppercase tracking-wider text-slate-500">
              Land
              <select value={country} onChange={(event) => { setCountry(event.target.value); setDisplayName(`EMA Projektliste ${event.target.value} ${new Date().getFullYear()}`) }} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold normal-case text-[#07142F]">
                <option>Frankreich</option><option>Deutschland</option><option>Türkei</option><option>Spanien</option><option>Italien</option><option>Niederlande</option><option>Sonstiges</option>
              </select>
            </label>
            <label className="mt-4 block text-xs font-extrabold uppercase tracking-wider text-slate-500">
              Basis-Dateiname
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 px-4 text-sm font-extrabold normal-case text-[#07142F]" />
            </label>
            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-600">
              <p>🇩🇪 {displayName} (DE).pdf</p>
              <p className="mt-1">🇬🇧 {displayName} (EN).pdf</p>
              <p className="mt-2 text-xs font-semibold text-slate-500">{plantType} · {selectedCount} Projekte</p>
            </div>
            <button type="button" onClick={savePdf} disabled={savePending || !displayName.trim()} className="btn-primary mt-5 w-full justify-center py-3 disabled:opacity-50">
              {savePending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
              {savePending ? 'Beide Versionen werden gespeichert ...' : 'Deutsch und Englisch speichern'}
            </button>
          </div>
        </div>
      )}
    </form>
  )
}

function Cell({
  name,
  value,
  onChange,
  type = 'text',
  wide = false,
}: {
  name: string
  value: string | number
  onChange: (value: string) => void
  type?: string
  wide?: boolean
}) {
  return (
    <td className={`${wide ? 'min-w-52' : 'min-w-32'} px-3 py-3`}>
      <input
        name={name}
        type={type}
        step={type === 'number' ? 'any' : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClass}
      />
    </td>
  )
}
