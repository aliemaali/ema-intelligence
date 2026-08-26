import { BESS_DD_CHECKLIST, type BessDdItem } from './bess'

export type DdDocument = {
  id: string
  display_name?: string | null
  file_name?: string | null
  document_type?: string | null
}

type EvidenceRule = {
  itemId: string
  terms: string[]
}

const RULES: EvidenceRule[] = [
  { itemId: 'land-rights', terms: ['pacht', 'grundstück', 'nutzungsvertrag', 'gestattung', 'land lease', 'lease'] },
  { itemId: 'grid-connection', terms: ['netzanschluss', 'netzanschlusszusage', 'netzbetreiber', 'grid connection', 'nvp'] },
  { itemId: 'grid-capacity', terms: ['netzkapazität', 'anschlussleistung', 'mw', 'mva', 'grid capacity'] },
  { itemId: 'permit-path', terms: ['genehmigung', 'bauantrag', 'baugenehmigung', 'permit'] },
  { itemId: 'planning-law', terms: ['bebauungsplan', 'bauleitplanung', 'flächennutzungsplan', 'planungsrecht'] },
  { itemId: 'fire-safety', terms: ['brandschutz', 'feuerwehr', 'fire safety', 'lösch'] },
  { itemId: 'battery-concept', terms: ['batterie', 'battery', 'pcs', 'transformator', 'trafo', 'single line'] },
  { itemId: 'layout', terms: ['layout', 'lageplan', 'site plan', 'zufahrt'] },
  { itemId: 'capex', terms: ['capex', 'kosten', 'budget', 'investment'] },
  { itemId: 'opex', terms: ['opex', 'betriebskosten', 'wartung', 'maintenance'] },
  { itemId: 'revenue', terms: ['erlös', 'revenue', 'vermarktung', 'arbitrage', 'regelenergie'] },
  { itemId: 'spv', terms: ['spv', 'gesellschaft', 'gesellschafter', 'shareholder', 'gesellschaftsvertrag'] },
  { itemId: 'timeline', terms: ['zeitplan', 'timeline', 'meilenstein', 'rtb', 'ready to build'] },
]

function normalizedDocumentText(document: DdDocument) {
  return [document.display_name, document.file_name, document.document_type]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('de-DE')
}

export function mapDocumentsToBessEvidence(documents: DdDocument[]): BessDdItem[] {
  return BESS_DD_CHECKLIST.map(base => {
    const rule = RULES.find(candidate => candidate.itemId === base.id)
    const matches = rule
      ? documents.filter(document => {
          const haystack = normalizedDocumentText(document)
          return rule.terms.some(term => haystack.includes(term.toLocaleLowerCase('de-DE')))
        })
      : []

    // A filename/type match is evidence availability, not proof of the claim.
    // Therefore it remains OPEN until document contents are actually reviewed.
    return {
      ...base,
      status: 'open',
      evidence: matches.length
        ? `${matches.length} mögliche${matches.length === 1 ? 'r' : ''} Nachweis${matches.length === 1 ? '' : 'e'} gefunden`
        : undefined,
      source: matches.map(document => document.display_name || document.file_name || document.id).join(', ') || undefined,
    }
  })
}

export function getEvidenceCoverage(items: BessDdItem[]) {
  const withEvidence = items.filter(item => Boolean(item.source)).length
  return {
    withEvidence,
    total: items.length,
    percent: items.length ? Math.round((withEvidence / items.length) * 100) : 0,
  }
}
