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
  zoningDesignation: 'agricultural' | 'industrial' | 'commercial' | 'mixed' | 'special' | 'unknown'
  otherDesignation: string
  zoningPlanStatus: 'yes' | 'no' | 'in_preparation' | 'unknown'
  dataCenterPermitted: 'yes' | 'no' | 'verify' | 'unknown'
  planningNotes: string
  hvDistanceM: number | null
  hvStation: string
  availablePowerMw: number | null
  gridOperator: string
  fiberDistanceM: number | null
  fiberProvider: string
  fiberStatus: 'yes' | 'no' | 'planned' | 'unknown'
  contactName: string
  contactCompany: string
  contactPhone: string
  contactEmail: string
  assessmentDate: string
  additionalNotes: string
}

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

  const schema = {
    type: 'object',
    additionalProperties: false,
    required: [
      'projectName', 'state', 'district', 'city', 'address', 'coordinates',
      'landAreaHa', 'landCost', 'landPricePerSqm', 'zoningDesignation',
      'otherDesignation', 'zoningPlanStatus', 'dataCenterPermitted', 'planningNotes',
      'hvDistanceM', 'hvStation', 'availablePowerMw', 'gridOperator',
      'fiberDistanceM', 'fiberProvider', 'fiberStatus', 'contactName',
      'contactCompany', 'contactPhone', 'contactEmail', 'assessmentDate',
      'additionalNotes',
    ],
    properties: {
      projectName: { type: 'string' },
      state: { type: 'string' },
      district: { type: 'string' },
      city: { type: 'string' },
      address: { type: 'string' },
      coordinates: { type: 'string' },
      landAreaHa: { type: ['number', 'null'] },
      landCost: { type: 'string' },
      landPricePerSqm: { type: ['number', 'null'] },
      zoningDesignation: { type: 'string', enum: ['agricultural', 'industrial', 'commercial', 'mixed', 'special', 'unknown'] },
      otherDesignation: { type: 'string' },
      zoningPlanStatus: { type: 'string', enum: ['yes', 'no', 'in_preparation', 'unknown'] },
      dataCenterPermitted: { type: 'string', enum: ['yes', 'no', 'verify', 'unknown'] },
      planningNotes: { type: 'string' },
      hvDistanceM: { type: ['number', 'null'] },
      hvStation: { type: 'string' },
      availablePowerMw: { type: ['number', 'null'] },
      gridOperator: { type: 'string' },
      fiberDistanceM: { type: ['number', 'null'] },
      fiberProvider: { type: 'string' },
      fiberStatus: { type: 'string', enum: ['yes', 'no', 'planned', 'unknown'] },
      contactName: { type: 'string' },
      contactCompany: { type: 'string' },
      contactPhone: { type: 'string' },
      contactEmail: { type: 'string' },
      assessmentDate: { type: 'string' },
      additionalNotes: { type: 'string' },
    },
  }

  const prompt = [
    'Analysiere das Dokument als Rechenzentrum-Standort.',
    'Übernimm ausschließlich ausdrücklich vorhandene Angaben. Nichts schätzen, ableiten oder erfinden.',
    'Ein Projektname darf nur übernommen werden, wenn er im Dokument ausdrücklich genannt ist.',
    'Entfernungen einheitlich in Meter und Anschlussleistung in MW ausgeben.',
    'Datumswerte nach Möglichkeit als YYYY-MM-DD ausgeben.',
    'Freitext wie „Pacht nach Leistung“ unverändert erhalten.',
    'Fehlende Textwerte als leere Zeichenkette und fehlende Zahlen als null zurückgeben.',
  ].join(' ')

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      body: JSON.stringify({
        model: process.env.OPENAI_PROJECT_IMPORT_MODEL || 'gpt-5-mini',
        input: [{
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            {
              type: 'input_file',
              filename: filename || 'rechenzentrum.pdf',
              file_data: `data:application/pdf;base64,${buffer.toString('base64')}`,
            },
          ],
        }],
        text: {
          format: {
            type: 'json_schema',
            name: 'data_center_import',
            strict: true,
            schema,
          },
        },
      }),
    })

    if (!response.ok) {
      console.error('Data-center PDF extraction failed:', response.status, await response.text())
      return { error: 'Die Rechenzentrum-Analyse ist fehlgeschlagen.' }
    }

    const text = responseText(await response.json())
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')

    if (!text) return { error: 'Die Rechenzentrum-Analyse lieferte keine auswertbaren Daten.' }
    return { data: JSON.parse(text) as DataCenterImport }
  } catch (error) {
    console.error('Data-center PDF extraction failed', error)
    return { error: 'Die Rechenzentrum-Analyse konnte nicht abgeschlossen werden.' }
  }
}
