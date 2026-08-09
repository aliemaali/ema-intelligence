'use server'

export type DataCenterImport = {
  projectName: string; state: string; district: string; city: string; address: string; coordinates: string
  landAreaHa: number | null; landCost: string; landPricePerSqm: number | null
  currentUse: string; zoning: string; developmentPlan: string; dataCenterPermitted: string; buildingHeight: string; sealedArea: string; specialRequirements: string
  hvDistanceM: number | null; hvStation: string; availablePowerMw: number | null; gridOperator: string
  fiberDistanceM: number | null; fiberProvider: string; fiberOnSite: string
  contactName: string; contactCompany: string; contactPhone: string; contactEmail: string; formDate: string
}

const stringFields = ['projectName','state','district','city','address','coordinates','landCost','currentUse','zoning','developmentPlan','dataCenterPermitted','buildingHeight','sealedArea','specialRequirements','hvStation','gridOperator','fiberProvider','fiberOnSite','contactName','contactCompany','contactPhone','contactEmail','formDate'] as const
const numberFields = ['landAreaHa','landPricePerSqm','hvDistanceM','availablePowerMw','fiberDistanceM'] as const
const required = [...stringFields, ...numberFields]

function responseText(payload: unknown) {
  if (!payload || typeof payload !== 'object') return ''
  const root = payload as { output_text?: unknown; output?: unknown }
  if (typeof root.output_text === 'string') return root.output_text
  if (!Array.isArray(root.output)) return ''
  for (const item of root.output) {
    if (!item || typeof item !== 'object') continue
    const content = (item as { content?: unknown }).content
    if (!Array.isArray(content)) continue
    for (const part of content) {
      if (!part || typeof part !== 'object') continue
      const value = part as { type?: unknown; text?: unknown }
      if (value.type === 'output_text' && typeof value.text === 'string') return value.text
    }
  }
  return ''
}

export async function extractDataCenterFromPdf(buffer: Buffer, filename: string) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return { error: 'Die KI-Analyse ist nicht konfiguriert.' }
  const properties: Record<string, unknown> = {}
  for (const key of stringFields) properties[key] = { type: 'string' }
  for (const key of numberFields) properties[key] = { type: ['number', 'null'] }
  const prompt = `Analysiere dieses Dokument als Rechenzentrum-Standort. Übernimm ausschließlich Angaben, die im Dokument tatsächlich vorhanden sind; nichts schätzen, ableiten oder erfinden. Extrahiere: Projektname; Standort mit Bundesland, Landkreis, Stadt/Gemeinde/Ort, Straße/Flurstück und GPS; Grundstück mit Größe in ha, Kosten oder Pachtangabe und EUR/m²; Baurecht und Flächennutzung mit aktueller Nutzung, Nutzungsart, Bebauungsplan, Zulässigkeit Rechenzentrum, Gebäudehöhe, versiegelbarer Fläche und besonderen Anforderungen; Stromversorgung mit Entfernung zur HV-/UW-Station in Metern, Name/Standort, verfügbarer Anschlussleistung in MW und Netzbetreiber; Glasfaser mit Entfernung in Metern, Anbieter/Netzbetreiber und vorhanden/geplant auf dem Grundstück; Ansprechpartner mit Name/Unternehmen, Telefon, E-Mail und Datum. Freitext wie 'Pacht nach Leistung' unverändert erhalten. Fehlende Textwerte als leere Zeichenkette und fehlende Zahlen als null zurückgeben.`
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, cache: 'no-store',
      body: JSON.stringify({ model: process.env.OPENAI_PROJECT_IMPORT_MODEL || 'gpt-5-mini', input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }, { type: 'input_file', filename: filename || 'rechenzentrum.pdf', file_data: buffer.toString('base64') }] }], text: { format: { type: 'json_schema', name: 'data_center_import', strict: true, schema: { type: 'object', additionalProperties: false, required, properties } } } }),
    })
    if (!response.ok) return { error: 'Die Rechenzentrum-Analyse ist fehlgeschlagen.' }
    const text = responseText(await response.json()).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    return { data: JSON.parse(text) as DataCenterImport }
  } catch (error) {
    console.error('Data-center PDF extraction failed', error)
    return { error: 'Die Rechenzentrum-Analyse konnte nicht abgeschlossen werden.' }
  }
}
