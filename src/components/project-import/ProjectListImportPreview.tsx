'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, ListChecks } from 'lucide-react'
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
  const [rows, setRows] = useState(initialRows)
  const selectedCount = useMemo(() => rows.filter((row) => row.selected).length, [rows])
  const warningCount = useMemo(() => rows.filter((row) => row.warnings.length > 0).length, [rows])

  function update(index: number, patch: Partial<Row>) {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row))
  }

  return (
    <form action={createVerifiedProjectsFromList} className="card-padded rounded-[2rem] border border-[#5CB800]/30">
      <input type="hidden" name="import_id" value={importId} />
      <input type="hidden" name="row_count" value={rows.length} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <ListChecks className="mt-0.5 h-6 w-6 text-[#5CB800]" />
          <div>
            <h2 className="text-lg font-extrabold text-[#07142F]">Projektliste prüfen</h2>
            <p className="text-sm text-slate-500">Jede ausgewählte Zeile wird als eigener Projektordner angelegt.</p>
          </div>
        </div>
        <div className="flex gap-2 text-xs font-extrabold">
          <span className="rounded-full bg-[#5CB800]/10 px-3 py-1.5 text-[#2F8A00]">{selectedCount} ausgewählt</span>
          {warningCount > 0 && <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-700">{warningCount} prüfen</span>}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => setRows((current) => current.map((row) => ({ ...row, selected: true })))} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-[#07142F]">Alle auswählen</button>
        <button type="button" onClick={() => setRows((current) => current.map((row) => ({ ...row, selected: false })))} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-[#07142F]">Alle abwählen</button>
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-[1320px] w-full border-collapse text-left">
          <thead className="bg-[#07142F] text-[11px] uppercase tracking-wider text-white">
            <tr>
              <th className="px-3 py-3">Import</th>
              <th className="px-3 py-3">Nr.</th>
              <th className="px-3 py-3">Region</th>
              <th className="px-3 py-3">Projektname</th>
              <th className="px-3 py-3">Leistung kWp</th>
              <th className="px-3 py-3">Netz km</th>
              <th className="px-3 py-3">Struktur</th>
              <th className="px-3 py-3">Genehmigung</th>
              <th className="px-3 py-3">Inbetriebnahme</th>
              <th className="px-3 py-3">Fläche ha</th>
              <th className="px-3 py-3">PVSYST</th>
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
                  {row.warnings.length > 0 && <div className="mt-2 space-y-1">{row.warnings.map((warning) => <p key={warning} className="flex gap-1 text-[10px] font-bold text-amber-700"><AlertTriangle className="h-3 w-3 shrink-0" />{warning}</p>)}</div>}
                </td>
                <input type="hidden" name={`rows.${index}.studiesStart`} value={row.studiesStart} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-[#5CB800]/25 bg-[#5CB800]/8 p-4">
        <input type="checkbox" name="confirmed" value="yes" required className="mt-1 h-5 w-5 accent-[#5CB800]" />
        <span className="text-sm font-bold leading-6 text-[#07142F]">Ich habe die ausgewählten Zeilen geprüft. Nur neue Projekte dürfen angelegt werden; erkannte Dubletten sollen übersprungen werden.</span>
      </label>
      <button type="submit" disabled={selectedCount === 0} className="btn-primary mt-4 w-full justify-center py-3 disabled:opacity-50">
        <CheckCircle2 className="h-5 w-5" /> {selectedCount} Projekte anlegen
      </button>
    </form>
  )
}

function Cell({ name, value, onChange, type = 'text', wide = false }: { name: string; value: string | number; onChange: (value: string) => void; type?: string; wide?: boolean }) {
  return <td className={`${wide ? 'min-w-52' : 'min-w-32'} px-3 py-3`}><input name={name} type={type} step={type === 'number' ? 'any' : undefined} value={value} onChange={(event) => onChange(event.target.value)} className={fieldClass} /></td>
}
