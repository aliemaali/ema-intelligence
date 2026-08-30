import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEmaVoiceUserName } from '@/lib/ema/voiceAccess'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses'
const OPENAI_DOCUMENT_MODEL = 'gpt-5.6-luna'
const MAX_PDF_BYTES = 10 * 1024 * 1024

type DocumentRow = {
  id: string
  project_id: string | null
  user_id: string
  display_name: string
  file_name: string
  file_path: string
  external_provider: string | null
  storage_bucket: string | null
  file_size_bytes: number | null
  mime_type: string | null
  ai_analyzed: boolean | null
  ai_extracted_data: unknown
  is_archived: boolean | null
}

function safetyIdentifier(userId: string) {
  return createHash('sha256').update(userId).digest('hex')
}

function hasIndexedContent(document: Pick<DocumentRow, 'ai_analyzed' | 'ai_extracted_data'>) {
  return document.ai_analyzed === true
    && document.ai_extracted_data !== null
    && document.ai_extracted_data !== undefined
}

function getOutputText(payload: any): string {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim()
  }

  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (content?.type === 'output_text' && typeof content.text === 'string' && content.text.trim()) {
        return content.text.trim()
      }
    }
  }

  return ''
}

const extractionSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    key_facts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          value: { type: 'string' },
          page: { type: ['integer', 'null'] },
        },
        required: ['label', 'value', 'page'],
        additionalProperties: false,
      },
    },
    dates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          value: { type: 'string' },
          page: { type: ['integer', 'null'] },
        },
        required: ['label', 'value', 'page'],
        additionalProperties: false,
      },
    },
    parties: {
      type: 'array',
      items: { type: 'string' },
    },
    technical_data: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          value: { type: 'string' },
          page: { type: ['integer', 'null'] },
        },
        required: ['label', 'value', 'page'],
        additionalProperties: false,
      },
    },
    commercial_data: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          value: { type: 'string' },
          page: { type: ['integer', 'null'] },
        },
        required: ['label', 'value', 'page'],
        additionalProperties: false,
      },
    },
    risks: {
      type: 'array',
      items: { type: 'string' },
    },
    open_questions: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: [
    'summary',
    'key_facts',
    'dates',
    'parties',
    'technical_data',
    'commercial_data',
    'risks',
    'open_questions',
  ],
  additionalProperties: false,
} as const

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  }

  if (!getEmaVoiceUserName(user.email)) {
    return NextResponse.json({ error: 'EMA AI ist für dieses Benutzerkonto nicht freigeschaltet.' }, { status: 403 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'EMA AI ist noch nicht mit OpenAI verbunden.' }, { status: 503 })
  }

  let body: { document_id?: unknown; force?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  const documentId = typeof body.document_id === 'string' ? body.document_id.trim() : ''
  const force = body.force === true
  if (!documentId || documentId.length > 100) {
    return NextResponse.json({ error: 'Dokument-ID fehlt.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('documents')
    .select('id, project_id, user_id, display_name, file_name, file_path, external_provider, storage_bucket, file_size_bytes, mime_type, ai_analyzed, ai_extracted_data, is_archived')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .eq('is_archived', false)
    .maybeSingle()

  if (error) {
    console.error('EMA document lookup failed:', error.message)
    return NextResponse.json({ error: 'Dokument konnte nicht geladen werden.' }, { status: 500 })
  }

  const document = data as DocumentRow | null
  if (!document) {
    return NextResponse.json({ error: 'Dokument nicht gefunden.' }, { status: 404 })
  }

  if (!force && hasIndexedContent(document)) {
    return NextResponse.json({ indexed: true, cached: true, document_id: document.id })
  }

  const isPdf = document.mime_type === 'application/pdf' || document.file_name.toLocaleLowerCase('de-DE').endsWith('.pdf')
  if (!isPdf) {
    return NextResponse.json({ error: 'Für EMA werden aktuell nur PDF-Dokumente eingelesen.' }, { status: 415 })
  }

  if (document.file_size_bytes && document.file_size_bytes > MAX_PDF_BYTES) {
    return NextResponse.json({ error: 'Dieses PDF ist für die EMA-Indexierung zu groß.' }, { status: 413 })
  }

  const documentBucket = document.storage_bucket
    || (document.external_provider === 'project-imports' ? 'project-imports' : 'project-documents')
  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from(documentBucket)
    .download(document.file_path)

  if (downloadError || !fileBlob) {
    console.error('EMA document download failed:', downloadError?.message)
    return NextResponse.json({ error: 'PDF konnte nicht sicher geladen werden.' }, { status: 502 })
  }

  if (fileBlob.size > MAX_PDF_BYTES) {
    return NextResponse.json({ error: 'Dieses PDF ist für die EMA-Indexierung zu groß.' }, { status: 413 })
  }

  const fileBase64 = Buffer.from(await fileBlob.arrayBuffer()).toString('base64')

  let openAiResponse: Response
  try {
    openAiResponse = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Safety-Identifier': safetyIdentifier(user.id),
      },
      body: JSON.stringify({
        model: OPENAI_DOCUMENT_MODEL,
        reasoning: { effort: 'none' },
        store: false,
        max_output_tokens: 2400,
        instructions: [
          'Analysiere dieses EMA-Projektdokument ausschließlich anhand des PDF-Inhalts.',
          'Extrahiere nur belastbare Fakten. Nichts ergänzen, schätzen oder aus Dateinamen ableiten.',
          'Antworte auf Deutsch und halte Zusammenfassung sowie Einzelwerte knapp.',
          'Gib bei eindeutig erkennbaren Fundstellen die PDF-Seite an, sonst null.',
          'Leere Kategorien als leere Arrays zurückgeben.',
        ].join(' '),
        input: [{
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: `Dokument: ${document.display_name}. Erstelle den strukturierten EMA-Wissenseintrag.`,
            },
            {
              type: 'input_file',
              filename: document.file_name,
              file_data: `data:application/pdf;base64,${fileBase64}`,
              detail: 'low',
            },
          ],
        }],
        text: {
          format: {
            type: 'json_schema',
            name: 'ema_project_document',
            strict: true,
            schema: extractionSchema,
          },
        },
      }),
      cache: 'no-store',
    })
  } catch (error) {
    console.error('EMA document analysis connection failed:', error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json({ error: 'EMA konnte OpenAI momentan nicht erreichen.' }, { status: 502 })
  }

  const responseText = await openAiResponse.text()
  if (!openAiResponse.ok) {
    console.error('EMA document analysis failed:', openAiResponse.status, responseText.slice(0, 500))
    return NextResponse.json({ error: 'EMA konnte das PDF nicht analysieren.' }, { status: 502 })
  }

  let responsePayload: any
  try {
    responsePayload = JSON.parse(responseText)
  } catch {
    return NextResponse.json({ error: 'EMA erhielt keine gültige Analyse.' }, { status: 502 })
  }

  const outputText = getOutputText(responsePayload)
  if (!outputText) {
    return NextResponse.json({ error: 'EMA erhielt keine auswertbaren PDF-Inhalte.' }, { status: 502 })
  }

  let extractedData: unknown
  try {
    extractedData = JSON.parse(outputText)
  } catch {
    return NextResponse.json({ error: 'EMA erhielt keine strukturierte PDF-Analyse.' }, { status: 502 })
  }

  const analyzedAt = new Date().toISOString()
  const { error: updateError } = await supabase
    .from('documents')
    .update({
      ai_analyzed: true,
      ai_extracted_data: extractedData,
      ai_analyzed_at: analyzedAt,
      analysis_status: 'completed',
      analysis_error: null,
    } as never)
    .eq('id', document.id)
    .eq('user_id', user.id)

  if (updateError) {
    console.error('EMA document index update failed:', updateError.message)
    return NextResponse.json({ error: 'Analyse konnte nicht gespeichert werden.' }, { status: 500 })
  }

  return NextResponse.json({
    indexed: true,
    cached: false,
    document_id: document.id,
    analyzed_at: analyzedAt,
  })
}
