import { z } from 'zod'

const row = z.object({ label: z.string().trim().min(1).max(100), value: z.string().trim().min(1).max(160) })
export const importedExposeSchema = z.object({
  fileName: z.string().max(255),
  title: z.string().max(160).optional(),
  location: z.string().max(200).optional(),
  metrics: z.array(row).max(12),
  profile: z.array(row).max(16),
  text: z.string().max(12000),
})
export type ImportedExpose = z.infer<typeof importedExposeSchema>

// Preserve the source wording, especially reservations, estimates and pending approvals.
// Never interpret the first currency amount as a total purchase price.
export function extractExposeText(raw: string, fileName: string): ImportedExpose {
  const text = raw.replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim()
  if (text.length < 20) throw new Error('Kein ausreichender Text erkannt. Bitte ein schärferes Bild oder eine PDF mit auswählbarem Text verwenden.')
  if (text.length > 12000) throw new Error('Zu viel Text. Bitte die relevanten Projektseiten einzeln hochladen.')
  const project = text.match(/\b(BESS|PV|Data Center|Rechenzentrum)\s+([^\n:]{2,100}?)(?=\s+in\s|\s+aufmerksam|\n|$)/i)
  const named = text.match(/(?:Projektname|Projekttitel)\s*:\s*([^\n]+)/i)
  const location = text.match(/(?:Standort|Projektort)\s*:\s*([^\n]+)/i)?.[1]
    ?? (project ? [project[2], text.match(/\bin\s+(Brandenburg|Bayern|Hessen|Sachsen(?:-Anhalt)?|Thüringen|Niedersachsen|Nordrhein-Westfalen|Schleswig-Holstein|Mecklenburg-Vorpommern|Baden-Württemberg|Rheinland-Pfalz|Saarland|Berlin|Hamburg|Bremen)\b/i)?.[1]].filter(Boolean).join(', ') : undefined)
  const metrics: ImportedExpose['metrics'] = []
  const power = text.match(/\b(\d+(?:[.,]\d+)?)\s*MW\b/i)
  const capacity = text.match(/\b(\d+(?:[.,]\d+)?)\s*MWh\b/i)
  const pv = text.match(/\b(\d+(?:[.,]\d+)?)\s*(kWp|MWp)\b/i)
  if (power) metrics.push({ label: 'Leistung', value: `${power[1]} MW` })
  if (capacity) metrics.push({ label: 'Kapazität', value: `${capacity[1]} MWh` })
  if (pv) metrics.push({ label: 'PV-Leistung', value: `${pv[1]} ${pv[2]}` })
  // Join wrapped lines, while retaining headings as boundaries.
  const lines = text.split('\n').map(s => s.trim()).filter(Boolean)
  const facts: string[] = []
  for (const line of lines) {
    const clean = line.replace(/^[-•–]\s*/, '')
    if (/^[-•–]\s*/.test(line) || /^[^:]{2,65}:/.test(line)) facts.push(clean)
    else if (facts.length && !/^(Eckdaten|Projektstand|Pachtvertrag|Konditionen)$/i.test(clean)) facts[facts.length - 1] += ` ${clean}`
  }
  const profile = facts.map(fact => {
    const colon = fact.indexOf(':')
    return colon > 0 ? { label: fact.slice(0, colon), value: fact.slice(colon + 1).trim() } : { label: 'Projektangabe', value: fact }
  }).filter(fact => fact.label && fact.value)
  if (profile.length > 16 || profile.some(fact => fact.label.length > 100 || fact.value.length > 160)) {
    throw new Error('Einige Angaben sind zu lang für die Exposé-Felder. Bitte einen kürzeren Projektauszug hochladen.')
  }
  if (!metrics.length && !profile.length) throw new Error('Text erkannt, aber keine eindeutigen Projektfelder gefunden. Bitte einen strukturierten Projektauszug verwenden.')
  return importedExposeSchema.parse({ fileName, title: named?.[1]?.trim() ?? (project ? `${project[1]} ${project[2]}`.trim() : undefined), location, metrics, profile, text })
}
