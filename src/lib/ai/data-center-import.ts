'use server'

export type DataCenterImport = {
  projectName: string
  state: string
  district: string
  city: string
  address: string
  coordinates: string
  landAreaHa: number | null
  landCost: string
  landPricePerSqm: number | null
  currentUse: string
  zoning: string
  developmentPlan: string
  dataCenterPermitted: string
  buildingHeight: string
  sealedArea: string
  specialRequirements: string
  hvDistanceM: number | null
  hvStation: string
  availablePowerMw: number | null
  gridOperator: string
  fiberDistanceM: number | null
  fiberProvider: string
  fiberOnSite: string
  contactName: string
  contactCompany: string
  contactPhone: string
  contactEmail: string
  formDate: string
}

const fields = Object.keys({
  projectName: '', state: '', district: '', city: '', address: '', coordinates: '', landAreaHa: '', landCost: '', landPricePerSqm: '', currentUse: '', zoning: '', developmentPlan: '', dataCenterPermitted: '', buildingHeight: '', sealedArea: '', specialRequirements: '', hvDistanceM: '', hvStation: '', availablePowerMw: '', gridOperator: '', fiberDistanceM: '', fiberProvider: '', fiberOnSite: '', contactName: '', contactCompany: '', contactPhone: '', contactEmail: '', formDate: '',
})

function responseText(payload: any) {
  if (typeof payload?.output_text === 'string') return payload.output_text
  for (const item of payload?.output ?? []) for (const content of item?.content ?? []) if (content?.type === 'output_text') return content.text || ''
  return ''
}

export async function extractDataCenterFromPdf(buffer: Buffer, filename: string) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return { error: 'Die KI-Analyse ist nicht konfiguriert.' }
  const properties = Object.fromEntries(fields.map((key) => [key, { type: ['string', 'number', 'null'] }]))
  const prompt = `Analysiere dieses Dokument als Rechenzentrum-Standort. Übernimm ausschließlich Angaben, die im Dokument tatsächlich vorhanden sind; nichts schätzen oder erfinden. Extrahiere Standort (Bundesland, Landkreis, Ort, Adresse/Flurstück, GPS), Grundstück (ha, Kosten/Pacht, EUR/m²), Baurecht und Flächennutzung, Stromversorgung (Entfernung HV/UW, Station, verfügbare MW, Netzbetreiber), Glasfaser (Entfernung, Anbieter, Anschluss auf Grundstück) sowie Ansprechpartner und Datum. Freitext wie 'Pacht nach Leistung' muss als Freitext erhalten bleiben. Fehlende Angaben als leere Zeichenkette bzw. null zurückgeben.`
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, cache: 'no-store',
      body: JSON.stringify({
        model: process.env.OPENAI_PROJECT_IMPORT_MODEL || 'gpt-5-mini',
        input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }, { type: 'input_file', filename: filename || 'rechenzentrum.pdf', file_data: buffer.toString('base64') }] }],
        text: { format: { type: 'json_schema', name: 'data_center_import', strict: true, schema: { type: 'object', additionalProperties: false, required: fields, properties } } },
      }),
    })
    if (!response.ok) return { error: 'Die Rechenzentrum-Analyse ist fehlgeschlagen.' }
    const text = responseText(await response.json()).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    return { data: JSON.parse(text) as DataCenterImport }
  } catch (error) {
    console.error('Data-center PDF extraction failed', error)
    return { error: 'Die Rechenzentrum-Analyse konnte nicht abgeschlossen werden.' }
  }
}
