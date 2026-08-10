'use client'

import { useState } from 'react'
import { AcroFormCheckBox, AcroFormTextField, jsPDF } from 'jspdf'
import { BatteryCharging, PanelsTopLeft, Save, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createTemplateDocumentRecord } from '@/lib/actions/template-document.actions'
import { createClient } from '@/lib/supabase/client'

type ChecklistType = 'pv' | 'bess'
type FolderItem = { id: string; name: string }
type Props = { userId: string; folders: FolderItem[]; onClose: () => void }
type TextRow = { label: string; name: string; value?: string; multiline?: boolean; kind?: 'text' }
type StatusRow = { label: string; name: string; kind: 'status' }
type Row = TextRow | StatusRow
type Section = { title: string; rows: Row[] }

const navy = '#0B1633'
const green = '#5CB800'
const textColor = '#1F2A44'

const commonSections: Section[] = [
  {
    title: '1 · Anbieter und Projektverantwortung',
    rows: [
      { label: 'Unternehmen / Projektgesellschaft', name: 'anbieter_unternehmen' },
      { label: 'Ansprechpartner', name: 'anbieter_ansprechpartner' },
      { label: 'E-Mail', name: 'anbieter_email' },
      { label: 'Telefon', name: 'anbieter_telefon' },
      { label: 'Rolle / Vertriebsmandat', name: 'anbieter_rolle' },
      { label: 'Eigentümer der Projektrechte', name: 'projektrechte_eigentuemer' },
    ],
  },
  {
    title: '2 · Projekt und Standort',
    rows: [
      { label: 'Projektname / Referenz', name: 'projekt_name' },
      { label: 'Adresse / Gemarkung', name: 'standort_adresse' },
      { label: 'PLZ, Ort, Bundesland', name: 'standort_ort' },
      { label: 'Koordinaten', name: 'standort_koordinaten' },
      { label: 'Projektstatus (Entwicklung / RTB / Betrieb)', name: 'projekt_status' },
      { label: 'Geplante Inbetriebnahme', name: 'projekt_inbetriebnahme' },
      { label: 'Exklusivität / Vermarktungsrecht gesichert', name: 'projekt_exklusivitaet' },
    ],
  },
]

const pvSections: Section[] = [
  {
    title: '3 · PV-Anlage und Fläche',
    rows: [
      { label: 'Anlagentyp (Freifläche / Dach)', name: 'pv_anlagentyp' },
      { label: 'PV-Leistung DC (kWp / MWp)', name: 'pv_leistung_dc' },
      { label: 'Einspeiseleistung AC (kW / MW)', name: 'pv_leistung_ac' },
      { label: 'Grundstück / Dachfläche (ha / m²)', name: 'pv_flaeche' },
      { label: 'Flurstücke / Eigentümer', name: 'pv_flurstuecke' },
      { label: 'Flächensicherung / Nutzungsrecht', name: 'pv_flaechensicherung' },
      { label: 'Pachtdauer und Pachtkonditionen', name: 'pv_pacht' },
      { label: 'Dachstatik / Baulast geprüft (bei Dach)', name: 'pv_dachstatik' },
    ],
  },
  {
    title: '4 · Netzanschluss',
    rows: [
      { label: 'Netzbetreiber', name: 'pv_netzbetreiber' },
      { label: 'Netzverknüpfungspunkt und Entfernung', name: 'pv_nvp' },
      { label: 'Spannungsebene', name: 'pv_spannung' },
      { label: 'Netzanfrage gestellt am', name: 'pv_netzanfrage_datum' },
      { label: 'Status der Netzanfrage', name: 'pv_netzanfrage_status' },
      { label: 'Netzzusage / reservierte Leistung', name: 'pv_netzzusage' },
      { label: 'Netzanschlusskosten', name: 'pv_netzkosten' },
      { label: 'Voraussichtlicher Netzanschlusstermin', name: 'pv_netztermin' },
    ],
  },
  {
    title: '5 · Genehmigung und Planung',
    rows: [
      { label: 'Planungsrecht / Bebauungsplan', name: 'pv_planungsrecht' },
      { label: 'Baugenehmigung', name: 'pv_baugenehmigung' },
      { label: 'Natur- und Artenschutzprüfung', name: 'pv_naturschutz' },
      { label: 'Boden- / Altlastenprüfung', name: 'pv_boden' },
      { label: 'Kabeltrasse und Wegerechte', name: 'pv_kabeltrasse' },
      { label: 'Weitere Auflagen / offene Punkte', name: 'pv_auflagen', multiline: true },
    ],
  },
  {
    title: '6 · Technik, Ertrag und Wirtschaftlichkeit',
    rows: [
      { label: 'Module / Wechselrichter / Unterkonstruktion', name: 'pv_technik' },
      { label: 'Spezifischer Ertrag (kWh/kWp)', name: 'pv_spez_ertrag' },
      { label: 'Jahresproduktion (kWh / MWh)', name: 'pv_jahresproduktion' },
      { label: 'Ertragsgutachten / PV*SOL vorhanden', name: 'pv_ertragsgutachten' },
      { label: 'Vermarktung (EEG / PPA / Markt)', name: 'pv_vermarktung' },
      { label: 'Vergütung und Laufzeit', name: 'pv_verguetung' },
      { label: 'Kaufpreis gesamt / Preis je kWp', name: 'pv_kaufpreis' },
      { label: 'Im Kaufpreis enthaltene Leistungen', name: 'pv_preisumfang' },
    ],
  },
]

const bessSections: Section[] = [
  {
    title: '3 · Speicher und Grundstück',
    rows: [
      { label: 'BESS-Leistung (MW)', name: 'bess_leistung' },
      { label: 'BESS-Kapazität (MWh)', name: 'bess_kapazitaet' },
      { label: 'Speicherdauer (Stunden)', name: 'bess_dauer' },
      { label: 'Technologie / Zellchemie', name: 'bess_chemie' },
      { label: 'Hersteller / Integrator', name: 'bess_hersteller' },
      { label: 'Grundstücksbedarf / verfügbare Fläche', name: 'bess_flaeche' },
      { label: 'Flächensicherung / Pacht / Eigentum', name: 'bess_flaechensicherung' },
      { label: 'Erweiterbarkeit / Skalierung', name: 'bess_skalierung' },
    ],
  },
  {
    title: '4 · Netzanschluss',
    rows: [
      { label: 'Netzbetreiber', name: 'bess_netzbetreiber' },
      { label: 'Netzverknüpfungspunkt und Entfernung', name: 'bess_nvp' },
      { label: 'Spannungsebene', name: 'bess_spannung' },
      { label: 'Netzanfrage gestellt am', name: 'bess_netzanfrage_datum' },
      { label: 'Status der Netzanfrage', name: 'bess_netzanfrage_status' },
      { label: 'Bezugs- / Einspeiseleistung zugesagt', name: 'bess_netzzusage' },
      { label: 'Netzanschlusskosten und Termin', name: 'bess_netzkosten' },
      { label: 'Trafo / Umspannwerk vorgesehen', name: 'bess_trafo' },
    ],
  },
  {
    title: '5 · Genehmigung, Sicherheit und Infrastruktur',
    rows: [
      { label: 'Baugenehmigung / Planungsrecht', name: 'bess_baugenehmigung' },
      { label: 'Brandschutzkonzept', name: 'bess_brandschutz' },
      { label: 'Schall- / Immissionsschutz', name: 'bess_schall' },
      { label: 'Umwelt- / Wasserrecht', name: 'bess_umwelt' },
      { label: 'Technische Anschlussregeln geprüft', name: 'bess_tar' },
      { label: 'Glasfaser / Telekommunikation', name: 'bess_glasfaser' },
      { label: 'Weitere Auflagen / offene Punkte', name: 'bess_auflagen', multiline: true },
    ],
  },
  {
    title: '6 · Technik und Wirtschaftlichkeit',
    rows: [
      { label: 'Wirkungsgrad / Zyklen / Degradation', name: 'bess_kennwerte' },
      { label: 'Garantie und Gewährleistung', name: 'bess_garantie' },
      { label: 'EMS / Leitwarte / Vermarkter', name: 'bess_ems' },
      { label: 'Use Cases / Erlösquellen', name: 'bess_use_cases' },
      { label: 'Erlösgutachten / Marktstudie', name: 'bess_erloesgutachten' },
      { label: 'Kaufpreis gesamt / Preis je MW / MWh', name: 'bess_kaufpreis' },
      { label: 'CAPEX / OPEX und enthaltene Leistungen', name: 'bess_capex' },
      { label: 'Beschaffung und Inbetriebnahme', name: 'bess_zeitplan' },
    ],
  },
]

const documentRows: Record<ChecklistType, StatusRow[]> = {
  pv: [
    'Exposé / Projektbeschreibung', 'Lageplan und Katasterkarte', 'Flächensicherungsvertrag',
    'Netzanfrage / Netzanschlusszusage', 'Genehmigungsunterlagen', 'Kabeltrassen- und Wegerechte',
    'Ertragsgutachten / PV*SOL', 'Technisches Layout / Single-Line', 'Kosten- und Kaufpreisaufstellung',
    'Projektzeitplan und Nachweis der Projektrechte',
  ].map((label, index) => ({ label, name: `pv_dokument_${index + 1}`, kind: 'status' as const })),
  bess: [
    'Exposé / Projektbeschreibung', 'Lageplan und Katasterkarte', 'Flächensicherungsvertrag',
    'Netzanfrage / Netzanschlusszusage', 'Genehmigungsunterlagen', 'Brandschutz- und Schallkonzept',
    'Technisches Konzept / Single-Line', 'Erlösgutachten / Marktstudie', 'Kosten- und Kaufpreisaufstellung',
    'Projektzeitplan und Nachweis der Projektrechte',
  ].map((label, index) => ({ label, name: `bess_dokument_${index + 1}`, kind: 'status' as const })),
}

function safeFilePart(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9äöüÄÖÜß_-]+/g, '_').replace(/^_+|_+$/g, '') || 'Blanko'
}

export function createChecklistPdf(type: ChecklistType, prefill: { recipient: string; contact: string; project: string; deadline: string }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const sections = [...commonSections, ...(type === 'pv' ? pvSections : bessSections), {
    title: '7 · Beizufügende Unterlagen',
    rows: documentRows[type],
  }, {
    title: '8 · Ergänzende Hinweise und Bestätigung',
    rows: [
      { label: 'Zusätzliche Hinweise / Besonderheiten', name: `${type}_hinweise`, multiline: true },
      { label: 'Ort, Datum', name: `${type}_ort_datum` },
      { label: 'Name und Funktion', name: `${type}_unterschrift_name` },
      { label: 'Unterschrift / digitale Bestätigung', name: `${type}_unterschrift` },
    ],
  }] satisfies Section[]

  const prefilledValues: Record<string, string> = {
    anbieter_unternehmen: prefill.recipient,
    anbieter_ansprechpartner: prefill.contact,
    projekt_name: prefill.project,
    projekt_inbetriebnahme: '',
  }
  let y = 0

  const addHeader = () => {
    doc.setFillColor(navy); doc.rect(0, 0, 210, 28, 'F')
    doc.setFillColor(green); doc.rect(0, 28, 210, 2.4, 'F')
    doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(15)
    doc.text(`PROJEKT-ANGEBOTSCHECKLISTE · ${type.toUpperCase()}`, 18, 13)
    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal')
    doc.text('EMA Enterprise GmbH · vom Anbieter vollständig auszufüllen', 18, 21)
    doc.setTextColor(textColor); doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
    doc.text(`Rückgabe bis: ${prefill.deadline || '________________'}`, 192, 21, { align: 'right' })
    y = 40
  }

  const addTextField = (row: TextRow) => {
    const height = row.multiline ? 24 : 9
    doc.setTextColor(textColor); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.2)
    const labelLines = doc.splitTextToSize(row.label, 62)
    doc.text(labelLines, 18, y + 5)
    const field = new AcroFormTextField()
    field.fieldName = row.name
    field.x = 83; field.y = y; field.width = 109; field.height = height
    field.fontSize = 8; field.multiline = Boolean(row.multiline)
    field.value = prefilledValues[row.name] ?? row.value ?? ''
    field.defaultValue = field.value
    doc.addField(field)
    doc.setDrawColor(209, 216, 226); doc.roundedRect(83, y, 109, height, 1.4, 1.4, 'S')
    y += height + 3
  }

  const addStatusField = (row: StatusRow) => {
    doc.setTextColor(textColor); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.2)
    doc.text(doc.splitTextToSize(row.label, 94), 18, y + 4.5)
    const choices = [['vorhanden', 'Vorhanden', 112], ['folgt', 'Folgt', 140], ['nein', 'Nicht vorhanden', 163]] as const
    for (const [value, label, x] of choices) {
      const box = new AcroFormCheckBox()
      box.fieldName = `${row.name}_${value}`
      box.x = x; box.y = y; box.width = 4.2; box.height = 4.2
      box.appearanceState = 'Off'
      doc.addField(box)
      doc.setDrawColor(92, 184, 0); doc.rect(x, y, 4.2, 4.2, 'S')
      doc.setFontSize(7); doc.text(label, x + 5.5, y + 3.5)
    }
    y += 9
  }

  addHeader()
  for (const section of sections) {
    const estimatedHeight = 13 + section.rows.reduce((sum, row) => sum + ('multiline' in row && row.multiline ? 27 : 12), 0)
    if (y > 240 || y + Math.min(estimatedHeight, 46) > 278) {
      doc.addPage(); addHeader()
    }
    doc.setFillColor(244, 247, 250); doc.roundedRect(16, y - 2, 178, 10, 2, 2, 'F')
    doc.setTextColor(navy); doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5)
    doc.text(section.title, 20, y + 4.5)
    y += 13
    for (const row of section.rows) {
      const requiredHeight = 'multiline' in row && row.multiline ? 30 : 12
      if (y + requiredHeight > 279) {
        doc.addPage(); addHeader()
        doc.setTextColor(navy); doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
        doc.text(`${section.title} · Fortsetzung`, 18, y)
        y += 8
      }
      if (row.kind === 'status') addStatusField(row)
      else addTextField(row)
    }
    y += 4
  }

  const pageCount = doc.getNumberOfPages()
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    doc.setPage(pageNumber)
    doc.setDrawColor(226, 232, 240); doc.line(18, 286, 192, 286)
    doc.setTextColor(110); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.2)
    doc.text('Vertraulich · Angaben des Anbieters werden im Rahmen der Projektprüfung verwendet.', 18, 291)
    doc.text(`${pageNumber} / ${pageCount}`, 192, 291, { align: 'right' })
  }
  doc.setProperties({
    title: `Projekt-Angebotscheckliste ${type.toUpperCase()}`,
    subject: 'Ausfüllbare Checkliste für neue Energieprojekte',
    author: 'EMA Enterprise GmbH',
    creator: 'EMA Intelligence',
  })
  return doc
}

export function ProjectChecklistGenerator({ userId, folders, onClose }: Props) {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ type: 'pv' as ChecklistType, recipient: '', contact: '', project: '', deadline: '', folderId: '' })
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }))

  const save = async () => {
    setSaving(true)
    const uploadedPaths: string[] = []
    try {
      const doc = createChecklistPdf(form.type, form)
      const blob = doc.output('blob')
      const date = new Date().toISOString().slice(0, 10)
      const subject = safeFilePart(form.project || form.recipient)
      const fileName = `Projekt-Angebotscheckliste_${form.type.toUpperCase()}_${subject}_${date}_v1.0.pdf`
      const path = `${userId}/${Date.now()}_${fileName}`
      const { error: uploadError } = await supabase.storage.from('template-documents').upload(path, blob, { contentType: 'application/pdf', cacheControl: '3600', upsert: false })
      if (uploadError) throw uploadError
      uploadedPaths.push(path)
      const result = await createTemplateDocumentRecord({
        displayName: `Projekt-Angebotscheckliste ${form.type.toUpperCase()}${form.project ? ` – ${form.project}` : ''} – v1.0`,
        category: 'checkliste',
        fileName,
        filePath: path,
        fileSizeBytes: blob.size,
        mimeType: 'application/pdf',
        folderId: form.folderId || null,
      })
      if (result.error) throw new Error(result.error)
      toast.success('Die ausfüllbare Checkliste wurde unter „Gespeicherte Dokumente“ abgelegt.')
      onClose()
      router.refresh()
    } catch (error) {
      if (uploadedPaths.length > 0) await supabase.storage.from('template-documents').remove(uploadedPaths)
      toast.error(error instanceof Error ? error.message : 'Checkliste konnte nicht erstellt werden.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/50 p-3 md:items-center">
      <div className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-[2rem] bg-white p-5 shadow-2xl md:p-7">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-xs font-extrabold uppercase tracking-[.12em] text-[#2F8A00]">Meine Dokumente</p><h2 className="mt-1 text-2xl font-extrabold text-[#07142F]">Projekt-Angebotscheckliste</h2><p className="mt-2 text-sm leading-6 text-slate-500">Erstellt eine ausfüllbare PDF für Partner oder Vertriebler. Wähle oben die passende Projektart.</p></div>
          <button type="button" onClick={onClose} className="btn-icon" aria-label="Schließen"><X className="h-5 w-5" /></button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button type="button" aria-pressed={form.type === 'pv'} onClick={() => set('type', 'pv')} className={`flex min-h-28 flex-col items-center justify-center rounded-2xl border px-4 py-4 font-extrabold transition ${form.type === 'pv' ? 'border-[#5CB800] bg-[#5CB800] text-white shadow-lg shadow-[#5CB800]/20' : 'border-slate-200 text-[#1F2A44]'}`}><PanelsTopLeft className="h-7 w-7" /><span className="mt-2">PV-Projekt</span></button>
          <button type="button" aria-pressed={form.type === 'bess'} onClick={() => set('type', 'bess')} className={`flex min-h-28 flex-col items-center justify-center rounded-2xl border px-4 py-4 font-extrabold transition ${form.type === 'bess' ? 'border-[#5CB800] bg-[#5CB800] text-white shadow-lg shadow-[#5CB800]/20' : 'border-slate-200 text-[#1F2A44]'}`}><BatteryCharging className="h-7 w-7" /><span className="mt-2">BESS-Projekt</span></button>
        </div>

        <div className="mt-6 rounded-2xl bg-slate-50 p-4">
          <p className="text-sm font-extrabold text-[#1F2A44]">Optionale Vorbelegung</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Leer lassen, wenn du eine neutrale Blanko-Checkliste erstellen möchtest.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input className="form-input" value={form.recipient} onChange={(event) => set('recipient', event.target.value)} placeholder="Unternehmen / Empfänger" />
            <input className="form-input" value={form.contact} onChange={(event) => set('contact', event.target.value)} placeholder="Ansprechpartner" />
            <input className="form-input" value={form.project} onChange={(event) => set('project', event.target.value)} placeholder="Projektname / Referenz" />
            <label className="text-xs font-bold text-slate-500"><span className="mb-1.5 block">Rückgabe bis</span><input type="date" className="form-input w-full" value={form.deadline} onChange={(event) => set('deadline', event.target.value)} /></label>
          </div>
        </div>

        <select className="form-input mt-4 w-full" value={form.folderId} onChange={(event) => set('folderId', event.target.value)}>
          <option value="">Kein Ordner</option>
          {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
        </select>
        <p className="mt-4 rounded-2xl border border-[#5CB800]/20 bg-[#5CB800]/5 p-4 text-sm leading-6 text-[#1F2A44]">Die PDF enthält echte Eingabefelder sowie Auswahlkästchen für „Vorhanden“, „Folgt“ und „Nicht vorhanden“. Nach dem Speichern findest du sie direkt in deiner Dokumentenliste.</p>
        <button type="button" onClick={save} disabled={saving} className="btn-primary mt-5 inline-flex w-full items-center justify-center gap-2"><Save className="h-4 w-4" />{saving ? 'Checkliste wird erstellt…' : `${form.type.toUpperCase()}-Checkliste erstellen und speichern`}</button>
      </div>
    </div>
  )
}
