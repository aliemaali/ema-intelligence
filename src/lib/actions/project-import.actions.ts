'use server'

import { createClient } from '@/lib/supabase/server'

const BUCKET_NAME = 'project-imports'

type ExtractedProjectImport = {
  partner_project_number?: string | null
  project_name?: string | null
  plant_type?: string | null
  location_address?: string | null
  location_city?: string | null
  location_state?: string | null
  pv_kwp?: number | null
  bess_mwh?: number | null
  feed_in_type?: string | null
  purchase_price?: number | null
  tariff?: string | null
  specific_yield?: string | null
  confidence_score?: number | null
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

function isPdfType(type?: string | null, name?: string | null) {
  return type === 'application/pdf' || Boolean(name?.toLowerCase().endsWith('.pdf'))
}

function normalizeNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const cleaned = String(value)
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '')
  const number = Number(cleaned)
  return Number.isFinite(number) ? number : null
}

function cleanText(text: string) {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) return match[1].trim()
  }
  return null
}

function extractUploadedProjectData(text: string): ExtractedProjectImport {
  const normalized = cleanText(text)

  const projectName = firstMatch(normalized, [
    /Projekt\s+([^\n]+)/i,
    /Projektname\s*:?\s*([^\n]+)/i,
  ])

  const plantType = firstMatch(normalized, [
    /Anlagenart\s*:?\s*([^\n]+)/i,
    /(Aufdachanlage|Freifl[aä]chenanlage|Dachanlage|PV[-\s]?Anlage)/i,
  ])

  const pvText = firstMatch(normalized, [
    /Anlagengr[oö][ßs]e\s*:?\s*([\d.,]+)\s*kWp/i,
    /PV[-\s]?Leistung\s*:?\s*([\d.,]+)\s*kWp/i,
    /Leistung\s*:?\s*([\d.,]+)\s*kWp/i,
    /([\d.,]+)\s*kWp/i,
  ])

  const bessText = firstMatch(normalized, [
    /BESS[-\s]?(?:Leistung|Kapazit[aä]t)\s*:?\s*([\d.,]+)\s*MWh/i,
    /Speicher(?:kapazit[aä]t)?\s*:?\s*([\d.,]+)\s*MWh/i,
    /([\d.,]+)\s*MWh/i,
  ])

  const purchaseText = firstMatch(normalized, [
    /Kaufpreis\s*:?\s*([\d.,]+)\s*(?:€|EUR)/i,
    /Preis\s*:?\s*([\d.,]+)\s*(?:€|EUR)/i,
    /([\d.]+,\d{2})\s*(?:€|EUR)/i,
  ])

  const tariff = firstMatch(normalized, [
    /Einspeiseverg[uü]tung\*?\s*:?\s*([\d.,]+\s*(?:EUR|€)\s*\/\s*kWh)/i,
    /Verg[uü]tung\*?\s*:?\s*([\d.,]+\s*(?:EUR|€)\s*\/\s*kWh)/i,
    /([\d.,]+\s*(?:EUR|€)\s*\/\s*kWh)/i,
  ])

  const specificYield = firstMatch(normalized, [
    /spezifischer\s+Ertrag\s*:?\s*([\d.,]+\s*kWh\s*\/\s*kWp)/i,
    /Ertrag\s*:?\s*([\d.,]+\s*kWh\s*\/\s*kWp)/i,
    /([\d.,]+\s*kWh\s*\/\s*kWp)/i,
  ])

  const feedInType = /PPA/i.test(normalized)
    ? 'PPA'
    : /Volleinspeisung|Voll/i.test(normalized)
      ? 'Voll'
      : /EEG/i.test(normalized)
        ? 'EEG'
        : null

  const city = firstMatch(normalized, [
    /(?:Ort|Standort)\s*:?\s*([^\n,]+)/i,
    /Projekt\s+(?:PVA\s+|PV\s+)?([A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+)/,
  ])

  const found = [projectName, plantType, pvText, purchaseText, tariff, specificYield].filter(Boolean).length

  return {
    project_name: projectName,
    plant_type: plantType,
    location_city: city,
    pv_kwp: normalizeNumber(pvText),
    bess_mwh: normalizeNumber(bessText),
    purchase_price: normalizeNumber(purchaseText),
    feed_in_type: feedInType,
    tariff,
    specific_yield: specificYield,
    confidence_score: Math.min(1, found / 6),
    raw_extracted_text: normalized.slice(0, 12000),
  }
}

async function extractTextFromBlob(blob: Blob, fileName?: string | null) {
  const type = blob.type || ''
  const arrayBuffer = await blob.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  if (isPdfType(type, fileName)) {
    const pdfParse = (await import('pdf-parse')).default
    const result = await pdfParse(buffer)
    return result.text || ''
  }

  if (isImageType(type)) {
    const { createWorker } = await import('tesseract.js')
    const worker = await createWorker('deu+eng')
    try {
      const result = await worker.recognize(buffer)
      return result.data.text || ''
    } finally {
      await worker.terminate()
    }
  }

  if (type.startsWith('text/')) return buffer.toString('utf-8')
  return ''
}

export async function uploadProjectImportFiles(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) return { error: 'Nicht angemeldet. Bitte neu einloggen.' }

  const files = formData
    .getAll('files')
    .filter((value): value is File => value instanceof File && value.size > 0)

  if (files.length === 0) return { error: 'Keine Datei ausgewählt.' }

  const importId = crypto.randomUUID()
  const uploaded: Array<{ name: string; size: number; type: string; path: string }> = []

  for (const file of files) {
    const safeName = sanitizeFileName(file.name || 'import-datei')
    const path = `${user.id}/imports/${importId}/${Date.now()}-${safeName}`

    const { error } = await supabase.storage.from(BUCKET_NAME).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'application/octet-stream',
    })

    if (error) return { error: `Upload fehlgeschlagen: ${error.message}`, uploaded }

    uploaded.push({ name: file.name, size: file.size, type: file.type || 'application/octet-stream', path })
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
    return { error: `Dateien wurden gespeichert, aber der Import konnte nicht registriert werden: ${insertError.message}`, uploaded }
  }

  return { success: true, importId, bucket: BUCKET_NAME, uploaded }
}

export async function prepareProjectImport(importId: string) {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) return { error: 'Nicht angemeldet. Bitte neu einloggen.' }

  const { data: projectImport, error: importError } = await supabase
    .from('project_imports')
    .select('*')
    .eq('id', importId)
    .eq('user_id', user.id)
    .single()

  if (importError || !projectImport) return { error: 'Import wurde nicht gefunden.' }

  const paths = (projectImport as any).storage_paths as string[]
  const names = ((projectImport as any).original_file_names as string[]) ?? []
  let extracted: ExtractedProjectImport = { confidence_score: 0, raw_extracted_text: '' }

  if (paths?.length) {
    try {
      const { data: fileBlob, error: downloadError } = await supabase.storage.from(BUCKET_NAME).download(paths[0])
      if (downloadError || !fileBlob) throw new Error(downloadError?.message ?? 'Datei konnte nicht gelesen werden')
      const extractedText = await extractTextFromBlob(fileBlob, names[0])
      extracted = extractUploadedProjectData(extractedText)
    } catch (error) {
      extracted = {
        confidence_score: 0,
        raw_extracted_text: error instanceof Error ? error.message : 'Texterkennung fehlgeschlagen',
      }
    }
  }

  const payload = {
    import_id: importId,
    user_id: user.id,
    partner_project_number: extracted.partner_project_number ?? null,
    project_name: extracted.project_name ?? null,
    location_address: extracted.location_address ?? null,
    location_city: extracted.location_city ?? null,
    location_state: extracted.location_state ?? null,
    pv_kwp: extracted.pv_kwp ?? null,
    bess_mwh: extracted.bess_mwh ?? null,
    feed_in_type: extracted.feed_in_type ?? null,
    purchase_price: extracted.purchase_price ?? null,
    confidence_score: extracted.confidence_score ?? null,
    raw_result: {
      mode: 'free-ocr-regex-phase-1',
      plant_type: extracted.plant_type ?? null,
      tariff: extracted.tariff ?? null,
      specific_yield: extracted.specific_yield ?? null,
      raw_extracted_text: extracted.raw_extracted_text ?? null,
    },
  }

  const { data: existing } = await supabase
    .from('project_import_results')
    .select('id')
    .eq('import_id', importId)
    .eq('user_id', user.id)
    .maybeSingle()

  const query = existing
    ? supabase.from('project_import_results').update(payload as never).eq('id', (existing as any).id).select('*').single()
    : supabase.from('project_import_results').insert(payload as never).select('*').single()

  const { data: result, error: resultError } = await query

  if (resultError) return { error: `Vorschau konnte nicht vorbereitet werden: ${resultError.message}` }

  await supabase
    .from('project_imports')
    .update({ import_status: 'ready' } as never)
    .eq('id', importId)
    .eq('user_id', user.id)

  return { success: true, result }
}

export async function analyzeProjectImport(importId: string) {
  return prepareProjectImport(importId)
}
