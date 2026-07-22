import { calculateMatchScore } from '@/lib/utils'
import { DOCUMENT_TYPE_LABELS } from '@/lib/types/constants'
import type { DocumentType } from '@/lib/types/database.types'
import type {
  AnalysisSourceData, GeneratedAnalysis, RiskItem,
  MissingDocument, InvestorFit, MarketingRecommendation, AnalysisDocumentType,
} from '@/lib/types/analysis.types'

const DEFAULT_REQUIRED_DOCUMENT_TYPES: AnalysisDocumentType[] = [
  'expose', 'lageplan', 'netzanschluss', 'pachtvertrag', 'genehmigung',
]

const ROOF_REQUIRED_DOCUMENT_TYPES: AnalysisDocumentType[] = [
  'expose', 'pvsol', 'netzanschluss', 'pachtvertrag',
]

function documentLabel(type: AnalysisDocumentType): string {
  return type === 'pvsol' ? 'PV-Sol' : DOCUMENT_TYPE_LABELS[type as DocumentType]
}

function normalize(value: string | null | undefined) {
  return (value ?? '')
    .toLocaleLowerCase('de-DE')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function automaticallyPresent(type: AnalysisDocumentType, documents: AnalysisSourceData['documents']) {
  return documents.some((document) => {
    const documentType = normalize(document.document_type)
    const text = `${normalize(document.display_name)} ${normalize(document.file_name)}`

    if (type === 'expose') return documentType === 'expose' || text.includes('expose') || text.includes('projekt expos')
    if (type === 'pvsol') return documentType === 'pvsol' || text.includes('pv sol') || text.includes('pvsol') || text.includes('ertragsprognose')
    if (type === 'netzanschluss') return documentType === 'netzanschluss' || text.includes('netzanschluss') || text.includes('netzverknupfung') || text.includes(' nvp ')
    if (type === 'pachtvertrag') return documentType === 'pachtvertrag' || text.includes('pachtvertrag') || text.includes('pacht vereinbarung')
    if (type === 'lageplan') return documentType === 'lageplan' || text.includes('lageplan')
    if (type === 'genehmigung') return documentType === 'genehmigung' || text.includes('genehmigung') || text.includes('baugenehmigung')
    return documentType === type
  })
}

export function generateProjectAnalysis(source: AnalysisSourceData): GeneratedAnalysis {
  const { project, deal, documents, documentChecklist, linkedInvestors } = source
  const isRoofProject = project.project_type === 'pv_dach'
  const requiredDocumentTypes = isRoofProject ? ROOF_REQUIRED_DOCUMENT_TYPES : DEFAULT_REQUIRED_DOCUMENT_TYPES

  const relevantDevStatus = isRoofProject
    ? {
        netzanschluss: project.dev_status.netzanschluss,
        pachtvertrag: project.dev_status.pachtvertrag,
        eeg_faehigkeit: project.dev_status.eeg_faehigkeit,
      }
    : project.dev_status

  const devValues = Object.values(relevantDevStatus)
  const completed = devValues.filter((value) => value === true).length
  const failed = devValues.filter((value) => value === false).length
  const open = devValues.filter((value) => value === null).length
  const total = devValues.length

  const devStatusScore = {
    completed,
    total,
    open,
    failed,
    percent: total > 0 ? Math.round((completed / total) * 100) : 0,
  }

  const manualStatus = new Map(documentChecklist.map((item) => [item.document_type, item.status]))
  const applicableDocumentTypes = requiredDocumentTypes.filter(
    (type) => manualStatus.get(type) !== 'nicht_erforderlich',
  )
  const missingDocuments: MissingDocument[] = applicableDocumentTypes
    .filter((type) => {
      const status = manualStatus.get(type)
      if (status === 'vorhanden') return false
      if (status === 'fehlt') return true
      return !automaticallyPresent(type, documents)
    })
    .map((type) => ({ type, label: documentLabel(type) }))

  const risks: RiskItem[] = []

  if (project.dev_status.netzanschluss === false) {
    risks.push({ severity: 'hoch', title: 'Netzanschluss nicht gesichert', description: 'Ohne gesicherten Netzanschluss ist das Projekt für Investoren nur eingeschränkt attraktiv.' })
  } else if (project.dev_status.netzanschluss === null) {
    risks.push({ severity: 'mittel', title: 'Netzanschluss-Status unbekannt', description: 'Der Status des Netzanschlusses ist im System nicht erfasst.' })
  }

  if (!isRoofProject) {
    if (project.dev_status.baugenehmigung === false) {
      risks.push({ severity: 'hoch', title: 'Baugenehmigung steht aus', description: 'Eine fehlende Baugenehmigung verzögert typischerweise den gesamten Projektzeitplan.' })
    } else if (project.dev_status.baugenehmigung === null) {
      risks.push({ severity: 'mittel', title: 'Baugenehmigungsstatus unbekannt', description: 'Der Status der Baugenehmigung ist im System nicht erfasst.' })
    }
  }

  if (project.dev_status.pachtvertrag === false) {
    risks.push({ severity: 'hoch', title: 'Flächensicherung fehlt', description: 'Ohne abgeschlossenen Pachtvertrag ist die Flächenverfügbarkeit nicht gesichert.' })
  } else if (project.dev_status.pachtvertrag === null) {
    risks.push({ severity: 'mittel', title: 'Pachtvertragsstatus unbekannt', description: 'Der Status des Pachtvertrags ist im System nicht erfasst.' })
  }

  if (project.dev_status.eeg_faehigkeit === false) {
    risks.push({ severity: 'mittel', title: 'EEG-Fähigkeit nicht gegeben', description: 'Eine fehlende EEG-Fähigkeit kann die Erlösstruktur des Projekts beeinträchtigen.' })
  }

  if (missingDocuments.length > 0) {
    risks.push({
      severity: missingDocuments.length >= 3 ? 'hoch' : 'mittel',
      title: `${missingDocuments.length} von ${applicableDocumentTypes.length} Kerndokumenten fehlen`,
      description: `Fehlende Dokumente: ${missingDocuments.map((document) => document.label).join(', ')}.`,
    })
  }

  if (deal === null) {
    risks.push({ severity: 'niedrig', title: 'Kein Deal angelegt', description: 'Für dieses Projekt ist noch keine Deal-Economics-Kalkulation hinterlegt.' })
  } else if (deal.net_profit !== null && deal.net_profit < 0) {
    risks.push({ severity: 'hoch', title: 'Negativer Nettogewinn', description: 'Die aktuelle Deal-Kalkulation weist einen negativen Nettogewinn aus.' })
  }

  if (project.last_activity_at) {
    const daysSinceActivity = Math.floor((Date.now() - new Date(project.last_activity_at).getTime()) / 86400000)
    if (daysSinceActivity > 30) {
      risks.push({ severity: 'mittel', title: `Keine Aktivität seit ${daysSinceActivity} Tagen`, description: 'Das Projekt zeigt seit über 30 Tagen keine erfasste Aktivität.' })
    }
  }

  const investorFit: InvestorFit[] = linkedInvestors.map((investor) => {
    const score = calculateMatchScore(
      investor.size_preferences,
      { pv: investor.interest_pv, bess: investor.interest_bess, hybrid: investor.interest_hybrid, wind: false },
      project.project_type,
      project.pv_mwp,
      project.bess_mwh,
    )
    const reasoning: string[] = []
    if (score >= 50) reasoning.push('Projekttyp entspricht dem Investoreninteresse.')
    if (score < 50) reasoning.push('Projekttyp entspricht nicht dem hinterlegten Investoreninteresse.')
    if (investor.size_preferences.length === 0) reasoning.push('Keine Größenpräferenz hinterlegt.')
    return { investorId: investor.investor_id, name: investor.company ?? investor.full_name, matchScore: score, reasoning }
  })

  const hasNoLinkedInvestors = linkedInvestors.length === 0
  const highRisks = risks.filter((risk) => risk.severity === 'hoch').length
  let marketingRecommendation: MarketingRecommendation
  const marketingReasoning: string[] = []

  if (devStatusScore.failed >= 2 || highRisks >= 2) {
    marketingRecommendation = 'nicht_vermarktungsfaehig'
    marketingReasoning.push(`${devStatusScore.failed} Entwicklungsstand-Kriterien sind nicht erfüllt, ${highRisks} Risiken mit hoher Schwere identifiziert.`)
  } else if (missingDocuments.length > 0 || devStatusScore.open > 2) {
    marketingRecommendation = 'unterlagen_vervollstaendigen'
    marketingReasoning.push(missingDocuments.length > 0 ? `${missingDocuments.length} Kerndokumente fehlen noch im Datenraum.` : `${devStatusScore.open} Entwicklungsstand-Kriterien sind noch nicht erfasst.`)
  } else if (devStatusScore.percent < 60) {
    marketingRecommendation = 'entwicklung_fortsetzen'
    marketingReasoning.push(`Entwicklungsstand liegt bei ${devStatusScore.percent}% – Projektentwicklung sollte vor Vermarktung fortgesetzt werden.`)
  } else {
    marketingRecommendation = 'bereit_zur_vermarktung'
    marketingReasoning.push(`Entwicklungsstand liegt bei ${devStatusScore.percent}%, keine hochgradigen Risiken identifiziert, Kerndokumente vollständig.`)
  }

  const docCompleteness = applicableDocumentTypes.length > 0
    ? Math.round(((applicableDocumentTypes.length - missingDocuments.length) / applicableDocumentTypes.length) * 100)
    : 100
  const riskPenalty = Math.min(100, highRisks * 20 + risks.filter((risk) => risk.severity === 'mittel').length * 10)
  const riskScore = Math.max(0, 100 - riskPenalty)
  const overallScore = Math.round(devStatusScore.percent * 0.5 + docCompleteness * 0.3 + riskScore * 0.2)

  return {
    projectId: project.id,
    projectNumber: project.project_number,
    analyzedAt: new Date().toISOString(),
    devStatusScore,
    missingDocuments,
    risks,
    investorFit,
    hasNoLinkedInvestors,
    marketingRecommendation,
    marketingReasoning,
    overallScore,
  }
}
