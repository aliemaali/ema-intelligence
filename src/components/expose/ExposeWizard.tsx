'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, BatteryCharging, Check, FileText, Loader2, Save, Server, Sun } from 'lucide-react'
import { exposeKinds, exposeKind, applyExposeDraft, type ExposeDraft, type ExposeKind, type ExposeProjectOption, type ExposeWizardSource } from '@/lib/expose/wizard'
import { loadExposeWizard, saveExposeWizard } from '@/lib/actions/expose-wizard.actions'
import { importedExposeSchema } from '@/lib/expose/import'
import { PrintButton } from './PrintButton'

const steps = ['Typ', 'Projekt', 'Inhalte', 'Titelbild', 'Zusammenfassung']
const input = 'mt-2 w-full rounded-xl border border-blue-200/20 bg-[#06152f] p-3 text-white outline-none focus:ring-2 focus:ring-[#8bf04a]'
const button = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-blue-200/20 px-4 py-3 text-sm font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8bf04a] disabled:opacity-40'
const icons = { bess: BatteryCharging, pv: Sun, 'data-center': Server }

export function ExposeWizard({ projects }: { projects: ExposeProjectOption[] }) {
  const [step, setStep] = useState(0)
  const [kind, setKind] = useState<ExposeKind | null>(null)
  const [projectId, setProjectId] = useState('')
  const [source, setSource] = useState<ExposeWizardSource | null>(null)
  const [draft, setDraft] = useState<ExposeDraft | null>(null)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState('')
  const [saved, setSaved] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const selectedKind = exposeKinds.find(item => item.id === kind)
  const selectedProject = projects.find(item => item.id === projectId)
  const matching = projects.filter(project => exposeKind(project.type) === kind && `${project.name} ${project.number} ${project.location}`.toLocaleLowerCase('de-DE').includes(query.toLocaleLowerCase('de-DE')))
  const data = source && draft ? applyExposeDraft(source, draft) : null

  function go(next: number) {
    setStep(next)
    setMessage('')
    requestAnimationFrame(() => { heading.current?.focus(); heading.current?.scrollIntoView({ block: 'start', behavior: 'auto' }) })
  }
  function update(patch: Partial<ExposeDraft>) {
    setDraft(previous => previous ? { ...previous, ...patch } : null)
    setSaved(false)
    setMessage('')
  }
  function chooseKind(next: ExposeKind) {
    if (next !== kind) { setKind(next); setProjectId(''); setSource(null); setDraft(null); setSaved(false); setQuery('') }
    go(1)
  }
  async function chooseProject(id: string) {
    setBusy(true); setMessage(''); setImportMessage(''); setSaved(false)
    try {
      const result = await loadExposeWizard(id)
      if (!result.source) { setMessage(result.error || 'Projekt konnte nicht geladen werden.'); return }
      setSource(result.source); setProjectId(id)
      setDraft({ title: result.source.data.projectName, summary: result.source.data.summary.slice(0, 1200), highlights: result.source.data.highlights.slice(0, 6).map(text => text.slice(0, 240)), hero: 'type' })
      go(2)
    } catch { setMessage('Verbindung unterbrochen. Bitte erneut versuchen.') }
    finally { setBusy(false) }
  }
  async function importFile(file: File) {
    if (!draft || importing) return
    if (file.size > 4 * 1024 * 1024) { setImportMessage('Maximal 4 MB pro Datei.'); return }
    setImporting(true); setImportMessage('Datei wird gelesen und Angaben werden erkannt …')
    try {
      const form = new FormData()
      form.append('file', file); form.append('projectId', projectId)
      const response = await fetch('/api/expose/import', { method: 'POST', body: form })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Import fehlgeschlagen.')
      const imported = importedExposeSchema.parse(result.imported)
      update({ imported, title: imported.title || draft.title, summary: imported.text.length <= 1200 ? imported.text : '', highlights: imported.metrics.slice(0, 6).map(row => `${row.label}: ${row.value}`) })
      setImportMessage(`„${imported.fileName}“ übernommen. Bitte die erkannten Felder prüfen.${!imported.title ? ' Projekttitel nicht erkannt – bitte prüfen.' : ''}${!imported.location ? ' Standort nicht erkannt – bitte ergänzen.' : ''} Ein weiterer Upload ersetzt diese Importdaten.`)
    } catch (error) { setImportMessage(error instanceof Error ? error.message : 'Import fehlgeschlagen. Bitte erneut versuchen.') }
    finally { setImporting(false) }
  }
  async function save() {
    if (!draft || saving) return
    setSaving(true); setMessage('')
    try {
      const result = await saveExposeWizard(projectId, draft)
      if (result.error) setMessage(result.error)
      else { setSaved(true); setMessage('Exposé-Entwurf gespeichert. Du kannst ihn nach der Projektauswahl wieder laden.') }
    } catch { setMessage('Speichern fehlgeschlagen. Bitte erneut versuchen.') }
    finally { setSaving(false) }
  }
  const canNext = step === 0 ? Boolean(kind) : step === 1 ? Boolean(source) : Boolean(draft?.title.trim())

  return <div className="space-y-5 text-white" aria-busy={busy || importing}>
    <nav aria-label="Exposé-Fortschritt"><ol className="grid grid-cols-5 gap-1 sm:gap-3">{steps.map((label, index) => <li key={label}>
      <button type="button" aria-current={index === step ? 'step' : undefined} disabled={busy || saving || importing || index > step || (index > 1 && !source)} onClick={() => go(index)} className={`flex min-h-16 w-full flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] sm:text-xs break-words ${step === index ? 'bg-[#8bf04a] font-extrabold text-[#06152f]' : 'bg-white/5 text-slate-300 disabled:opacity-40'}`}>
        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-current font-bold">{index < step ? <Check className="h-4 w-4" /> : index + 1}</span>{index === 4 ? <><span className="sm:hidden">Prüfen</span><span className="hidden sm:inline">{label}</span></> : label}
      </button>
    </li>)}</ol></nav>
    <section className="rounded-3xl border border-blue-200/15 bg-[#0a1d35] p-5 sm:p-7">
      <p className="text-xs font-bold text-[#8bf04a]">Schritt {step + 1} von 5</p>
      <h2 ref={heading} tabIndex={-1} className="mt-2 scroll-mt-5 text-2xl font-extrabold outline-none">{['Welches Exposé möchtest du erstellen?', 'Projekt auswählen', 'Inhalte prüfen und verfeinern', 'Dein Titelbild', 'Alles bereit für dein Exposé'][step]}</h2>

      {step === 0 ? <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-4">{exposeKinds.map(item => {
        const Icon = icons[item.id]
        return <button key={item.id} type="button" onClick={() => chooseKind(item.id)} aria-pressed={kind === item.id} className="overflow-hidden rounded-2xl border border-blue-200/20 bg-[#06152f] text-left transition hover:border-[#8bf04a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8bf04a]">
          <img src={item.hero} alt="" className="h-24 w-full object-cover sm:h-32" /><span className="block p-2 sm:p-4"><Icon className="mb-3 h-5 w-5 text-[#8bf04a] sm:h-7 sm:w-7" /><strong className="text-sm sm:text-xl">{item.label}</strong><span className="mt-2 hidden text-xs leading-5 text-slate-400 sm:block">{item.description}</span></span>
        </button>
      })}</div> : null}

      {step === 1 ? <div className="mt-5 space-y-4">
        <p className="text-sm text-slate-400">{selectedKind?.label} · EMA übernimmt deine hinterlegten Daten und bereitet Texte und Kennzahlen vor.</p>
        <label className="block text-sm font-bold">Projekt suchen<input className={input} value={query} onChange={event => setQuery(event.target.value)} placeholder="Name, Nummer oder Standort" /></label>
        {busy ? <p role="status" className="flex items-center gap-2 py-4"><Loader2 className="h-5 w-5 animate-spin" /> Projektdaten werden vorbereitet …</p> : null}
        <div className="max-h-80 space-y-2 overflow-y-auto">{matching.map(project => <button type="button" disabled={busy} key={project.id} onClick={() => chooseProject(project.id)} className="flex min-h-20 w-full items-center justify-between gap-4 rounded-xl border border-blue-200/15 bg-white/5 p-4 text-left hover:border-[#8bf04a] disabled:opacity-40">
          <span className="min-w-0"><strong className="block break-words">{project.name}</strong><span className="mt-1 block text-xs text-slate-400">{project.number} · {project.location}</span></span><ArrowRight className="h-5 w-5 shrink-0 text-[#8bf04a]" />
        </button>)}</div>
        {!matching.length ? <p className="rounded-xl bg-white/5 p-4 text-sm text-slate-300">Kein passendes Projekt gefunden. Lege ein Projekt an oder importiere deine Unterlagen.</p> : null}
        <div className="flex flex-wrap gap-3"><Link href="/project-import" className={button}>Datei importieren</Link><Link href="/projects/new" className={button}>Neues Projekt</Link></div>
      </div> : null}

      {step === 2 && source && draft ? <div className="mt-5 space-y-5">
        <div className="rounded-2xl border border-[#8bf04a]/30 bg-[#8bf04a]/5 p-4">
          <h3 className="font-bold">Daten aus Bild oder Datei übernehmen</h3>
          <p className="mt-2 text-sm text-slate-300">Screenshot, Foto oder Dokument auswählen. Erkannte Daten füllen diesen Exposé-Entwurf. Die Projektakte bleibt unverändert.</p>
          <label className="mt-4 block text-sm">JPG, PNG, WebP, Text-PDF (max. 10 Seiten), TXT oder CSV · bis 4 MB
            <input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,.txt,.csv" disabled={importing || saving} className="mt-2 block w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-[#8bf04a] file:px-4 file:py-3 file:font-bold file:text-[#06152f]" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void importFile(file) }} />
          </label>
          {importMessage ? <p role="status" className="mt-3 text-sm">{importMessage}</p> : null}
        </div>
        {draft.imported ? <fieldset disabled={importing || saving} className="space-y-3 rounded-xl border border-blue-200/20 p-4">
          <legend className="px-2 font-bold">Erkannte Angaben prüfen</legend>
          <p className="text-xs text-amber-100">Quelle: {draft.imported.fileName}. Texterkennung kann Fehler enthalten. Kennzahlen und Projektangaben aus dem Upload ersetzen die Angaben aus der Projektakte für dieses Exposé.</p>
          <label className="block text-sm">Standort<input className={input} maxLength={200} value={draft.imported.location || ''} onChange={event => update({ imported: { ...draft.imported!, location: event.target.value } })} /></label>
          {(['metrics', 'profile'] as const).map(group => <div key={group} className="space-y-3"><h4 className="text-sm font-bold">{group === 'metrics' ? 'Kennzahlen' : 'Projektangaben'}</h4>{draft.imported![group].map((row, index) => <div key={index} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
            <input aria-label={`Bezeichnung ${group} ${index + 1}`} className={input} maxLength={100} value={row.label} onChange={event => update({ imported: { ...draft.imported!, [group]: draft.imported![group].map((item, i) => i === index ? { ...item, label: event.target.value } : item) } })} />
            <input aria-label={`Wert ${group} ${index + 1}`} className={input} maxLength={160} value={row.value} onChange={event => update({ imported: { ...draft.imported!, [group]: draft.imported![group].map((item, i) => i === index ? { ...item, value: event.target.value } : item) } })} />
            <button type="button" className={`${button} mt-2`} onClick={() => update({ imported: { ...draft.imported!, [group]: draft.imported![group].filter((_, i) => i !== index) } })}>Entfernen</button>
          </div>)}</div>)}
          <details><summary className="cursor-pointer text-sm">Erkannten Originaltext anzeigen</summary><p className="mt-3 whitespace-pre-wrap text-sm text-slate-300">{draft.imported.text}</p></details>
        </fieldset> : null}
        {source.draft ? <div className="rounded-xl border border-[#8bf04a]/30 p-4"><p className="text-sm">Für dieses Projekt ist ein gespeicherter Entwurf vorhanden.</p><button type="button" disabled={importing || saving} onClick={() => { setDraft(source.draft); setImportMessage(''); setSaved(true); setMessage('Gespeicherter Entwurf geladen.') }} className={`${button} mt-3`}>Entwurf laden</button></div> : null}
        <p className="text-xs leading-5 text-slate-400">Änderungen hier gelten für diesen Exposé-Entwurf. Angaben aus einem Upload bitte mit dem Original vergleichen.</p>
        <label className="block text-sm font-bold">Titel<input className={input} maxLength={160} required value={draft.title} onChange={event => update({ title: event.target.value })} /></label>
        <label className="block text-sm font-bold">Kurzbeschreibung<textarea className={input} rows={5} maxLength={1200} value={draft.summary} onChange={event => update({ summary: event.target.value })} /><span className="text-xs font-normal text-slate-400">{draft.summary.length} / 1.200 Zeichen</span></label>
        <fieldset className="space-y-3"><legend className="mb-2 text-sm font-bold">Investment Highlights</legend>{draft.highlights.map((highlight, index) => <label key={index} className="block text-xs text-slate-400">Highlight {index + 1}<input className={input} maxLength={240} value={highlight} onChange={event => update({ highlights: draft.highlights.map((text, i) => i === index ? event.target.value : text) })} /></label>)}{draft.highlights.length < 6 ? <button type="button" className={button} onClick={() => update({ highlights: [...draft.highlights, ''] })}>+ Highlight hinzufügen</button> : null}</fieldset>
        {!draft.imported ? <details className="rounded-xl border border-blue-200/15 p-4"><summary className="cursor-pointer text-sm font-bold">Kennzahlen aus der Projektakte ({source.data.metrics.length})</summary><dl className="mt-3 space-y-2">{source.data.metrics.map(item => <div key={item.label} className="flex flex-wrap justify-between gap-2 text-sm"><dt className="text-slate-400">{item.label}</dt><dd>{item.value}</dd></div>)}</dl><Link href={`/projects/${projectId}/edit`} className="mt-4 inline-block text-sm font-bold text-[#8bf04a]">Projektdaten bearbeiten →</Link></details> : null}
        {!draft.imported && source.warnings.length ? <div className="rounded-xl border border-amber-300/30 bg-amber-300/5 p-4 text-sm text-amber-100"><strong>Vor dem Versand prüfen</strong><ul className="mt-2 list-disc space-y-1 pl-4">{source.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></div> : null}
      </div> : null}

      {step === 3 && source && draft && selectedKind ? <div className="mt-5 space-y-5">
        <p className="text-sm text-slate-400">Jeder Projekttyp erhält sein eigenes Hero. Alternativ kannst du das hinterlegte Projektfoto nutzen.</p>
        <fieldset className="flex flex-wrap gap-3"><legend className="sr-only">Titelbild auswählen</legend><label className={`${button} cursor-pointer`}><input type="radio" name="hero" value="type" checked={draft.hero === 'type'} onChange={() => update({ hero: 'type' })} /> {selectedKind.label}-Motiv</label>{source.projectImage ? <label className={`${button} cursor-pointer`}><input type="radio" name="hero" value="project" checked={draft.hero === 'project'} onChange={() => update({ hero: 'project' })} /> Projektfoto</label> : null}</fieldset>
        <div className="relative min-h-64 overflow-hidden rounded-2xl bg-[#06152f]"><img src={draft.hero === 'project' && source.projectImage ? source.projectImage : selectedKind.hero} alt={`${selectedKind.label} Titelmotiv`} className="absolute inset-0 h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-r from-[#06152f]/95 to-transparent" /><div className="relative max-w-[80%] p-6"><p className="text-xs font-bold uppercase text-[#8bf04a]">{selectedKind.label} · Exposé</p><h3 className="mt-6 break-words text-3xl font-extrabold">{draft.title}</h3><p className="mt-4 text-sm text-slate-300">{data?.location || source.data.location}</p></div></div>
        <p className="text-xs text-slate-400">{draft.hero === 'project' ? 'Hinterlegtes Projektfoto.' : 'Symbolmotiv für den gewählten Projekttyp.'} Das Titelbild wird auch im PDF verwendet.</p>
      </div> : null}

      {step === 4 && source && draft && data ? <div className="mt-5 space-y-5">
        <div className="flex items-start gap-3 rounded-xl bg-white/5 p-4"><FileText className="h-7 w-7 shrink-0 text-[#8bf04a]" /><div><h3 className="break-words font-extrabold">{draft.title}</h3><p className="mt-1 text-xs text-slate-400">{selectedKind?.label} · {selectedProject?.number} · {data?.location || source.data.location}</p></div></div>
        {draft.imported ? <dl className="space-y-2">{[...draft.imported.metrics, ...draft.imported.profile].map((row, index) => <div key={index} className="flex flex-wrap justify-between gap-2 border-b border-white/10 py-2 text-sm"><dt className="text-slate-400">{row.label}</dt><dd>{row.value}</dd></div>)}</dl> : null}
        <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">{draft.summary || 'Keine Kurzbeschreibung eingetragen.'}</p>
        <ul className="space-y-2">{draft.highlights.filter(Boolean).map((text, index) => <li key={index} className="flex gap-2 text-sm"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#8bf04a]" />{text}</li>)}</ul>
        {!draft.imported && source.warnings.length ? <p className="rounded-xl border border-amber-300/30 p-3 text-sm text-amber-100">{source.warnings.length} offene Angaben. Bitte die Hinweise unter „Inhalte“ vor dem Versand prüfen.</p> : null}
        <button type="button" className={`${button} w-full bg-[#8bf04a] !text-[#06152f]`} disabled={saving || importing || !draft.title.trim()} onClick={save}><Save className="h-4 w-4" />{saving ? 'Wird gespeichert …' : saved ? 'Entwurf gespeichert' : 'Exposé-Entwurf speichern'}</button>
        <div className="overflow-x-auto rounded-xl bg-white p-3"><PrintButton data={data} projectId={projectId} /></div>
        <p className="text-xs leading-5 text-slate-400">Der Entwurf bleibt beim Projekt gespeichert. „PDF erstellen“ öffnet die Datei auf dem iPhone und lädt sie am Computer herunter.</p>
      </div> : null}
      {message ? <p role="status" className="mt-4 rounded-xl border border-blue-200/20 p-3 text-sm">{message}</p> : null}
      <div className="mt-7 flex justify-between gap-3 border-t border-blue-200/15 pt-5">
        <button type="button" className={button} disabled={step === 0 || busy || saving || importing} onClick={() => go(step - 1)}><ArrowLeft className="h-4 w-4" /> Zurück</button>
        {step < 4 ? <button type="button" className={`${button} bg-[#8bf04a] !text-[#06152f]`} disabled={!canNext || busy || saving || importing} onClick={() => go(step + 1)}>Weiter <ArrowRight className="h-4 w-4" /></button> : null}
      </div>
    </section>
  </div>
}
