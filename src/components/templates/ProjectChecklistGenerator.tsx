'use client'

import { useState } from 'react'
import { AcroFormCheckBox, AcroFormComboBox, AcroFormTextField, jsPDF } from 'jspdf'
import { BatteryCharging, Download, PanelsTopLeft, X } from 'lucide-react'
import { toast } from 'sonner'

type ChecklistType = 'pv' | 'bess'
type Props = { onClose: () => void }
type TextRow = { label: string; name: string; value?: string; multiline?: boolean; kind?: 'text' }
type SelectRow = { label: string; name: string; kind: 'select'; options: string[] }
type StatusRow = { label: string; name: string; kind: 'status' }
type Row = TextRow | SelectRow | StatusRow
type Section = { title: string; rows: Row[] }

const navy = '#0B1633'
const green = '#5CB800'
const textColor = '#1F2A44'
const choose = 'Bitte auswählen'

const commonSections: Section[] = [
  {
    title: '1 · Projekt und Standort',
    rows: [
      { label: 'Projektname / Referenz', name: 'projekt_name' },
      { label: 'Adresse / Gemarkung / Flurstück', name: 'standort_adresse' },
      { label: 'PLZ, Ort, Bundesland', name: 'standort_ort' },
      {
        label: 'Projektstatus',
        name: 'projekt_status',
        kind: 'select',
        options: [choose, 'In Entwicklung', 'RTB', 'Im Betrieb'],
      },
      { label: 'Geplante Inbetriebnahme', name: 'projekt_inbetriebnahme' },
      {
        label: 'Exklusivität / Vermarktungsrecht',
        name: 'projekt_exklusivitaet',
        kind: 'select',
        options: [choose, 'Ja', 'Nein', 'In Klärung'],
      },
    ],
  },
]

const pvSections: Section[] = [
  {
    title: '2 · PV-Kerndaten',
    rows: [
      {
        label: 'Anlagentyp',
        name: 'pv_anlagentyp',
        kind: 'select',
        options: [choose, 'Freifläche', 'Dachanlage', 'Agri-PV', 'Sonstiges'],
      },
      { label: 'PV-Leistung DC (kWp / MWp)', name: 'pv_leistung_dc' },
      { label: 'Verfügbare Fläche (ha / m²)', name: 'pv_flaeche' },
      {
        label: 'Flächensicherung',
        name: 'pv_flaechensicherung',
        kind: 'select',
        options: [choose, 'Gesichert', 'In Verhandlung', 'Nicht gesichert'],
      },
      { label: 'Pachtdauer / wesentliche Konditionen', name: 'pv_pacht' },
    ],
  },
  {
    title: '3 · Netz und Genehmigung',
    rows: [
      { label: 'Netzbetreiber', name: 'pv_netzbetreiber' },
      { label: 'Netzverknüpfungspunkt / Entfernung', name: 'pv_nvp' },
      {
        label: 'Status Netzanfrage',
        name: 'pv_netzanfrage_status',
        kind: 'select',
        options: [choose, 'Nicht gestellt', 'Gestellt', 'In Prüfung', 'Netzzusage vorhanden', 'Netzanschlussvertrag'],
      },
      { label: 'Zugesagte Leistung / Netzanschlusskosten', name: 'pv_netzzusage' },
      {
        label: 'Planungsrecht',
        name: 'pv_planungsrecht',
        kind: 'select',
        options: [choose, 'Nicht begonnen', 'In Bearbeitung', 'Gesichert', 'Nicht erforderlich'],
      },
      {
        label: 'Baugenehmigung',
        name: 'pv_baugenehmigung',
        kind: 'select',
        options: [choose, 'Nicht beantragt', 'Beantragt', 'Erteilt', 'Nicht erforderlich'],
      },
    ],
  },
  {
    title: '4 · Ertrag und Kaufpreis',
    rows: [
      { label: 'Spezifischer Ertrag (kWh/kWp)', name: 'pv_spez_ertrag' },
      { label: 'Jahresproduktion (kWh / MWh)', name: 'pv_jahresproduktion' },
      {
        label: 'Vermarktungsmodell',
        name: 'pv_vermarktung',
        kind: 'select',
        options: [choose, 'EEG', 'PPA', 'Direktvermarktung', 'Sonstiges'],
      },
      { label: 'Vergütung / Laufzeit', name: 'pv_verguetung' },
      { label: 'Kaufpreis gesamt / Preis je kWp', name: 'pv_kaufpreis' },
    ],
  },
]

const bessSections: Section[] = [
  {
    title: '2 · BESS-Kerndaten',
    rows: [
      { label: 'Leistung (MW)', name: 'bess_leistung' },
      { label: 'Kapazität (MWh)', name: 'bess_kapazitaet' },
      {
        label: 'Speicherdauer',
        name: 'bess_dauer',
        kind: 'select',
        options: [choose, '0,5 Stunden', '1 Stunde', '2 Stunden', '4 Stunden', 'Flexibel'],
      },
      {
        label: 'Technologie / Zellchemie',
        name: 'bess_chemie',
        kind: 'select',
        options: [choose, 'Lithium-Ionen', 'Natrium-Ionen', 'Redox-Flow', 'Sonstiges'],
      },
      { label: 'Verfügbare Fläche', name: 'bess_flaeche' },
      {
        label: 'Flächensicherung',
        name: 'bess_flaechensicherung',
        kind: 'select',
        options: [choose, 'Gesichert', 'In Verhandlung', 'Nicht gesichert'],
      },
    ],
  },
  {
    title: '3 · Netz und Genehmigung',
    rows: [
      { label: 'Netzbetreiber', name: 'bess_netzbetreiber' },
      { label: 'Netzverknüpfungspunkt / Entfernung', name: 'bess_nvp' },
      {
        label: 'Status Netzanfrage',
        name: 'bess_netzanfrage_status',
        kind: 'select',
        options: [choose, 'Nicht gestellt', 'Gestellt', 'In Prüfung', 'Netzzusage vorhanden', 'Netzanschlussvertrag'],
      },
      { label: 'Zugesagte Bezugs- / Einspeiseleistung', name: 'bess_netzzusage' },
      {
        label: 'Baugenehmigung',
        name: 'bess_baugenehmigung',
        kind: 'select',
        options: [choose, 'Nicht beantragt', 'Beantragt', 'Erteilt', 'Nicht erforderlich'],
      },
      {
        label: 'Brandschutzkonzept',
        name: 'bess_brandschutz',
        kind: 'select',
        options: [choose, 'Nicht vorhanden', 'In Bearbeitung', 'Vorhanden'],
      },
    ],
  },
  {
    title: '4 · Erlös und Kaufpreis',
    rows: [
      {
        label: 'Hauptanwendung',
        name: 'bess_use_case',
        kind: 'select',
        options: [choose, 'Arbitrage', 'Regelenergie', 'Netzdienstleistung', 'PV-Hybrid', 'Kombination'],
      },
      {
        label: 'Erlösgutachten / Marktstudie',
        name: 'bess_erloesgutachten',
        kind: 'select',
        options: [choose, 'Nicht vorhanden', 'In Bearbeitung', 'Vorhanden'],
      },
      { label: 'Kaufpreis gesamt / Preis je MW / MWh', name: 'bess_kaufpreis' },
      { label: 'CAPEX / OPEX', name: 'bess_capex' },
      { label: 'Geplante Inbetriebnahme', name: 'bess_inbetriebnahme' },
    ],
  },
]

const documentRows: Record<ChecklistType, StatusRow[]> = {
  pv: [
    'Exposé / Projektbeschreibung',
    'Lageplan / Katasterkarte',
    'Flächensicherungsvertrag',
    'Netzanfrage / Netzzusage',
    'Genehmigungsunterlagen',
    'Ertragsgutachten / PV*SOL',
    'Technisches Layout',
    'Kaufpreisaufstellung',
  ].map((label, index) => ({ label, name: 'pv_dokument_' + (index + 1), kind: 'status' as const })),
  bess: [
    'Exposé / Projektbeschreibung',
    'Lageplan / Katasterkarte',
    'Flächensicherungsvertrag',
    'Netzanfrage / Netzzusage',
    'Genehmigungsunterlagen',
    'Brandschutzkonzept',
    'Technisches Konzept',
    'Kaufpreisaufstellung',
  ].map((label, index) => ({ label, name: 'bess_dokument_' + (index + 1), kind: 'status' as const })),
}

export function createChecklistPdf(type: ChecklistType, logoDataUrl?: string) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const sections = [
    ...commonSections,
    ...(type === 'pv' ? pvSections : bessSections),
    {
      title: '5 · Beizufügende Unterlagen',
      rows: documentRows[type],
    },
    {
      title: '6 · Hinweise und Bestätigung',
      rows: [
        { label: 'Hinweise / offene Punkte', name: type + '_hinweise', multiline: true },
        { label: 'Ort, Datum', name: type + '_ort_datum' },
        { label: 'Name', name: type + '_name' },
        { label: 'Unterschrift / digitale Bestätigung', name: type + '_unterschrift' },
      ],
    },
  ] satisfies Section[]
  let y = 0

  const addHeader = () => {
    doc.setFillColor(navy)
    doc.rect(0, 0, 210, 28, 'F')
    doc.setFillColor(green)
    doc.rect(0, 28, 210, 2.4, 'F')
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'PNG', 160, 6, 31, 15.3, undefined, 'FAST')
    }
    doc.setTextColor(255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.text('PROJEKT-CHECKLISTE · ' + type.toUpperCase(), 18, 13)
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'normal')
    doc.text('EMA Enterprise GmbH · Blanko-Formular', 18, 21)
    doc.setTextColor(textColor)
    y = 40
  }

  const addTextField = (row: TextRow) => {
    const height = row.multiline ? 24 : 9
    doc.setTextColor(textColor)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.2)
    doc.text(doc.splitTextToSize(row.label, 62), 18, y + 5)
    const field = new AcroFormTextField()
    field.fieldName = row.name
    field.x = 83
    field.y = y
    field.width = 109
    field.height = height
    field.fontSize = 8
    field.multiline = Boolean(row.multiline)
    field.value = row.value ?? ''
    field.defaultValue = field.value
    doc.addField(field)
    doc.setDrawColor(209, 216, 226)
    doc.roundedRect(83, y, 109, height, 1.4, 1.4, 'S')
    y += height + 3
  }

  const addSelectField = (row: SelectRow) => {
    doc.setTextColor(textColor)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.2)
    doc.text(doc.splitTextToSize(row.label, 62), 18, y + 5)
    const field = new AcroFormComboBox()
    field.fieldName = row.name
    field.x = 83
    field.y = y
    field.width = 109
    field.height = 9
    field.fontSize = 8
    field.setOptions(row.options)
    field.value = row.options[0]
    field.defaultValue = row.options[0]
    field.commitOnSelChange = true
    doc.addField(field)
    doc.setDrawColor(92, 184, 0)
    doc.roundedRect(83, y, 109, 9, 1.4, 1.4, 'S')
    doc.setFillColor(92, 184, 0)
    doc.triangle(185, y + 3.3, 189, y + 3.3, 187, y + 6.1, 'F')
    y += 12
  }

  const addStatusField = (row: StatusRow) => {
    doc.setTextColor(textColor)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.2)
    doc.text(doc.splitTextToSize(row.label, 88), 18, y + 4.5)
    const choices = [
      ['vorhanden', 'Vorhanden', 108],
      ['folgt', 'Folgt', 139],
      ['nein', 'Nicht vorhanden', 162],
    ] as const
    for (const [value, label, x] of choices) {
      const box = new AcroFormCheckBox()
      box.fieldName = row.name + '_' + value
      box.x = x
      box.y = y
      box.width = 4.2
      box.height = 4.2
      box.appearanceState = 'Off'
      doc.addField(box)
      doc.setDrawColor(92, 184, 0)
      doc.rect(x, y, 4.2, 4.2, 'S')
      doc.setFontSize(7)
      doc.text(label, x + 5.5, y + 3.5)
    }
    y += 9
  }

  addHeader()
  for (const section of sections) {
    const estimatedHeight = 13 + section.rows.reduce(
      (sum, row) => sum + ('multiline' in row && row.multiline ? 27 : 12),
      0,
    )
    if (y > 240 || y + Math.min(estimatedHeight, 46) > 278) {
      doc.addPage()
      addHeader()
    }
    doc.setFillColor(244, 247, 250)
    doc.roundedRect(16, y - 2, 178, 10, 2, 2, 'F')
    doc.setTextColor(navy)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.text(section.title, 20, y + 4.5)
    y += 13

    for (const row of section.rows) {
      const requiredHeight = 'multiline' in row && row.multiline ? 30 : 12
      if (y + requiredHeight > 279) {
        doc.addPage()
        addHeader()
        doc.setTextColor(navy)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.text(section.title + ' · Fortsetzung', 18, y)
        y += 8
      }
      if (row.kind === 'status') addStatusField(row)
      else if (row.kind === 'select') addSelectField(row)
      else addTextField(row)
    }
    y += 4
  }

  const pageCount = doc.getNumberOfPages()
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    doc.setPage(pageNumber)
    doc.setDrawColor(226, 232, 240)
    doc.line(18, 286, 192, 286)
    doc.setTextColor(110)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.2)
    doc.text('Vertraulich · Bitte digital ausfüllen und an EMA Enterprise GmbH zurücksenden.', 18, 291)
    doc.text(pageNumber + ' / ' + pageCount, 192, 291, { align: 'right' })
  }

  doc.setProperties({
    title: 'Projekt-Checkliste ' + type.toUpperCase(),
    subject: 'Digital ausfüllbare Blanko-Checkliste für Energieprojekte',
    author: 'EMA Enterprise GmbH',
    creator: 'EMA Intelligence',
  })
  return doc
}

async function loadEmaLogoDataUrl() {
  const response = await fetch('/brand/ema-mark-white.png')
  if (!response.ok) throw new Error('EMA-Logo konnte nicht geladen werden.')
  const blob = await response.blob()
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('EMA-Logo konnte nicht gelesen werden.'))
    reader.readAsDataURL(blob)
  })
}

export function ProjectChecklistGenerator({ onClose }: Props) {
  const [type, setType] = useState<ChecklistType>('pv')
  const [downloading, setDownloading] = useState(false)

  const download = async () => {
    setDownloading(true)
    try {
      const logoDataUrl = await loadEmaLogoDataUrl()
      const doc = createChecklistPdf(type, logoDataUrl)
      doc.save('EMA_Projekt-Checkliste_' + type.toUpperCase() + '_Blanko.pdf')
      toast.success(type.toUpperCase() + '-Blanko-Checkliste wurde heruntergeladen.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'PDF konnte nicht erstellt werden.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/50 p-3 md:items-center">
      <div className="w-full max-w-2xl rounded-[2rem] bg-white p-5 shadow-2xl md:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.12em] text-[#2F8A00]">Meine Dokumente</p>
            <h2 className="mt-1 text-2xl font-extrabold text-[#07142F]">Blanko-Projektcheckliste</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Projektart auswählen und die kompakte PDF zum digitalen Ausfüllen herunterladen.
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn-icon" aria-label="Schließen">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            aria-pressed={type === 'pv'}
            onClick={() => setType('pv')}
            className={'flex min-h-28 flex-col items-center justify-center rounded-2xl border px-4 py-4 font-extrabold transition ' + (
              type === 'pv'
                ? 'border-[#5CB800] bg-[#5CB800] text-white shadow-lg shadow-[#5CB800]/20'
                : 'border-slate-200 text-[#1F2A44]'
            )}
          >
            <PanelsTopLeft className="h-7 w-7" />
            <span className="mt-2">PV-Projekt</span>
          </button>
          <button
            type="button"
            aria-pressed={type === 'bess'}
            onClick={() => setType('bess')}
            className={'flex min-h-28 flex-col items-center justify-center rounded-2xl border px-4 py-4 font-extrabold transition ' + (
              type === 'bess'
                ? 'border-[#5CB800] bg-[#5CB800] text-white shadow-lg shadow-[#5CB800]/20'
                : 'border-slate-200 text-[#1F2A44]'
            )}
          >
            <BatteryCharging className="h-7 w-7" />
            <span className="mt-2">BESS-Projekt</span>
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-[#5CB800]/20 bg-[#5CB800]/5 p-4 text-sm leading-6 text-[#1F2A44]">
          <p>
            Die PDF selbst enthält echte Textfelder, Auswahllisten und Ankreuzfelder. Sie wird nicht in EMA gespeichert.
          </p>
          <p className="mt-2 font-bold text-[#2F8A00]">
            iPhone: Die Safari-Ansicht ist nur eine Vorschau. PDF herunterladen, in „Vorschau“ oder Adobe Acrobat öffnen und dort „Formular ausfüllen“ wählen.
          </p>
        </div>

        <button
          type="button"
          onClick={download}
          disabled={downloading}
          className="btn-primary mt-5 inline-flex w-full items-center justify-center gap-2"
        >
          <Download className="h-4 w-4" />
          {downloading ? 'PDF wird erstellt…' : type.toUpperCase() + '-PDF ausfüllbar herunterladen'}
        </button>
      </div>
    </div>
  )
}
