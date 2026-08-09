'use client'

import { useState, useTransition } from 'react'
import { CloudUpload, FileText, Loader2, Sparkles, Trash2, X } from 'lucide-react'
import { prepareProjectImport, uploadProjectImportFiles } from '@/lib/actions/project-import.actions'
import { prepareProjectListImport } from '@/lib/actions/project-list-import.actions'
import { prepareDataCenterImport } from '@/lib/actions/data-center-import.actions'
import { DataCenterImportPreview } from './DataCenterImportPreview'
import { ProjectListImportPreview } from './ProjectListImportPreview'
import type { DataCenterImport } from '@/lib/ai/data-center-import'

type ImportMode = 'single' | 'list'
type ProjectType = 'PV' | 'BESS' | 'Hybrid' | 'Rechenzentrum' | 'Sonstiges'

export function ProjectImportUploaderV2() {
  const [files, setFiles] = useState<File[]>([])
  const [importId, setImportId] = useState<string | null>(null)
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [dataCenter, setDataCenter] = useState<DataCenterImport | null>(null)
  const [projectList, setProjectList] = useState<unknown[]>([])
  const [importMode, setImportMode] = useState<ImportMode>('single')
  const [projectType, setProjectType] = useState<ProjectType>('PV')
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  function reset() { setImportId(null); setResult(null); setDataCenter(null); setProjectList([]); setMessage('') }

  function analyze() {
    if (!files.length) return
    const form = new FormData(); files.forEach((file) => form.append('files', file))
    startTransition(async () => {
      setMessage('Projektdateien werden analysiert ...'); setResult(null); setDataCenter(null); setProjectList([])
      let id = importId
      if (!id) {
        const upload = await uploadProjectImportFiles(form)
        if ('error' in upload && upload.error) return setMessage(`Fehler: ${upload.error}`)
        id = 'importId' in upload ? upload.importId ?? null : null; setImportId(id)
      }
      if (!id) return setMessage('Import-ID fehlt.')
      if (importMode === 'list') {
        const response = await prepareProjectListImport(id)
        if ('error' in response && response.error) return setMessage(`Fehler: ${response.error}`)
        const rows = 'projects' in response && Array.isArray(response.projects) ? response.projects : []
        setProjectList(rows); setMessage(`${rows.length} Projekte erkannt. Bitte prüfen.`); return
      }
      if (projectType === 'Rechenzentrum') {
        const response = await prepareDataCenterImport(id)
        if ('error' in response && response.error) return setMessage(`Fehler: ${response.error}`)
        if ('data' in response && response.data) setDataCenter(response.data)
        setMessage('Rechenzentrum analysiert. Bitte alle erkannten Angaben prüfen.'); return
      }
      const response = await prepareProjectImport(id)
      if ('error' in response && response.error) return setMessage(`Fehler: ${response.error}`)
      if ('result' in response) setResult(response.result as Record<string, unknown>)
      setMessage(`${projectType} analysiert. Bitte die erkannten Angaben prüfen.`)
    })
  }

  const types: ProjectType[] = ['PV','BESS','Hybrid','Rechenzentrum','Sonstiges']
  return <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.9fr_1.1fr]">
    <section className="card-padded rounded-[2rem]">
      <h2 className="text-lg font-extrabold text-[#07142F]">Projekt importieren</h2>
      <p className="mt-1 text-sm text-slate-500">Wähle zuerst, was du hochlädst. EMA analysiert danach mit den passenden Kriterien.</p>
      <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5"><button type="button" onClick={() => { setImportMode('single'); reset() }} className={`rounded-xl px-3 py-3 text-sm font-extrabold ${importMode === 'single' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>Einzelprojekt</button><button type="button" onClick={() => { setImportMode('list'); reset() }} className={`rounded-xl px-3 py-3 text-sm font-extrabold ${importMode === 'list' ? 'bg-[#5CB800] text-white shadow-sm' : 'text-slate-500'}`}>Projektliste</button></div>
      {importMode === 'single' && <div className="mt-4"><p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-slate-500">Projekttyp</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{types.map((type) => <button key={type} type="button" onClick={() => { setProjectType(type); reset() }} className={`rounded-xl border px-3 py-3 text-sm font-extrabold ${projectType === type ? 'border-[#5CB800] bg-[#5CB800]/10 text-[#2F8A00]' : 'border-slate-200 bg-white text-[#07142F]'}`}>{type}</button>)}</div></div>}
      <label className="mt-5 flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-[#5CB800]/35 bg-slate-50 p-6 text-center"><input type="file" multiple={importMode === 'single'} accept=".pdf,.jpg,.jpeg,.png,.heic,.webp,.txt,.csv,.xlsx,.xls,image/*,application/pdf,text/plain,text/csv" className="hidden" onChange={(event) => { setFiles(Array.from(event.target.files ?? [])); reset(); event.currentTarget.value = '' }} /><CloudUpload className="h-12 w-12 text-[#2F8A00]" /><p className="mt-3 text-xl font-extrabold text-[#07142F]">Dateien auswählen</p><p className="mt-1 text-sm text-slate-500">{projectType === 'Rechenzentrum' && importMode === 'single' ? 'Standortdatenblatt, Exposé oder andere Projekt-PDF' : 'Projektunterlagen hochladen'}</p></label>
      {files.length > 0 && <div className="mt-4 space-y-2"><div className="flex justify-between"><span className="text-xs font-bold text-slate-500">{files.length} Datei(en)</span><button type="button" onClick={() => { setFiles([]); reset() }} className="text-xs font-extrabold text-red-600"><Trash2 className="mr-1 inline h-3.5 w-3.5" />Leeren</button></div>{files.map((file, index) => <div key={`${file.name}-${index}`} className="flex items-center gap-2 rounded-xl bg-white p-3"><FileText className="h-4 w-4" /><span className="min-w-0 flex-1 truncate text-sm font-bold">{file.name}</span><button type="button" onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}><X className="h-4 w-4" /></button></div>)}</div>}
      <button type="button" onClick={analyze} disabled={!files.length || isPending} className="btn-primary mt-5 w-full justify-center py-3 disabled:opacity-50">{isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />} Analysieren</button>
      {message && <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm font-bold text-[#07142F]">{message}</p>}
    </section>
    <section className="card-padded rounded-[2rem]">
      <h2 className="text-lg font-extrabold text-[#07142F]">Geprüfte Import-Vorschau</h2>
      {!dataCenter && !result && projectList.length === 0 && <p className="mt-4 text-sm leading-6 text-slate-500">EMA legt nichts ungeprüft an. Nach der Analyse siehst du hier die erkannten Werte.</p>}
      {dataCenter && <DataCenterImportPreview data={dataCenter} />}
      {projectList.length > 0 && importId && <ProjectListImportPreview importId={importId} initialRows={projectList as never[]} />}
      {result && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">Die bestehende Vorschau für {projectType} bleibt unverändert. Rechenzentrum nutzt ab jetzt die neue spezialisierte Standortanalyse.</div>}
    </section>
  </div>
}
