export type DdStatus = 'verified' | 'open' | 'critical'

export type BessDdItem = {
  id: string
  category: string
  label: string
  status: DdStatus
  evidence?: string
  source?: string
  hardGate?: boolean
  weight: number
}

export type BessDdResult = {
  readinessScore: number
  rtbScore: number
  hardGatesPassed: boolean
  criticalItems: BessDdItem[]
  openItems: BessDdItem[]
  verifiedItems: BessDdItem[]
  recommendation: 'GO' | 'CONDITIONAL' | 'NO-GO'
}

export const BESS_DD_CHECKLIST: Omit<BessDdItem, 'status'>[] = [
  { id: 'land-rights', category: 'Grundstück & Rechte', label: 'Grundstücksrechte / Nutzungsvertrag belastbar', hardGate: true, weight: 14 },
  { id: 'grid-connection', category: 'Netzanschluss', label: 'Netzanschlusszusage / belastbarer Netzstatus', hardGate: true, weight: 18 },
  { id: 'grid-capacity', category: 'Netzanschluss', label: 'Leistung und Kapazität am Netzverknüpfungspunkt bestätigt', hardGate: true, weight: 10 },
  { id: 'permit-path', category: 'Genehmigung', label: 'Genehmigungspfad und Zuständigkeiten geklärt', hardGate: true, weight: 10 },
  { id: 'planning-law', category: 'Genehmigung', label: 'Planungsrechtliche Zulässigkeit belastbar', hardGate: true, weight: 10 },
  { id: 'fire-safety', category: 'Technik & Sicherheit', label: 'Brandschutz- und Sicherheitskonzept vorhanden', weight: 7 },
  { id: 'battery-concept', category: 'Technik & Sicherheit', label: 'Batterie-, PCS- und Transformatorenkonzept plausibel', weight: 7 },
  { id: 'layout', category: 'Technik & Sicherheit', label: 'Layout, Zufahrt und Abstände plausibel', weight: 5 },
  { id: 'capex', category: 'Wirtschaftlichkeit', label: 'CAPEX nachvollziehbar und vollständig', weight: 5 },
  { id: 'opex', category: 'Wirtschaftlichkeit', label: 'OPEX und laufende Kosten plausibel', weight: 3 },
  { id: 'revenue', category: 'Wirtschaftlichkeit', label: 'Erlösannahmen / Vermarktungsstrategie dokumentiert', weight: 4 },
  { id: 'spv', category: 'Legal & Transaktion', label: 'SPV, Eigentums- und Vertragsstruktur transparent', weight: 4 },
  { id: 'timeline', category: 'RTB & Umsetzung', label: 'Meilensteine bis RTB mit Verantwortlichkeiten dokumentiert', weight: 3 },
]

export function evaluateBessDueDiligence(items: BessDdItem[]): BessDdResult {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0) || 1
  const verifiedWeight = items.filter(i => i.status === 'verified').reduce((sum, item) => sum + item.weight, 0)
  const criticalWeight = items.filter(i => i.status === 'critical').reduce((sum, item) => sum + item.weight, 0)
  const hardGates = items.filter(i => i.hardGate)
  const hardGatesPassed = hardGates.every(i => i.status === 'verified')
  const readinessScore = Math.round((verifiedWeight / totalWeight) * 100)
  const rtbBase = Math.max(0, readinessScore - Math.round((criticalWeight / totalWeight) * 35))
  const rtbScore = hardGatesPassed ? rtbBase : Math.min(rtbBase, 69)

  const recommendation: BessDdResult['recommendation'] =
    items.some(i => i.hardGate && i.status === 'critical') || rtbScore < 45
      ? 'NO-GO'
      : hardGatesPassed && rtbScore >= 80
        ? 'GO'
        : 'CONDITIONAL'

  return {
    readinessScore,
    rtbScore,
    hardGatesPassed,
    criticalItems: items.filter(i => i.status === 'critical'),
    openItems: items.filter(i => i.status === 'open'),
    verifiedItems: items.filter(i => i.status === 'verified'),
    recommendation,
  }
}
