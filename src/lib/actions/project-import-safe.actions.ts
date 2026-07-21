'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prepareProjectImport, uploadProjectImportFiles } from '@/lib/actions/project-import.actions'

const IMPORT_BUCKET = 'project-imports'
const PROJECT_BUCKET = 'project-documents'

export { uploadProjectImportFiles }

function cleanText(value: unknown) {
  return String(value ?? '').replace(/\u00a0/g, ' ').trim()
}

export function normalizeProjectNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  let raw = cleanText(value).replace(/\s/g, '').replace(/[^0-9,.-]/g, '')
  if (!raw) return null

  const comma = raw.lastIndexOf(',')
  const dot = raw.lastIndexOf('.')

  if (comma >= 0 && dot >= 0) {
    const decimalIsComma = comma > dot
    raw = decimalIsComma
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw.replace(/,/g, '')
  } else if (comma >= 0) {
    raw = raw.replace(/\./g, '').replace(',', '.')
  } else if ((raw.match(/\./g) ?? []).length > 1) {
    const parts = raw.split('.')
    const last = parts.pop() ?? ''
    raw = `${parts.join('')}.${last}`
  }

  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

function extractLabeledNumber(text: string, labels: string[]) {
  for (const label of labels) {
    const match = text.match(new RegExp(`${label}\\s*:?\\s*([0-9][0-9.,\\s]*)`, 'i'))
    const value = normalizeProjectNumber(match?.[1])
    if (value !== null) return value
  }
  return null
}

function extractTextValue(text: string, labels: string[]) {
  for (const label of labels) {
    const match = text.match(new RegExp(`${label}\\s*:?\\s*([^\\n]+)`, 'i'))
    if (match?.[1]) return match[1].trim()
  }
  return null
}

export async function prepareVerifiedProjectImport(importId: string) {
  const response = await prepareProjectImport(importId)
  if ('error' in response && response.error) return response

  const result = (response as any).result ?? {}
  const rawResult = result.raw_result ?? {}
  const sourceText = cleanText(rawResult.raw_extracted_text)

  const purchaseFromSource = extractLabeledNumber(sourceText, ['EK[-\\s]*(?:Kaufpreis|Preis)', 'Einkaufspreis', 'Kaufpreis'])
  const pvFromSource = extractLabeledNumber(sourceText, ['Anlagengr[oö][ßs]e', 'PV[-\\s]?Leistung', 'DC[-\\s]?Leistung', 'Nennleistung'])
  const tariffFromSource = extractTextValue(sourceText, ['Einspeiseverg[uü]tung', 'Verg[uü]tung'])
  const yieldFromSource = extractTextValue(sourceText, ['Spezifischer Ertrag', 'spez\\.? Ertrag'])

  const corrected = {
    ...result,
    purchase_price: purchaseFromSource ?? normalizeProjectNumber(result.purchase_price),
    pv_kwp: pvFromSource ?? normalizeProjectNumber(result.pv_kwp),
    raw_result: {
      ...rawResult,
      tariff: tariffFromSource ?? rawResult.tariff ?? null,
      specific_yield: yieldFromSource ?? rawResult.specific_yield ?? null,
      verification_required: true,
    },
  }

  return { success: true, result: corrected }
}

function inferProjectType(plantType: string) {
  const raw = plantType.toLowerCase()
  if (raw.includes('bess') || raw.includes('speicher')) return 'bess'
  if (raw.includes('hybrid')) return 'hybrid'
  if (raw.includes('dach') || raw.includes('aufdach')) return 'pv_dach'
  return 'pv_freiflaeche'
}

function safeFileName(name: string) {
  return name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').toLowerCase()
}

function documentType(name: string) {
  const raw = name.toLowerCase()
  if (raw.includes('expos')) return 'expose'
  if (raw.includes('netz')) return 'netzanschluss'
  if (raw.includes('pacht') || raw.includes('miet')) return 'pachtvertrag'
  if (raw.includes('ertrag') || raw.includes('pv-sol') || raw.includes('pvsol')) return 'gutachten'
  if (raw.match(/\.(jpg|jpeg|png|webp|heic)$/)) return 'bild'
  return 'sonstiges'
}

async function copyImportFiles(params: { supabase: any; importId: string; userId: string; projectId: string }) {
  const { data: imported } = await params.supabase
    .from('project_imports')
    .select('storage_paths, original_file_names')
    .eq('id', params.importId)
    .eq('user_id', params.userId)
    .maybeSingle()

  const paths = imported?.storage_paths ?? []
  const names = imported?.original_file_names ?? []
  const rows: any[] = []

  for (let index = 0; index < paths.length; index += 1) {
    const sourcePath = paths[index]
    const originalName = names[index] ?? `Import-Datei-${index + 1}`
    const { data: blob, error } = await params.supabase.storage.from(IMPORT_BUCKET).download(sourcePath)
    if (error || !blob) continue

    const targetPath = `${params.userId}/${params.projectId}/${Date.now()}-${index}-${safeFileName(originalName)}`
    const mimeType = blob.type || 'application/octet-stream'
    const { error: uploadError } = await params.supabase.storage.from(PROJECT_BUCKET).upload(targetPath, blob, {
      cacheControl: '3600',
      upsert: false,
      contentType: mimeType,
    })
    if (uploadError) continue

    rows.push({
      project_id: params.projectId,
      user_id: params.userId,
      document_type: documentType(originalName),
      display_name: originalName.replace(/\.[^/.]+$/, ''),
      file_name: originalName,
      file_path: targetPath,
      file_size_bytes: blob.size,
      mime_type: mimeType,
      version: 1,
    })
  }

  if (rows.length) await params.supabase.from('documents').insert(rows)
  return rows.length
}

export async function createVerifiedProjectFromImport(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (formData.get('values_confirmed') !== 'on') {
    return { error: 'Bitte bestätige, dass du die Werte mit den Unterlagen geprüft hast.' }
  }

  const text = (key: string) => cleanText(formData.get(key))
  const projectName = text('project_name')
  const plantType = text('plant_type')
  const pvKwp = normalizeProjectNumber(formData.get('pv_kwp'))
  const bessMwh = normalizeProjectNumber(formData.get('bess_mwh'))
  const purchasePrice = normalizeProjectNumber(formData.get('purchase_price'))
  const tariff = normalizeProjectNumber(formData.get('tariff'))
  const specificYield = normalizeProjectNumber(formData.get('specific_yield'))
  const importId = text('import_id')
  const projectType = inferProjectType(plantType)

  if (!projectName) return { error: 'Projektname fehlt.' }
  if (pvKwp !== null && (pvKwp <= 0 || pvKwp > 2_000_000)) return { error: 'PV-Leistung ist unplausibel. Bitte Einheit und Zahl prüfen.' }
  if (projectType === 'pv_dach' && pvKwp !== null && pvKwp > 20_000) return { error: 'Die Leistung ist für ein Dachprojekt ungewöhnlich hoch. Bitte den Wert nochmals prüfen.' }
  if (purchasePrice !== null && (purchasePrice < 1_000 || purchasePrice > 500_000_000)) return { error: 'Der Kaufpreis ist unplausibel. Bitte deutsches Zahlenformat und Betrag prüfen.' }
  if (specificYield !== null && (specificYield < 300 || specificYield > 2_000)) return { error: 'Der spezifische Ertrag ist unplausibel. Erwartet werden ungefähr 300–2.000 kWh/kWp.' }
  if (tariff !== null && (tariff <= 0 || tariff > 100)) return { error: 'Die Vergütung ist unplausibel. Bitte €/kWh oder ct/kWh prüfen.' }

  const tariffEur = tariff !== null ? (tariff > 1 ? tariff / 100 : tariff) : null
  const now = new Date().toISOString()
  const notes = [
    'Quelle: geprüfter Projekt-Import',
    plantType ? `Anlagenart: ${plantType}` : null,
    purchasePrice !== null ? `EK-Kaufpreis: ${purchasePrice.toLocaleString('de-DE')} €` : null,
    tariffEur !== null ? `Vergütung: ${tariffEur.toLocaleString('de-DE', { maximumFractionDigits: 6 })} EUR/kWh` : null,
    specificYield !== null ? `Spezifischer Ertrag: ${specificYield.toLocaleString('de-DE')} kWh/kWp` : null,
    text('feed_in_type') ? `Einspeiseart: ${text('feed_in_type')}` : null,
    importId ? `Import-ID: ${importId}` : null,
    `Manuell bestätigt: ${now}`,
  ].filter(Boolean).join('\n')

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,
      project_name: projectName,
      project_type: projectType,
      status: 'lead',
      priority: 'mittel',
      marketing_status: 'nicht_gestartet',
      location_city: text('location_city') || null,
      location_state: text('location_state') || null,
      location_country: 'Deutschland',
      pv_mwp: pvKwp,
      bess_mwh: bessMwh,
      dev_status: {},
      ai_score_details: {
        ema_ai: {
          feed_in_tariff_eur_kwh: tariffEur,
          specific_yield_kwh_kwp: specificYield,
          feed_in_type: text('feed_in_type') || null,
          verified_import: true,
          verified_at: now,
        },
      },
      notes,
      tags: ['import', 'geprueft'],
      is_archived: false,
    } as never)
    .select('id, project_number, project_name')
    .single()

  if (projectError || !project) return { error: projectError?.message ?? 'Projekt konnte nicht erstellt werden.' }

  if (purchasePrice !== null) {
    const { count } = await supabase.from('deals').select('*', { count: 'exact', head: true }).eq('user_id', user.id)
    const dealNumber = `DEAL-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(3, '0')}`
    await supabase.from('deals').insert({
      project_id: (project as any).id,
      user_id: user.id,
      deal_number: dealNumber,
      is_active: true,
      deal_status: 'open',
      purchase_price: purchasePrice,
      purchase_per_kwp: pvKwp ? purchasePrice / pvKwp : null,
      purchase_per_mwh: bessMwh ? purchasePrice / bessMwh : null,
      margin_type: 'percent',
      margin_value: 0,
      margin_eur: 0,
      sales_price: purchasePrice,
      gross_margin: 0,
      gross_margin_pct: 0,
      net_profit: 0,
      net_profit_pct: 0,
      notes: 'Aus geprüftem Projekt-Import erstellt.',
    } as never)
  }

  const attached = importId ? await copyImportFiles({ supabase, importId, userId: user.id, projectId: (project as any).id }) : 0

  await supabase.from('activity_log').insert({
    user_id: user.id,
    project_id: (project as any).id,
    activity_type: 'manual',
    title: 'Geprüfte Projektdaten übernommen',
    description: `${(project as any).project_number} – ${(project as any).project_name}`,
    metadata: { import_id: importId || null, attached_documents: attached, values_confirmed: true },
  } as never)

  if (importId) await supabase.from('project_imports').update({ import_status: 'created' } as never).eq('id', importId).eq('user_id', user.id)

  revalidatePath('/projects')
  revalidatePath('/dashboard')
  redirect(`/projects/${(project as any).id}/overview`)
}
