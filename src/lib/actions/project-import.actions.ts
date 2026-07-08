'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { DocumentType } from '@/lib/types/database.types'

const BUCKET_NAME = 'project-imports'
const PROJECT_DOCUMENTS_BUCKET = 'project-documents'

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

type ImportedFileMeta = {
  name: string
  path: string
  size: number | null
  type: string | null
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

function getString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function getStringOrNull(formData: FormData, key: string) {
  const value = getString(formData, key)
  return value ? value : null
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

function inferProjectType(plantType?: string | null) {
  const raw = (plantType ?? '').toLowerCase()
  if (raw.includes('aufdach') || raw.includes('dach')) return 'pv_dach'
  return 'pv_freiflaeche'
}

function inferDocumentType(fileName: string, mimeType?: string | null): DocumentType {
  const raw = `${fileName} ${mimeType ?? ''}`.toLowerCase()

  if (raw.includes('exposé') || raw.includes('expose') || raw.includes('angebot')) return 'expose'
  if (raw.includes('lageplan') || raw.includes('flur') || raw.includes('karte')) return 'lageplan'
  if (raw.includes('netz') || raw.includes('anschluss') || raw.includes('einspeise')) return 'netzanschluss'
  if (raw.includes('pacht') || raw.includes('miet')) return 'pachtvertrag'
  if (raw.includes('genehm') || raw.includes('b-plan') || raw.includes('bau')) return 'genehmigung'
  if (raw.includes('gutachten') || raw.includes('statik') || raw.includes('ertrag')) return 'gutachten'
  if (raw.includes('nda')) return 'nda'
  if (raw.includes('loi')) return 'loi'
  if (raw.includes('spa')) return 'spa'
  if (raw.startsWith('image/') || raw.includes('image/') || /\.(jpg|jpeg|png|webp|heic)$/i.test(fileName)) return 'bild'

  return 'sonstiges'
}

function stripFileExtension(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, '')
}

function mergeExtractedData(current: ExtractedProjectImport, next: ExtractedProjectImport): ExtractedProjectImport {
  const currentScore = current.confidence_score ?? 0
  const nextScore = next.confidence_score ?? 0

  return {
    partner_project_number: current.partner_project_number ?? next.partner_project_number ?? null,
    project_name: current.project_name ?? next.project_name ?? null,
    plant_type: current.plant_type ?? next.plant_type ?? null,
    location_address: current.location_address ?? next.location_address ?? null,
    location_city: current.location_city ?? next.location_city ?? null,
    location_state: current.location_state ?? next.location_state ?? null,
    pv_kwp: current.pv_kwp ?? next.pv_kwp ?? null,
    bess_mwh: current.bess_mwh ?? next.bess_mwh ?? null,
    feed_in_type: current.feed_in_type ?? next.feed_in_type ?? null,
    purchase_price: current.purchase_price ?? next.purchase_price ?? null,
    tariff: current.tariff ?? next.tariff ?? null,
    specific_yield: current.specific_yield ?? next.specific_yield ?? null,
    confidence_score: Math.max(currentScore, nextScore),
    raw_extracted_text: [current.raw_extracted_text, next.raw_extracted_text].filter(Boolean).join('\n\n--- DATEI ---\n\n').slice(0, 12000),
  }
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
    /(?:EK[-\s]*(?:Kaufpreis|Preis)|Einkaufspreis)\s*:?\s*([\d.,]+)\s*(?:€|EUR)?/i,
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

async function requireUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  return { supabase, userId: user.id }
}

export async function uploadProjectImportFiles(formData: FormData) {
  const { supabase, userId } = await requireUser()

  const files = formData
    .getAll('files')
    .filter((value): value is File => value instanceof File && value.size > 0)

  if (files.length === 0) return { error: 'Keine Datei ausgewählt.' }

  const importId = crypto.randomUUID()
  const uploaded: Array<{ name: string; size: number; type: string; path: string }> = []

  for (const file of files) {
    const safeName = sanitizeFileName(file.name || 'import-datei')
    const path = `${userId}/imports/${importId}/${Date.now()}-${safeName}`

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
    user_id: userId,
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
  const { supabase, userId } = await requireUser()

  const { data: projectImport, error: importError } = await supabase
    .from('project_imports')
    .select('*')
    .eq('id', importId)
    .eq('user_id', userId)
    .single()

  if (importError || !projectImport) return { error: 'Import wurde nicht gefunden.' }

  const paths = ((projectImport as any).storage_paths as string[]) ?? []
  const names = ((projectImport as any).original_file_names as string[]) ?? []
  let extracted: ExtractedProjectImport = { confidence_score: 0, raw_extracted_text: '' }
  const fileResults: Array<{ name: string; path: string; status: 'read' | 'skipped' | 'error'; message?: string }> = []

  for (const [index, path] of paths.entries()) {
    const name = names[index] ?? `Datei ${index + 1}`

    try {
      const { data: fileBlob, error: downloadError } = await supabase.storage.from(BUCKET_NAME).download(path)
      if (downloadError || !fileBlob) throw new Error(downloadError?.message ?? 'Datei konnte nicht gelesen werden')

      const extractedText = await extractTextFromBlob(fileBlob, name)
      if (!extractedText.trim()) {
        fileResults.push({ name, path, status: 'skipped', message: 'Kein Text erkannt' })
        continue
      }

      extracted = mergeExtractedData(extracted, extractUploadedProjectData(extractedText))
      fileResults.push({ name, path, status: 'read' })
    } catch (error) {
      fileResults.push({
        name,
        path,
        status: 'error',
        message: error instanceof Error ? error.message : 'Texterkennung fehlgeschlagen',
      })
    }
  }

  if (!paths.length) {
    extracted = {
      confidence_score: 0,
      raw_extracted_text: 'Keine Dateien im Import gefunden',
    }
  }

  const payload = {
    import_id: importId,
    user_id: userId,
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
      mode: 'soldesk-data-room-v1-3',
      plant_type: extracted.plant_type ?? null,
      tariff: extracted.tariff ?? null,
      specific_yield: extracted.specific_yield ?? null,
      raw_extracted_text: extracted.raw_extracted_text ?? null,
      data_room_files: fileResults,
    },
  }

  const { data: existing } = await supabase
    .from('project_import_results')
    .select('id')
    .eq('import_id', importId)
    .eq('user_id', userId)
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
    .eq('user_id', userId)

  return { success: true, result }
}

async function getImportFilesForProject(importId: string, userId: string) {
  const supabase = await createClient()

  const { data: projectImport } = await supabase
    .from('project_imports')
    .select('storage_paths, original_file_names')
    .eq('id', importId)
    .eq('user_id', userId)
    .maybeSingle()

  const paths = ((projectImport as any)?.storage_paths as string[]) ?? []
  const names = ((projectImport as any)?.original_file_names as string[]) ?? []

  return paths.map((path, index): ImportedFileMeta => ({
    path,
    name: names[index] ?? `Soldesk-Datei-${index + 1}`,
    size: null,
    type: null,
  }))
}

async function attachImportedFilesToProject(params: {
  projectId: string
  userId: string
  importId: string
}) {
  const supabase = await createClient()
  const files = await getImportFilesForProject(params.importId, params.userId)
  const documentRows: Array<Record<string, unknown>> = []

  for (const file of files) {
    const { data: sourceBlob, error: downloadError } = await supabase.storage.from(BUCKET_NAME).download(file.path)
    if (downloadError || !sourceBlob) continue

    const safeName = sanitizeFileName(file.name || 'soldesk-datei')
    const targetPath = `${params.userId}/${params.projectId}/${Date.now()}-${safeName}`
    const mimeType = sourceBlob.type || file.type || 'application/octet-stream'

    const { error: uploadError } = await supabase.storage.from(PROJECT_DOCUMENTS_BUCKET).upload(targetPath, sourceBlob, {
      cacheControl: '3600',
      upsert: false,
      contentType: mimeType,
    })

    if (uploadError) continue

    documentRows.push({
      project_id: params.projectId,
      user_id: params.userId,
      document_type: inferDocumentType(file.name, mimeType),
      display_name: stripFileExtension(file.name) || file.name,
      file_name: file.name,
      file_path: targetPath,
      file_size_bytes: sourceBlob.size ?? file.size ?? 0,
      mime_type: mimeType,
      version: 1,
    })
  }

  if (documentRows.length > 0) {
    await supabase.from('documents').insert(documentRows as never)
  }

  return documentRows.length
}

async function createDealFromImport(params: {
  projectId: string
  userId: string
  purchasePrice: number | null
  pvKwp: number | null
  bessMwh: number | null
  notes: string | null
}) {
  if (!params.purchasePrice || params.purchasePrice <= 0) return null

  const supabase = await createClient()
  const year = new Date().getFullYear()
  const { count } = await supabase
    .from('deals')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', params.userId)

  const num = String((count ?? 0) + 1).padStart(3, '0')
  const dealNumber = `DEAL-${year}-${num}`
  const purchasePerKwp = params.pvKwp ? params.purchasePrice / params.pvKwp : null
  const purchasePerMwh = params.bessMwh ? params.purchasePrice / params.bessMwh : null

  const { data, error } = await supabase
    .from('deals')
    .insert({
      project_id: params.projectId,
      user_id: params.userId,
      deal_number: dealNumber,
      is_active: true,
      deal_status: 'open',
      purchase_price: params.purchasePrice,
      purchase_per_kwp: purchasePerKwp,
      purchase_per_mwh: purchasePerMwh,
      margin_type: 'percent',
      margin_value: 0,
      margin_eur: 0,
      sales_price: params.purchasePrice,
      gross_margin: 0,
      gross_margin_pct: 0,
      net_profit: 0,
      net_profit_pct: 0,
      notes: params.notes,
    } as never)
    .select('id, deal_number')
    .single()

  if (error) return null
  return data as { id: string; deal_number: string }
}

export async function createProjectFromImport(formData: FormData) {
  const { supabase, userId } = await requireUser()

  const importId = getString(formData, 'import_id')
  const projectName = getString(formData, 'project_name')

  if (!projectName) return { error: 'Projektname fehlt.' }

  const plantType = getString(formData, 'plant_type')
  const purchasePrice = getString(formData, 'purchase_price')
  const purchasePriceNumber = normalizeNumber(purchasePrice)
  const tariff = getString(formData, 'tariff')
  const specificYield = getString(formData, 'specific_yield')
  const feedInType = getString(formData, 'feed_in_type')
  const pvKwp = normalizeNumber(formData.get('pv_kwp'))
  const bessMwh = normalizeNumber(formData.get('bess_mwh'))

  const notes = [
    'Quelle: Soldesk-Datenraum Import',
    plantType ? `Anlagenart: ${plantType}` : null,
    purchasePrice ? `EK-Kaufpreis: ${purchasePrice}` : null,
    tariff ? `Vergütung: ${tariff}` : null,
    specificYield ? `Spezifischer Ertrag: ${specificYield}` : null,
    feedInType ? `Einspeiseart: ${feedInType}` : null,
    importId ? `Import-ID: ${importId}` : null,
  ].filter(Boolean).join('\n')

  const insertData = {
    user_id: userId,
    project_name: projectName,
    project_type: inferProjectType(plantType),
    status: 'lead',
    priority: 'mittel',
    marketing_status: 'nicht_gestartet',
    partner_id: null,
    contact_name: null,
    contact_email: null,
    contact_phone: null,
    location_city: getStringOrNull(formData, 'location_city'),
    location_state: getStringOrNull(formData, 'location_state'),
    location_country: 'Deutschland',
    pv_mwp: pvKwp,
    pv_ac_mw: null,
    bess_mw: null,
    bess_mwh: bessMwh,
    bess_duration_h: null,
    hybrid_config: null,
    dev_status: {
      netzanschluss: null,
      baugenehmigung: null,
      pachtvertrag: null,
      eeg_faehigkeit: null,
      gutachten: null,
      umweltpruefung: null,
    },
    notes: notes || null,
    tags: ['import', 'soldesk'],
    is_archived: false,
  }

  const { data, error } = await supabase
    .from('projects')
    .insert(insertData as never)
    .select('id, project_number, project_name')
    .single()

  if (error) return { error: error.message }

  const projectId = (data as any).id as string
  const attachedDocumentCount = importId
    ? await attachImportedFilesToProject({ projectId, userId, importId })
    : 0

  const deal = await createDealFromImport({
    projectId,
    userId,
    purchasePrice: purchasePriceNumber,
    pvKwp,
    bessMwh,
    notes: 'Automatisch aus Soldesk-Import erstellt. Marge bitte im Deal-Tab ergänzen.',
  })

  await supabase.from('activity_log').insert({
    user_id: userId,
    project_id: projectId,
    activity_type: 'manual' as never,
    title: 'Projektakte aus Soldesk erstellt',
    description: `${(data as any).project_number} – ${(data as any).project_name}`,
    metadata: {
      import_id: importId || null,
      attached_documents: attachedDocumentCount,
      deal_number: deal?.deal_number ?? null,
    },
  })

  if (importId) {
    await supabase
      .from('project_imports')
      .update({ import_status: 'created' } as never)
      .eq('id', importId)
      .eq('user_id', userId)
  }

  revalidatePath('/projects')
  revalidatePath('/dashboard')
  revalidatePath(`/projects/${projectId}/documents`)
  revalidatePath(`/projects/${projectId}/deal`)
  redirect(`/projects/${projectId}/overview`)
}

export async function analyzeProjectImport(importId: string) {
  return prepareProjectImport(importId)
}
