'use server'

type VisualProject = {
  externalNumber: string
  region: string
  permissionDate: string
  mwp: number | null
  gridDistanceKm: number | null
  structure: string
  studiesStart: string
  commissioning: string
  securedLandHa: number | null
  specificYield: number | null
}

type VisualExtractionResult = {
  projects: VisualProject[]
  error?: string
}

function responseText(payload: any) {
  if (typeof payload?.output_text === 'string') return payload.output_text
  for (const item of payload?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (content?.type === 'output_text' && typeof content?.text === 'string') return content.text
    }
  }
  return ''
}

function safeJson(text: string) {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  return JSON.parse(trimmed)
}

export async function extractProjectListFromPdf(buffer: Buffer, filename: string): Promise<VisualExtractionResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return { projects: [], error: 'Die visuelle PDF-Analyse ist noch nicht konfiguriert.' }

  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['projects'],
    properties: {
      projects: {
        type: 'array',
        maxItems: 500,
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'externalNumber', 'region', 'permissionDate', 'mwp', 'gridDistanceKm',
            'structure', 'studiesStart', 'commissioning', 'securedLandHa', 'specificYield',
          ],
          properties: {
            externalNumber: { type: 'string' },
            region: { type: 'string' },
            permissionDate: { type: 'string' },
            mwp: { type: ['number', 'null'] },
            gridDistanceKm: { type: ['number', 'null'] },
            structure: { type: 'string' },
            studiesStart: { type: 'string' },
            commissioning: { type: 'string' },
            securedLandHa: { type: ['number', 'null'] },
            specificYield: { type: ['number', 'null'] },
          },
        },
      },
    },
  }

  const prompt = [
    'Lies jede sichtbare Tabellenzeile dieser PDF als separates Solarprojekt aus.',
    'Übernimm ausschließlich Werte, die in der Datei sichtbar sind. Nicht raten.',
    'Spalten: externe Nummer, Region/Departement, Genehmigungsdatum, Leistung in MWp,',
    'Netzanschlussentfernung in km, Struktur, Studienbeginn, geplante Inbetriebnahme,',
    'gesicherte Fläche in ha und PVSYST-Ertrag bzw. Produktionsstunden.',
    'Datumswerte als sichtbaren Originalwert zurückgeben. Fehlende Werte leer bzw. null lassen.',
    'Tabellenüberschriften, Jahressummen und Summenzeilen nicht als Projekte übernehmen.',
  ].join(' ')

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_PROJECT_IMPORT_MODEL || 'gpt-5-mini',
        input: [{
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            {
              type: 'input_file',
              filename: filename || 'projektliste.pdf',
              file_data: buffer.toString('base64'),
            },
          ],
        }],
        text: {
          format: {
            type: 'json_schema',
            name: 'project_list',
            strict: true,
            schema,
          },
        },
      }),
      cache: 'no-store',
    })

    if (!response.ok) {
      const detail = await response.text()
      console.error('Visual project-list extraction failed', response.status, detail.slice(0, 500))
      return { projects: [], error: 'Die visuelle Tabellenanalyse ist fehlgeschlagen.' }
    }

    const payload = await response.json()
    const parsed = safeJson(responseText(payload))
    const projects = Array.isArray(parsed?.projects) ? parsed.projects.slice(0, 500) : []
    return { projects }
  } catch (error) {
    console.error('Visual project-list extraction error', error)
    return { projects: [], error: 'Die visuelle Tabellenanalyse konnte nicht abgeschlossen werden.' }
  }
}
