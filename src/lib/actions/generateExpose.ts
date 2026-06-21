/**
 * EMA Intelligence – Exposé Generator V1 (regelbasiert)
 *
 * Dies ist KEINE KI-Generierung. Jede Sektion wird deterministisch aus den
 * tatsächlich vorhandenen Datenbankwerten zusammengesetzt. Fehlt ein Wert,
 * wird er als `null` geführt und in der UI als "nicht verfügbar" angezeigt –
 * niemals durch eine Schätzung, Annahme oder einen Platzhaltertext ersetzt.
 *
 * v1.1 wird optional eine KI-gestützte Formulierungsschicht (Anthropic API)
 * ergänzen, die auf denselben Daten aufsetzt – mit verpflichtender manueller
 * Freigabe vor Verwendung (siehe ai_outputs.status).
 */

import type { ExposeSourceData, GeneratedExpose, ExposeSection } from '@/lib/types/expose.types'
import { formatMW, formatDate } from '@/lib/utils'
import {
  PROJECT_TYPE_LABELS, PROJECT_STATUS_LABELS,
  DOCUMENT_TYPE_LABELS,
} from '@/lib/types/constants'

// ── Helper: einheitliche "nicht verfügbar"-Behandlung ─────────────────────────

function val(v: string | number | null | undefined): string | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number' && Number.isNaN(v)) return null
  const str = String(v).trim()
  return str.length > 0 ? str : null
}

function valMW(v: number | null | undefined, unit: 'MWp' | 'MW' | 'MWh'): string | null {
  // WICHTIG: formatMW() gibt bei fehlendem Wert den String '–' zurück, nicht null.
  // Hier muss VOR dem Aufruf geprüft werden, sonst würde '–' fälschlich als
  // "vorhandener Wert" durchgehen und nicht als "nicht verfügbar" markiert.
  if (v === null || v === undefined) return null
  return formatMW(v, unit)
}

// ── Hauptfunktion ──────────────────────────────────────────────────────────────

export function generateExpose(source: ExposeSourceData): GeneratedExpose {
  const { project, deal, partner, documents, linkedInvestors } = source

  const isPv   = project.project_type === 'pv_freiflaeche' || project.project_type === 'pv_dach'
  const isBess = project.project_type === 'bess'
  const isHybrid = project.project_type === 'hybrid'

  // ── 1. Deckblatt ─────────────────────────────────────────────────────────
  const coverTitle    = project.project_name
  const coverSubtitle = PROJECT_TYPE_LABELS[project.project_type]
  const coverProjectNumber = project.project_number
  const coverDate = formatDate(new Date().toISOString())

  // ── 2. Projektübersicht ──────────────────────────────────────────────────
  const overviewSection: ExposeSection = {
    id:    'overview',
    title: 'Projektübersicht',
    fields: [
      { label: 'Projektnummer', value: val(project.project_number) },
      { label: 'Projektname',   value: val(project.project_name) },
      { label: 'Projekttyp',    value: val(PROJECT_TYPE_LABELS[project.project_type]) },
      { label: 'Status',        value: val(PROJECT_STATUS_LABELS[project.status]) },
      { label: 'Partner',       value: partner ? val(partner.company ?? partner.full_name) : null },
      { label: 'Projekt angelegt', value: val(formatDate(project.created_at)) },
    ],
  }

  // ── 3. Technische Daten ──────────────────────────────────────────────────
  const technicalFields: { label: string; value: string | null }[] = []

  if (isPv || isHybrid) {
    technicalFields.push(
      { label: 'DC-Leistung', value: valMW(project.pv_mwp, 'MWp') },
      { label: 'AC-Leistung', value: valMW(project.pv_ac_mw, 'MW') },
    )
  }
  if (isBess || isHybrid) {
    technicalFields.push(
      { label: 'BESS-Leistung', value: valMW(project.bess_mw, 'MW') },
      { label: 'BESS-Energie',  value: valMW(project.bess_mwh, 'MWh') },
      { label: 'Speicherdauer', value: project.bess_duration_h !== null ? `${project.bess_duration_h} h` : null },
    )
  }
  if (technicalFields.length === 0) {
    technicalFields.push({ label: 'Technische Daten', value: null })
  }

  const technicalSection: ExposeSection = {
    id:     'technical',
    title:  'Technische Daten',
    fields: technicalFields,
  }

  // ── 4. Standort ──────────────────────────────────────────────────────────
  const locationSection: ExposeSection = {
    id:    'location',
    title: 'Standort',
    fields: [
      { label: 'Adresse',     value: val(project.location_address) },
      { label: 'Ort',         value: val(project.location_city) },
      { label: 'Bundesland',  value: val(project.location_state) },
      { label: 'Land',        value: val(project.location_country) },
    ],
  }

  // ── 5. Entwicklungsstand ─────────────────────────────────────────────────
  const devStatusLabels: Record<keyof typeof project.dev_status, string> = {
    netzanschluss:  'Netzanschluss',
    baugenehmigung: 'Baugenehmigung',
    pachtvertrag:   'Pachtvertrag',
    eeg_faehigkeit: 'EEG-Fähigkeit',
    gutachten:      'Gutachten',
    umweltpruefung: 'Umweltprüfung',
  }

  const devStatusToText = (v: boolean | null): string | null => {
    if (v === true)  return 'Erfüllt'
    if (v === false) return 'Nicht erfüllt'
    return null // offen / nicht erfasst → "nicht verfügbar"
  }

  const devSection: ExposeSection = {
    id:    'dev_status',
    title: 'Entwicklungsstand',
    fields: (Object.keys(devStatusLabels) as Array<keyof typeof devStatusLabels>).map((key) => ({
      label: devStatusLabels[key],
      value: devStatusToText(project.dev_status[key]),
    })),
  }

  // ── 6. Dokumentenstatus ──────────────────────────────────────────────────
  // Zeigt, welche Dokumentkategorien vorhanden sind. Kategorien ohne Upload
  // werden explizit als "nicht verfügbar" geführt, damit der Investor sieht,
  // was im Datenraum fehlt.
  const allDocCategories: Array<keyof typeof DOCUMENT_TYPE_LABELS> = [
    'expose', 'lageplan', 'netzanschluss', 'pachtvertrag',
    'genehmigung', 'gutachten', 'nda',
  ]

  const docsByCategory = new Map<string, number>()
  documents.forEach((d) => {
    docsByCategory.set(d.document_type, (docsByCategory.get(d.document_type) ?? 0) + 1)
  })

  const documentsSection: ExposeSection = {
    id:    'documents',
    title: 'Dokumentenstatus',
    fields: allDocCategories.map((cat) => {
      const count = docsByCategory.get(cat) ?? 0
      return {
        label: DOCUMENT_TYPE_LABELS[cat],
        value: count > 0 ? `${count} Dokument${count !== 1 ? 'e' : ''} vorhanden` : null,
      }
    }),
  }

  // ── 7. Investoren (falls verknüpft) ──────────────────────────────────────
  const investorSection: ExposeSection | null = linkedInvestors.length > 0
    ? {
        id:    'investors',
        title: 'Investorenstatus',
        fields: [
          { label: 'Verknüpfte Investoren', value: String(linkedInvestors.length) },
          { label: 'Status',                value: linkedInvestors.map((i) => i.status).join(', ') },
        ],
      }
    : null

  // ── Chancen & Risiken (regelbasiert aus vorhandenen Daten abgeleitet) ────
  // Jede Aussage hier basiert direkt auf einem konkreten Datenfeld – keine
  // generischen Marketing-Floskeln, keine Markteinschätzungen ohne Datenbasis.
  const opportunities: string[] = []
  const risks: string[] = []

  if (project.dev_status.netzanschluss === true) {
    opportunities.push('Netzanschluss ist gesichert.')
  } else if (project.dev_status.netzanschluss === false) {
    risks.push('Netzanschluss ist noch nicht gesichert.')
  }

  if (project.dev_status.baugenehmigung === true) {
    opportunities.push('Baugenehmigung liegt vor.')
  } else if (project.dev_status.baugenehmigung === false) {
    risks.push('Baugenehmigung steht noch aus.')
  }

  if (project.dev_status.pachtvertrag === true) {
    opportunities.push('Flächensicherung durch Pachtvertrag gegeben.')
  } else if (project.dev_status.pachtvertrag === false) {
    risks.push('Pachtvertrag ist noch nicht abgeschlossen.')
  }

  if (project.dev_status.eeg_faehigkeit === true) {
    opportunities.push('EEG-Fähigkeit ist bestätigt.')
  } else if (project.dev_status.eeg_faehigkeit === false) {
    risks.push('EEG-Fähigkeit ist nicht gegeben.')
  }

  if (deal?.deal_status === 'closed_won') {
    opportunities.push('Deal bereits erfolgreich abgeschlossen.')
  }

  if (documents.length === 0) {
    risks.push('Es sind noch keine Dokumente im Datenraum hinterlegt.')
  }

  const missingDevFields = Object.values(project.dev_status).filter((v) => v === null).length
  if (missingDevFields > 0) {
    risks.push(`${missingDevFields} von 6 Entwicklungsstand-Kriterien sind noch nicht erfasst.`)
  }

  // ── Vollständigkeits-Score ────────────────────────────────────────────────
  const allFields = [
    ...overviewSection.fields,
    ...technicalSection.fields,
    ...locationSection.fields,
    ...devSection.fields,
    ...documentsSection.fields,
  ]
  const filled = allFields.filter((f) => f.value !== null).length
  const total  = allFields.length

  const sections = [
    overviewSection,
    technicalSection,
    locationSection,
    devSection,
    documentsSection,
    ...(investorSection ? [investorSection] : []),
  ]

  return {
    coverTitle,
    coverSubtitle,
    coverProjectNumber,
    coverDate,
    sections,
    opportunities,
    risks,
    completeness: {
      filled,
      total,
      percent: total > 0 ? Math.round((filled / total) * 100) : 0,
    },
    generatedAt: new Date().toISOString(),
  }
}
