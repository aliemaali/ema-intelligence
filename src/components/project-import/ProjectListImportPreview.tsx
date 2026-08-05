'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, FileDown, ListChecks, Loader2 } from 'lucide-react'
import { createVerifiedProjectsFromList } from '@/lib/actions/project-list-import.actions'

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

const fieldClass = 'min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-[#07142F] outline-none focus:border-[#5CB800]'

export function ProjectListImportPreview({ importId, initialRows }: { importId: string; initialRows: Row[] }) {
  const router = useRouter()
  const [rows, setRows] = useState(initialRows)
  const [message, setMessage] = useState('')
  const [pending, startTransition] = useTransition()
  const [pdfPending, setPdfPending] = useState(false)
  const selectedCount = useMemo(() => rows.filter((row) => row.selected).length, [rows])

  function update(index: number, patch: Partial<Row>) {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row))
  }

  async function createPdf() {
    try {
      setPdfPending(true)
      setMessage('EMA-Projektliste wird erstellt ...')
      const chosenRows = rows.filter((row) => row.selected)
      const response = await fetch('/api/projektliste/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: chosenRows, subtitle: 'Frankreich – Utility Scale PV' }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || 'PDF-Erstellung fehlgeschlagen')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'Frankreich.pdf'
      link.click()
      URL.revokeObjectURL(url)
      setMessage(`EMA-Projektliste mit ${chosenRows.length} Projekten wurde erstellt.`)
    } catch (error) {
      console.error('Project list PDF generation failed', error)
      setMessage('Die EMA-Projektliste konnte nicht erstellt werden.')
    } finally {
      setPdfPending(false)
    }
  }

  function submit(formData: FormData) {
    startTransition(async () => {
      setMessage('Projekte werden angelegt ...')
      const result = await createVerifiedProjectsFromList(formData)
      if ('error' in result && result.error) {
        setMessage(result.error)
        return
      }
      const created = 'created' in result ? result.created : 0
      const skipped = 'skipped' in result && Array.isArray(result.skipped) ? result.skipped.length : 0
      setMessage(`${created} Projekte wurden angelegt${skipped ? `, ${skipped} Dubletten oder ungültige Zeilen übersprungen` : ''}.`)
      router.push('/projects')
      router.refresh()
    })
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
            <p className="text-sm text-slate-500">Aus den ausgewählten Zeilen wird eine einzige hochwertige EMA-PDF erstellt.</p>
          </div>
        </div>
        <span className="w-fit rounded-full bg-[#5CB800]/10 px-3 py-1.5 text-xs font-extrabold text-[#2F8A00]">{selectedCount} ausgewählt</span>
      </div>

      <div className="mt-5 rounded-2xl border border-[#5CB800]/25 bg-[#5CB800]/8 p-4">
        <div className="flex items-start gap-3">
          <FileDown className="mt-0.5 h-6 w-6 shrink-0 text-[#5CB800]" />
          <div>
            <p className="font-extrabold text-[#07142F]">In eigene EMA-Projektliste umwandeln</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">Die PDF enthält Deckblatt, Kennzahlen, alle Projekte als Liste, regionale Grafiken und hochwertige Bildflächen im EMA-Design.</p>
          </div>
        </div>
        <button type="button" onClick={createPdf} disabled={selectedCount === 0 || pdfPending} className="btn-primary mt-4 w-full justify-center py-3 disabled:opacity-50">
          {pdfPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileDown className="h-5 w-5" />}
          {pdfPending ? 'EMA-PDF wird erstellt ...' : `EMA-PDF mit ${selectedCount} Projekten erstellen`}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => setRows((current) => current.map((row) => ({ ...row, selected: true })))} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-[#07142F]">Alle auswählen</button>
        <button type="button" onClick={() => setRows((current) => current.map((row) => ({ ...row, selected: false })))} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-[#07142F]">Alle abwählen</button>
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-[1320px] w-full border-collapse text-left">
          <thead className="bg-[#07142F] text-[11px] uppercase tracking-wider text-white"><tr><th className="px-3 py-3">PDF</th><th className="px-3 py-3">Nr.</th><th className="px-3 py-3">Region</th><th className="px-3 py-3">Projektname</th><th className="px-3 py-3">Leistung kWp</th><th className="px-3 py-3">Netz km</th><th className="px-3 py-3">Struktur</th><th className="px-3 py-3">Genehmigung</th><th className="px-3 py-3">Inbetriebnahme</th><th className="px-3 py-3">Fläche ha</th><th className="px-3 py-3">PVSYST</th></tr></thead>
          <tbody>{rows.map((row, index) => <tr key={`${row.externalNumber}-${index}`} className={`border-t border-slate-100 align-top ${row.selected ? '' : 'opacity-45'}`}>
            <td className="px-3 py-3"><input type="hidden" name={`rows.${index}.selected`} value={row.selected ? 'yes' : 'no'} /><input type="checkbox" checked={row.selected} onChange={(event) => update(index, { selected: event.target.checked })} className="h-5 w-5 accent-[#5CB800]" /></td>
            <Cell name={`rows.${index}.externalNumber`} value={row.externalNumber} onChange={(value) => update(index, { externalNumber: value })} />
            <Cell name={`rows.${index}.region`} value={row.region} onChange={(value) => update(index, { region: value })} />
            <Cell name={`rows.${index}.projectName`} value={row.projectName} onChange={(value) => update(index, { projectName: value })} wide />
            <Cell name={`rows.${index}.pvKwp`} value={row.pvKwp ?? ''} onChange={(value) => update(index, { pvKwp: Number(value) || null })} type="number" />
            <Cell name={`rows.${index}.gridDistanceKm`} value={row.gridDistanceKm ?? ''} onChange={(value) => update(index, { gridDistanceKm: Number(value) || null })} type="number" />
            <Cell name={`rows.${index}.structure`} value={row.structure} onChange={(value) => update(index, { structure: value })} wide />
            <Cell name={`rows.${index}.permissionDate`} value={row.permissionDate} onChange={(value) => update(index, { permissionDate: value })} type="date" />
            <Cell name={`rows.${index}.commissioning`} value={row.commissioning} onChange={(value) => update(index, { commissioning: value })} type="date" />
            <Cell name={`rows.${index}.securedLandHa`} value={row.securedLandHa ?? ''} onChange={(value) => update(index, { securedLandHa: Number(value) || null })} type="number" />
            <td className="min-w-36 px-3 py-3"><input name={`rows.${index}.specificYield`} type="number" step="any" value={row.specificYield ?? ''} onChange={(event) => update(index, { specificYield: Number(event.target.value) || null })} className={fieldClass} />{row.warnings.length > 0 && <div className="mt-2 space-y-1">{row.warnings.map((warning) => <p key={warning} className="flex gap-1 text-[10px] font-bold text-amber-700"><AlertTriangle className="h-3 w-3 shrink-0" />{warning}</p>)}</div>}</td>
            <input type="hidden" name={`rows.${index}.studiesStart`} value={row.studiesStart} />
          </tr>)}</tbody>
        </table>
      </div>

      <details className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <summary className="cursor-pointer text-sm font-extrabold text-[#07142F]">Optional: ausgewählte Zeilen als einzelne Projektordner anlegen</summary>
        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-[#5CB800]/25 bg-white p-4"><input type="checkbox" name="confirmed" value="yes" className="mt-1 h-5 w-5 accent-[#5CB800]" /><span className="text-sm font-bold leading-6 text-[#07142F]">Ich habe die Zeilen geprüft. Dubletten und ungültige Zeilen sollen übersprungen werden.</span></label>
        <button type="submit" disabled={selectedCount === 0 || pending} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-extrabold text-[#07142F] disabled:opacity-50">{pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />} {pending ? 'Projekte werden angelegt ...' : `${selectedCount} einzelne Projekte anlegen`}</button>
      </details>

      {message && <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm font-bold text-[#07142F]">{message}</p>}
    </form>
  )
}

function Cell({ name, value, onChange, type = 'text', wide = false }: { name: string; value: string | number; onChange: (value: string) => void; type?: string; wide?: boolean }) {
  return <td className={`${wide ? 'min-w-52' : 'min-w-32'} px-3 py-3`}><input name={name} type={type} step={type === 'number' ? 'any' : undefined} value={value} onChange={(event) => onChange(event.target.value)} className={fieldClass} /></td>
}
