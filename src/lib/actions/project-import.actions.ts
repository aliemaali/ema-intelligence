'use server'

import { createClient } from '@/lib/supabase/server'

const BUCKET_NAME = 'project-imports'

type ExtractedProjectImport = {
  partner_project_number?: string | null
  detected_partner_name?: string | null
  project_name?: string | null
  project_type?: string | null
  location_address?: string | null
  location_postal_code?: string | null
  location_city?: string | null
  location_state?: string | null
  location_country?: string | null
  location_lat?: number | null
  location_lng?: number | null
  pv_kwp?: number | null
  bess_mw?: number | null
  bess_mwh?: number | null
  feed_in_type?: string | null
  purchase_price?: number | null
  confidence_score?: number | null
  missing_fields?: string[]
  raw_extracted_text?: string | null
}

function sanitizeFileName(name: string) {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

function isImageType(type?: string | null) {
  return Boolean(type && type.startsWith('image/'))
}

function normalizeNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(String(value).replace(',', '.').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(number) ? number : null
}

async function analyzeImageWithOpenAI(file: File): Promise<ExtractedProjectImport> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY fehlt in Vercel/Supabase-Umgebung.')
  }

  const arrayBuffer = await file.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')
  const mimeType = file.type || 'image/jpeg'

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Du bist ein Datenextraktions-Assistent für deutsche PV-, BESS- und Hybrid-Projektexposés. Antworte ausschließlich als valides JSON. Nutze null, wenn ein Wert nicht sicher erkannt wird.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                'Lies das Bild/Screenshot/Exposé aus und extrahiere: partner_project_number, detected_partner_name, project_name, project_type, location_address, location_postal_code, location_city, location_state, location_country, location_lat, location_lng, pv_kwp, bess_mw, bess_mwh, feed_in_type, purchase_price, confidence_score, missing_fields, raw_extracted_text. EK-Preis ist purchase_price. Einspeiseart nur Voll, PPA, EEG, Teileinspeisung oder Sonstige.',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
              },
            },
          ],
        },
      ],
      temperature: 0.1,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`KI-Analyse fehlgeschlagen: ${errorText}`)
  }

  const json = await response.json()
  const content = json.choices?.[0]?.message?.content
  if (!content) throw new Error('KI hat kein Ergebnis zurückgegeben.')

  const parsed = JSON.parse(content) as ExtractedProjectImport

  return {
    ...parsed,
    pv_kwp: normalizeNumber(parsed.pv_kwp),
    bess_mw: normalizeNumber(parsed.bess_mw),
    bess_mwh: normalizeNumber(parsed.bess_mwh),
    purchase_price: normalizeNumber(parsed.purchase_price),
    confidence_score: normalizeNumber(parsed.confidence_score),
    missing_fields: Array.isArray(parsed.missing_fields) ? parsed.missing_fields : [],
  }
}

export async function uploadProjectImportFiles(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: 'Nicht angemeldet. Bitte neu einloggen.' }
  }

  const files = formData
    .getAll('files')
    .filter((value): value is File => value instanceof File && value.size > 0)

  if (files.length === 0) {
    return { error: 'Keine Datei ausgewählt.' }
  }

  const importId = crypto.randomUUID()
  const uploaded: Array<{
    name: string
    size: number
    type: string
    path: string
  }> = []

  for (const file of files) {
    const safeName = sanitizeFileName(file.name || 'import-datei')
    const path = `${user.id}/imports/${importId}/${Date.now()}-${safeName}`

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'application/octet-stream',
      })

    if (error) {
      return {
        error: `Upload fehlgeschlagen: ${error.message}`,
        uploaded,
      }
    }

    uploaded.push({
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      path,
    })
  }

  const { error: insertError } = await supabase.from('project_imports').insert({
    id: importId,
    user_id: user.id,
    import_status: 'uploaded',
    source_type: files.some((file) => file.type.startsWith('image/')) ? 'photo' : 'upload',
    file_count: uploaded.length,
    storage_bucket: BUCKET_NAME,
    storage_paths: uploaded.map((file) => file.path),
    original_file_names: uploaded.map((file) => file.name),
  } as never)

  if (insertError) {
    return {
      error: `Dateien wurden gespeichert, aber der Import konnte nicht registriert werden: ${insertError.message}`,
      uploaded,
    }
  }

  return {
    success: true,
    importId,
    bucket: BUCKET_NAME,
    uploaded,
  }
}

export async function prepareProjectImport(importId: string) {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: 'Nicht angemeldet. Bitte neu einloggen.' }
  }

  const { data: projectImport, error: importError } = await supabase
    .from('project_imports')
    .select('*')
    .eq('id', importId)
    .eq('user_id', user.id)
    .single()

  if (importError || !projectImport) {
    return { error: 'Import wurde nicht gefunden.' }
  }

  const { data: existing } = await supabase
    .from('project_import_results')
    .select('*')
    .eq('import_id', importId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    return { success: true, result: existing }
  }

  const payload = {
    import_id: importId,
    user_id: user.id,
    location_country: 'Deutschland',
    feed_in_type: null,
    confidence_score: null,
    missing_fields: ['project_name', 'location_city', 'pv_kwp', 'purchase_price'],
    raw_result: {
      mode: 'manual-free-phase-1',
      note: 'Kostenlose Phase 1: Daten werden manuell ergänzt. KI kann später aktiviert werden.',
    },
  }

  const { data: result, error: resultError } = await supabase
    .from('project_import_results')
    .insert(payload as never)
    .select('*')
    .single()

  if (resultError) {
    return { error: `Import wurde gespeichert, aber die Vorschau konnte nicht vorbereitet werden: ${resultError.message}` }
  }

  await supabase
    .from('project_imports')
    .update({ import_status: 'ready' } as never)
    .eq('id', importId)
    .eq('user_id', user.id)

  return {
    success: true,
    result,
  }
}

export async function analyzeProjectImport(importId: string) {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: 'Nicht angemeldet. Bitte neu einloggen.' }
  }

  const { data: projectImport, error: importError } = await supabase
    .from('project_imports')
    .select('*')
    .eq('id', importId)
    .eq('user_id', user.id)
    .single()

  if (importError || !projectImport) {
    return { error: 'Import wurde nicht gefunden.' }
  }

  const paths = (projectImport as any).storage_paths as string[]
  if (!paths?.length) return { error: 'Keine Datei für Analyse gefunden.' }

  await supabase
    .from('project_imports')
    .update({ import_status: 'analyzing' } as never)
    .eq('id', importId)
    .eq('user_id', user.id)

  const firstPath = paths[0]
  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from(BUCKET_NAME)
    .download(firstPath)

  if (downloadError || !fileBlob) {
    return { error: `Datei konnte nicht gelesen werden: ${downloadError?.message ?? 'Unbekannter Fehler'}` }
  }

  const fileType = fileBlob.type || ''
  let extracted: ExtractedProjectImport

  try {
    if (!isImageType(fileType)) {
      throw new Error('Aktuell ist die KI-Auswertung für Fotos/Screenshots aktiv. PDF/Word/Excel folgt als nächster Schritt.')
    }

    extracted = await analyzeImageWithOpenAI(fileBlob as File)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'KI-Analyse fehlgeschlagen.'
    await supabase
      .from('project_imports')
      .update({ import_status: 'failed', error_message: message } as never)
      .eq('id', importId)
      .eq('user_id', user.id)

    return { error: message }
  }

  const payload = {
    import_id: importId,
    user_id: user.id,
    partner_project_number: extracted.partner_project_number ?? null,
    detected_partner_name: extracted.detected_partner_name ?? null,
    project_name: extracted.project_name ?? null,
    project_type: extracted.project_type ?? null,
    location_address: extracted.location_address ?? null,
    location_postal_code: extracted.location_postal_code ?? null,
    location_city: extracted.location_city ?? null,
    location_state: extracted.location_state ?? null,
    location_country: extracted.location_country ?? 'Deutschland',
    location_lat: extracted.location_lat ?? null,
    location_lng: extracted.location_lng ?? null,
    pv_kwp: extracted.pv_kwp ?? null,
    bess_mw: extracted.bess_mw ?? null,
    bess_mwh: extracted.bess_mwh ?? null,
    feed_in_type: extracted.feed_in_type ?? null,
    purchase_price: extracted.purchase_price ?? null,
    confidence_score: extracted.confidence_score ?? null,
    missing_fields: extracted.missing_fields ?? [],
    raw_extracted_text: extracted.raw_extracted_text ?? null,
    raw_result: extracted as any,
  }

  const { data: result, error: resultError } = await supabase
    .from('project_import_results')
    .insert(payload as never)
    .select('*')
    .single()

  if (resultError) {
    return { error: `Analyse wurde erstellt, aber nicht gespeichert: ${resultError.message}` }
  }

  await supabase
    .from('project_imports')
    .update({ import_status: 'ready' } as never)
    .eq('id', importId)
    .eq('user_id', user.id)

  return {
    success: true,
    result,
  }
}
