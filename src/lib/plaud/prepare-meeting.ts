import { createHash } from 'crypto'
import type { PlaudPreparedMeeting, PlaudSuggestion } from './types'

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses'
const TRANSLATION_CHUNK_SIZE = 6_000
const TRANSLATION_PROGRESS_PREFIX = '__EMA_PLAUD_TRANSLATION_V1__:'

type TranslationProgressPayload = {
  total: number
  translations: Array<string | null>
}

export type PlaudTranslationStatus = {
  done: boolean
  completed: number
  total: number
}

function outputText(payload: any) {
  if (typeof payload?.output_text === 'string') return payload.output_text.trim()
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    for (const part of Array.isArray(item?.content) ? item.content : []) {
      if (part?.type === 'output_text' && typeof part.text === 'string') return part.text.trim()
    }
  }
  return ''
}

function safetyIdentifier(userId: string) {
  return createHash('sha256').update(userId).digest('hex')
}

async function openAi(userId: string, body: Record<string, unknown>) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('Die deutsche PLAUD-Aufbereitung ist noch nicht konfiguriert.')
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'OpenAI-Safety-Identifier': safetyIdentifier(userId),
    },
    body: JSON.stringify({ model: process.env.OPENAI_PLAUD_MODEL || 'gpt-5-mini', store: false, ...body }),
    cache: 'no-store',
  })
  const raw = await response.text()
  if (!response.ok) {
    console.error('PLAUD OpenAI processing failed:', response.status, raw.slice(0, 500))
    throw new Error('Das PLAUD-Meeting konnte momentan nicht auf Deutsch aufbereitet werden.')
  }
  let payload: any
  try { payload = JSON.parse(raw) } catch { throw new Error('Die deutsche PLAUD-Aufbereitung lieferte keine gültige Antwort.') }
  return outputText(payload)
}

export async function analyzePlaudMeeting(userId: string, title: string, transcript: string, notes: string) {
  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['source_language', 'title_de', 'summary_de', 'suggestions'],
    properties: {
      source_language: { type: 'string' },
      title_de: { type: 'string' },
      summary_de: { type: 'string' },
      suggestions: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['type', 'title', 'detail', 'due_at'],
          properties: {
            type: { type: 'string', enum: ['task', 'appointment'] },
            title: { type: 'string' },
            detail: { type: 'string' },
            due_at: { type: ['string', 'null'] },
          },
        },
      },
    },
  }
  const input = [
    `Titel: ${title}`,
    `PLAUD-Notizen:\n${notes.slice(0, 24_000) || 'Keine'}`,
    `Transkript-Auszug:\n${transcript.slice(0, 16_000)}`,
  ].join('\n\n')
  const result = await openAi(userId, {
    instructions: [
      'Erkenne die Hauptsprache des Meetings und gib sie als kurzen BCP-47-Code aus.',
      'Erstelle einen natürlichen deutschen Titel und eine vollständige, sachliche deutsche Zusammenfassung.',
      'Extrahiere nur ausdrücklich genannte Aufgaben und Termine. Nichts erfinden.',
      'due_at nur als ISO-8601-Wert setzen, wenn Datum und Uhrzeit eindeutig sind; sonst null.',
      'Alle Vorschläge auf Deutsch formulieren.',
    ].join(' '),
    input,
    max_output_tokens: 5000,
    text: { format: { type: 'json_schema', name: 'plaud_meeting_import', strict: true, schema } },
  })
  return JSON.parse(result) as { source_language: string; title_de: string; summary_de: string; suggestions: PlaudSuggestion[] }
}

export function splitPlaudTranscript(value: string) {
  const result: string[] = []
  let rest = value.trim()
  while (rest.length > TRANSLATION_CHUNK_SIZE) {
    let cut = rest.lastIndexOf('\n', TRANSLATION_CHUNK_SIZE)
    if (cut < TRANSLATION_CHUNK_SIZE * 0.6) cut = TRANSLATION_CHUNK_SIZE
    result.push(rest.slice(0, cut))
    rest = rest.slice(cut).trimStart()
  }
  if (rest) result.push(rest)
  return result
}

export function isGermanPlaudLanguage(sourceLanguage: string | null | undefined) {
  return /^(de|de-|german|deutsch)/i.test(String(sourceLanguage || '').trim())
}

function parseProgress(value: string | null | undefined): TranslationProgressPayload | null {
  if (!value?.startsWith(TRANSLATION_PROGRESS_PREFIX)) return null
  try {
    const parsed = JSON.parse(value.slice(TRANSLATION_PROGRESS_PREFIX.length)) as TranslationProgressPayload
    if (!Number.isInteger(parsed.total) || parsed.total < 0 || !Array.isArray(parsed.translations)) return null
    return {
      total: parsed.total,
      translations: Array.from({ length: parsed.total }, (_, index) => {
        const translated = parsed.translations[index]
        return typeof translated === 'string' && translated.trim() ? translated : null
      }),
    }
  } catch {
    return null
  }
}

function serializeProgress(progress: TranslationProgressPayload) {
  return `${TRANSLATION_PROGRESS_PREFIX}${JSON.stringify(progress)}`
}

export function createPlaudTranslationProgress(transcript: string) {
  const total = splitPlaudTranscript(transcript).length
  return serializeProgress({ total, translations: Array.from({ length: total }, () => null) })
}

export function getPlaudTranslationStatus(value: string | null | undefined): PlaudTranslationStatus {
  const progress = parseProgress(value)
  if (progress) {
    return {
      done: progress.total === 0 || progress.translations.every(Boolean),
      completed: progress.translations.filter(Boolean).length,
      total: progress.total,
    }
  }
  if (value?.startsWith(TRANSLATION_PROGRESS_PREFIX)) return { done: false, completed: 0, total: 0 }
  return value
    ? { done: true, completed: 1, total: 1 }
    : { done: true, completed: 0, total: 0 }
}

export function hidePlaudTranslationProgress(value: string | null | undefined) {
  return value?.startsWith(TRANSLATION_PROGRESS_PREFIX) ? null : value || null
}

export async function translatePlaudChunk(userId: string, transcriptChunk: string) {
  const translated = await openAi(userId, {
    instructions: [
      'Übersetze den folgenden Abschnitt eines Meeting-Transkripts vollständig und präzise ins Deutsche.',
      'Erhalte Zeitstempel, Sprecherbezeichnungen, Absatzfolge, Namen, Zahlen und Fachbegriffe.',
      'Kürze nichts und füge keine Zusammenfassung oder Erklärung hinzu.',
    ].join(' '),
    input: transcriptChunk,
    max_output_tokens: 8000,
  })
  if (!translated) throw new Error('Die deutsche Übersetzung lieferte keinen Text und wird erneut versucht.')
  return translated
}

export async function advancePlaudTranslation(input: {
  userId: string
  transcript: string
  storedTranslation: string | null
}) {
  const parts = splitPlaudTranscript(input.transcript)
  const stored = parseProgress(input.storedTranslation)
  const progress: TranslationProgressPayload = stored?.total === parts.length
    ? stored
    : { total: parts.length, translations: Array.from({ length: parts.length }, () => null) }
  const nextIndex = progress.translations.findIndex((part) => !part)

  if (nextIndex >= 0) {
    progress.translations[nextIndex] = await translatePlaudChunk(input.userId, parts[nextIndex])
  }

  const completed = progress.translations.filter(Boolean).length
  const done = completed === progress.total
  return {
    value: done ? progress.translations.join('\n\n') : serializeProgress(progress),
    status: { done, completed, total: progress.total } satisfies PlaudTranslationStatus,
  }
}

async function translateTranscript(userId: string, transcript: string) {
  const parts = splitPlaudTranscript(transcript)
  const translated: string[] = []
  for (let index = 0; index < parts.length; index += 3) {
    const batch = parts.slice(index, index + 3)
    const values = await Promise.all(batch.map((part) => translatePlaudChunk(userId, part)))
    translated.push(...values)
  }
  return translated.join('\n\n')
}

export async function preparePlaudMeeting(input: { userId: string; title: string; transcript: string; notes: string }): Promise<PlaudPreparedMeeting> {
  const analyzed = await analyzePlaudMeeting(input.userId, input.title, input.transcript, input.notes)
  const sourceLanguage = analyzed.source_language.trim().toLowerCase() || 'und'
  const transcriptDe = isGermanPlaudLanguage(sourceLanguage)
    ? input.transcript
    : await translateTranscript(input.userId, input.transcript)
  return {
    sourceLanguage,
    titleDe: analyzed.title_de.trim() || input.title,
    summaryDe: analyzed.summary_de.trim() || input.notes,
    transcriptDe,
    suggestions: analyzed.suggestions.slice(0, 20),
  }
}
