'use client'

import { useState } from 'react'
import { Download, Languages } from 'lucide-react'
import { generateMemorandumPdf, PdfGenerationError, type MemorandumPdfData } from '@/lib/pdf/memorandumPdf'
import { markProjectOutputGenerated } from '@/lib/actions/project-output.actions'
import { markDocumentViewerOpen } from '@/lib/ema/appIntroNavigation'

type MemorandumLanguage = 'de' | 'en'

const translations: Record<string, string> = {
  Projekttyp: 'Project type', 'PV-Leistung': 'PV capacity', Leistung: 'Capacity', Kaufpreis: 'Purchase price',
  'Spez. Ertrag': 'Specific yield', Vergütung: 'Feed-in tariff', Pachtdauer: 'Lease term', Amortisation: 'Payback period',
  Standort: 'Location', Projektstatus: 'Project status', Netzanschluss: 'Grid connection', Einspeiseart: 'Feed-in model',
  Grundstück: 'Land area', Investitionsvolumen: 'Investment volume', Kapazität: 'Capacity', Dauer: 'Duration',
  Anschlussleistung: 'Grid capacity', Netzstatus: 'Grid status', Bestätigt: 'Confirmed', 'In Prüfung': 'Under review',
  'HV-Distanz': 'HV distance', Glasfaser: 'Fiber connection', Landkreis: 'District',
  'Straße / Flurstück': 'Street / parcel', 'GPS-Koordinaten': 'GPS coordinates', Grundstücksfläche: 'Site area',
  'Grundstückskosten / Pacht': 'Land cost / lease', 'Preis pro m²': 'Price per m²',
  'Standort & Grundstück': 'Location & site', 'Baurecht & Flächennutzung': 'Planning law & land use',
  'Aktuelle Nutzungsart': 'Current land use', 'Weitere Nutzung': 'Additional designation', Bebauungsplan: 'Zoning plan',
  'Rechenzentrum zulässig': 'Data center permitted', Planungshinweis: 'Planning note', Stromversorgung: 'Power supply',
  'Entfernung zur HV-Station': 'Distance to HV substation', 'HV-Station / Umspannwerk': 'HV station / substation',
  Netzbetreiber: 'Grid operator', 'IT-Leistung': 'IT capacity', Glasfaseranbindung: 'Fiber connectivity',
  'Glasfaser auf Grundstück': 'Fiber on site', 'Entfernung zur Glasfasertrasse': 'Distance to fiber route',
  Glasfaseranbieter: 'Fiber provider', 'Ansprechpartner & Prüfung': 'Contact & assessment', Ansprechpartner: 'Contact person',
  Telefon: 'Phone', 'E-Mail': 'Email', Prüfdatum: 'Assessment date', 'Zusätzliche Angaben': 'Additional notes',
  'Nicht bekannt': 'Unknown', 'Muss geprüft werden': 'Requires verification', 'In Aufstellung': 'In preparation',
  Sondergebiet: 'Special-purpose zone', Landwirtschaftlich: 'Agricultural', Industriell: 'Industrial',
  Gewerblich: 'Commercial', Mischgebiet: 'Mixed-use zone', Nein: 'No', Ja: 'Yes',
  'Transformator / Umspannwerk': 'Transformer / substation', Jahresproduktion: 'Annual production', Jahreserlös: 'Annual revenue',
  'Rendite p.a.': 'Annual return', Vorhanden: 'Available', 'Nicht vorhanden': 'Not available', 'Noch offen': 'Pending',
  'In Planung': 'In planning', 'Im Betrieb': 'Operational',
  'PV-Dachanlage': 'Rooftop PV project', 'PV-Freiflächenanlage': 'Ground-mounted PV project',
  Batteriespeicherprojekt: 'Battery storage project', 'PV- & BESS-Hybridprojekt': 'PV & BESS hybrid project',
  Windenergieprojekt: 'Wind energy project', Rechenzentrum: 'Data center project',
  Energieinfrastrukturprojekt: 'Energy infrastructure project',
}

function translateText(value: string): string {
  let result = translations[value] ?? value
  result = result
    .replace(/\bJahre\b/g, 'years')
    .replace(/Projektstatus:/g, 'Project status:')
    .replace(/Netzanschluss vorhanden/g, 'Grid connection available')
    .replace(/Spezifischer Ertrag von/g, 'Specific yield of')
    .replace(/Vergütung von/g, 'Feed-in tariff of')
    .replace(/Anschlussleistung/g, 'grid capacity')
    .replace(/Speicherleistung/g, 'storage power')
    .replace(/Kapazität/g, 'capacity')
    .replace(/Investitionsvolumen/g, 'Investment volume')
  return result
}

function dataForLanguage(data: MemorandumPdfData, language: MemorandumLanguage): MemorandumPdfData {
  if (language === 'de') return { ...data, language }
  return {
    ...data,
    language,
    typeLabel: translateText(data.typeLabel),
    status: translateText(data.status),
    summary: data.summary
      .replace(/^PV-Dachanlage in /, 'Rooftop PV project in ')
      .replace(/^PV-Freiflächenanlage in /, 'Ground-mounted PV project in ')
      .replace(/^Batteriespeicherprojekt in /, 'Battery storage project in ')
      .replace(/^Rechenzentrumsprojekt in /, 'Data center project in ')
      .replace(/mit den vorhandenen technischen und wirtschaftlichen Projektdaten\./, 'with the available technical and economic project data.')
      .replace(/mit den vorhandenen Leistungs-, Kapazitäts- und Entwicklungsdaten\./, 'with the available power, capacity and development data.')
      .replace(/mit den vorhandenen Anschluss-, Grundstücks- und Investitionsdaten\./, 'with the available grid, land and investment data.')
      .replace(/mit den hinterlegten technischen und wirtschaftlichen Kennzahlen\./, 'with the available technical and economic data.')
      .replace(/mit den verfügbaren Leistungs-, Kapazitäts- und Entwicklungsdaten\./, 'with the available power, capacity and development data.')
      .replace(/mit den hinterlegten Anschluss-, Grundstücks- und Investitionsdaten\./, 'with the available grid, land and investment data.'),
    metrics: data.metrics.map((item) => ({ label: translateText(item.label), value: translateText(item.value) })),
    profile: data.profile.map((item) => ({ label: translateText(item.label), value: translateText(item.value) })),
    highlights: data.highlights.map(translateText),
    dataCenterDetails: data.dataCenterDetails ? {
      ...data.dataCenterDetails,
      sections: data.dataCenterDetails.sections.map((section) => ({
        title: translateText(section.title),
        rows: section.rows.map((row) => ({ label: translateText(row.label), value: translateText(row.value) })),
      })),
    } : undefined,
  }
}

function buildFilename(projectName: string, projectNumber: string, language: MemorandumLanguage) {
  const namePart = projectName.replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '_').slice(0, 60)
  const numberPart = projectNumber && projectNumber !== '—' ? `_${projectNumber}` : ''
  return `Expose_${namePart || 'Projekt'}${numberPart}_${language.toUpperCase()}.pdf`
}

function isIosDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function currentProjectId() {
  const match = window.location.pathname.match(/^\/expose\/([^/]+)/)
  return match?.[1] ? decodeURIComponent(match[1]) : null
}

function openOrDownloadPdf(blob: Blob, filename: string) {
  const blobUrl = URL.createObjectURL(blob)
  if (isIosDevice()) {
    markDocumentViewerOpen()
    window.location.href = blobUrl
  }
  else {
    const anchor = document.createElement('a')
    anchor.href = blobUrl
    anchor.download = filename
    anchor.rel = 'noopener'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  }
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 120000)
}

interface PrintButtonProps { data: MemorandumPdfData }

export function PrintButton({ data }: PrintButtonProps) {
  const [isPreparing, setIsPreparing] = useState(false)
  const [language, setLanguage] = useState<MemorandumLanguage>('de')

  const createPdf = async () => {
    if (isPreparing) return
    setIsPreparing(true)
    let step = 'Daten prüfen'
    try {
      step = 'PDF erzeugen'
      const blob = await generateMemorandumPdf(dataForLanguage(data, language))
      const projectId = currentProjectId()
      if (projectId) {
        step = 'Dokumentversion speichern'
        const result = await markProjectOutputGenerated(projectId, 'investment_memorandum')
        if (result.error) throw new Error(result.error)
      }
      step = 'PDF öffnen oder speichern'
      openOrDownloadPdf(blob, buildFilename(data.projectName, data.projectNumber, language))
    } catch (error) {
      const failedStep = error instanceof PdfGenerationError ? error.step : step
      const name = error instanceof Error ? error.name : 'Error'
      const message = error instanceof Error ? error.message : String(error)
      console.error('PDF-Erstellung fehlgeschlagen', { step: failedStep, name, message, error })
      window.alert(`Die PDF konnte nicht erstellt werden.\n\nSchritt: ${failedStep}\n${name}: ${message}`)
    } finally { setIsPreparing(false) }
  }

  return (
    <div className="print:hidden flex items-center gap-2">
      <label className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-[#0B1633]">
        <Languages className="h-4 w-4 text-[#5CB800]" />
        <select value={language} onChange={(event) => setLanguage(event.target.value as MemorandumLanguage)} className="bg-white outline-none">
          <option value="de">Deutsch</option>
          <option value="en">English</option>
        </select>
      </label>
      <button disabled={isPreparing} onClick={createPdf} className="inline-flex items-center gap-2 rounded-2xl bg-[#5CB800] px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-[#5CB800]/20 transition hover:-translate-y-0.5 hover:bg-[#4EA000] disabled:cursor-wait disabled:opacity-70">
        <Download className="h-4 w-4" />
        {isPreparing ? 'PDF wird erstellt…' : 'PDF erstellen'}
      </button>
    </div>
  )
}
