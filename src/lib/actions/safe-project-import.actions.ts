'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function getString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function parseLocalizedNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const raw = String(value).trim().replace(/\s/g, '').replace(/[^0-9,.-]/g, '')
  if (!raw) return null

  const comma = raw.lastIndexOf(',')
  const dot = raw.lastIndexOf('.')
  let normalized = raw

  if (comma >= 0 && dot >= 0) {
    const decimal = comma > dot ? ',' : '.'
    const thousands = decimal === ',' ? /\./g : /,/g
    normalized = raw.replace(thousands, '').replace(decimal, '.')
  } else if (comma >= 0) {
    normalized = raw.replace(/\./g, '').replace(',', '.')
  } else if (dot >= 0) {
    const pieces = raw.split('.')
    normalized = pieces.length > 2 ? pieces.join('') : raw
  }

  const number = Number(normalized)
  return Number.isFinite(number) ? number : null
}

function projectType(value: string) {
  const raw = value.toLowerCase()
  if (raw.includes('bess') || raw.includes('speicher')) return 'bess'
  if (raw.includes('hybrid')) return 'hybrid'
  if (raw.includes('dach') || raw.includes('aufdach')) return 'pv_dach'
  return 'pv_freiflaeche'
}

function documentType(name: string) {
  const raw = name.toLowerCase()
  if (raw.includes('expos')) return 'expose'
  if (raw.includes('netz')) return 'netzanschluss'
  if (raw.includes('pacht') || raw.includes('miet')) return 'pachtvertrag'
  if (raw.includes('ertrag') || raw.includes('pv-sol') || raw.includes('gutachten')) return 'gutachten'
  if (raw.includes('lageplan')) return 'lageplan'
  return 'sonstiges'
}

function validateValues(params: {
  type: string
  pvKwp: number | null
  bessMwh: number | null
  purchasePrice: number | null
  tariffCt: number | null
  specificYield: number | null
}) {
  const errors: string[] = []
  if (params.pvKwp !== null && params.pvKwp <= 0) errors.push('PV-Leistung muss größer als 0 sein.')
  if (params.type === 'pv_dach' && params.pvKwp !== null && params.pvKwp > 20000) errors.push('PV-Dachleistung über 20.000 kWp ist unplausibel. Bitte Wert und Einheit prüfen.')
  if (params.pvKwp !== null && params.pvKwp > 1000000) errors.push('PV-Leistung ist unplausibel hoch.')
  if (params.bessMwh !== null && params.bessMwh < 0) errors.push('BESS-Kapazität darf nicht negativ sein.')
  if (params.purchasePrice !== null && params.purchasePrice > 1000000000) errors.push('EK-Kaufpreis ist unplausibel hoch.')
  if (params.tariffCt !== null && (params.tariffCt <= 0 || params.tariffCt > 100)) errors.push('Vergütung muss zwischen 0 und 100 ct/kWh liegen.')
  if (params.specificYield !== null && (params.specificYield < 400 || params.specificYield > 2500)) errors.push('Spezifischer Ertrag muss zwischen 400 und 2.500 kWh/kWp liegen.')
  return errors
}

export async function createVerifiedProjectFromImport(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (getString(formData, 'confirmed') !== 'yes') return { error: 'Bitte bestätige, dass du die Werte geprüft hast.' }

  const importId = getString(formData, 'import_id')
  const projectName = getString(formData, 'project_name')
  const plantType = getString(formData, 'plant_type')
  const type = projectType(plantType)
  const pvKwp = parseLocalizedNumber(formData.get('pv_kwp'))
  const bessMwh = parseLocalizedNumber(formData.get('bess_mwh'))
  const purchasePrice = parseLocalizedNumber(formData.get('purchase_price'))
  const tariffInput = parseLocalizedNumber(formData.get('tariff'))
  const tariffCt = tariffInput !== null && tariffInput <= 1 ? tariffInput * 100 : tariffInput
  const specificYield = parseLocalizedNumber(formData.get('specific_yield'))
  const annualYield = pvKwp !== null && specificYield !== null ? pvKwp * specificYield : null

  if (!projectName) return { error: 'Projektname fehlt.' }
  const validation = validateValues({ type, pvKwp, bessMwh, purchasePrice, tariffCt, specificYield })
  if (validation.length) return { error: validation.join(' ') }

  const { data: project, error } = await supabase.from('projects').insert({
    user_id: user.id,
    project_name: projectName,
    project_type: type,
    status: 'lead',
    priority: 'mittel',
    marketing_status: 'nicht_gestartet',
    location_city: getString(formData, 'location_city') || null,
    location_state: getString(formData, 'location_state') || null,
    location_country: 'Deutschland',
    pv_mwp: pvKwp,
    bess_mwh: bessMwh,
    feed_in_type: getString(formData, 'feed_in_type') || null,
    feed_in_tariff_ct_kwh: tariffCt,
    specific_yield_kwh_kwp: specificYield,
    annual_yield_kwh: annualYield,
    values_verified_at: new Date().toISOString(),
    values_verified_by: user.id,
    notes: ['Quelle: Projekt-Import', importId ? `Import-ID: ${importId}` : null].filter(Boolean).join('\n'),
    tags: ['import', 'geprueft'],
    is_archived: false,
  } as never).select('id, project_number, project_name').single()

  if (error || !project) return { error: error?.message ?? 'Projekt konnte nicht erstellt werden.' }
  const projectId = (project as any).id as string

  if (purchasePrice && purchasePrice > 0) {
    const { count } = await supabase.from('deals').select('*', { count: 'exact', head: true }).eq('user_id', user.id)
    await supabase.from('deals').insert({
      project_id: projectId,
      user_id: user.id,
      deal_number: `DEAL-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(3, '0')}`,
      is_active: true,
      deal_status: 'open',
      purchase_price: purchasePrice,
      purchase_per_kwp: pvKwp ? purchasePrice / pvKwp : null,
      purchase_per_mwh: bessMwh ? purchasePrice / bessMwh : null,
      margin_type: 'percent', margin_value: 0, margin_eur: 0,
      sales_price: purchasePrice, gross_margin: 0, gross_margin_pct: 0,
      net_profit: 0, net_profit_pct: 0,
      notes: 'Aus geprüftem Projekt-Import erstellt.',
    } as never)
  }

  if (importId) {
    const { data: projectImport } = await supabase.from('project_imports')
      .select('storage_paths, original_file_names').eq('id', importId).eq('user_id', user.id).maybeSingle()
    const paths = ((projectImport as any)?.storage_paths as string[]) ?? []
    const names = ((projectImport as any)?.original_file_names as string[]) ?? []

    for (const [index, path] of paths.entries()) {
      const name = names[index] ?? `Import-Datei-${index + 1}`
      const { data: blob } = await supabase.storage.from('project-imports').download(path)
      if (!blob) continue
      const safe = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase()
      const target = `${user.id}/${projectId}/${Date.now()}-${safe}`
      const { error: uploadError } = await supabase.storage.from('project-documents').upload(target, blob, { contentType: blob.type || 'application/octet-stream' })
      if (uploadError) continue
      await supabase.from('documents').insert({
        project_id: projectId, user_id: user.id, document_type: documentType(name),
        display_name: name.replace(/\.[^/.]+$/, ''), file_name: name, file_path: target,
        file_size_bytes: blob.size, mime_type: blob.type || 'application/octet-stream', version: 1,
      } as never)
    }

    await supabase.from('project_imports').update({ import_status: 'created' } as never).eq('id', importId).eq('user_id', user.id)
  }

  await supabase.from('activity_log').insert({
    user_id: user.id, project_id: projectId, activity_type: 'manual' as never,
    title: 'Geprüftes Projekt erstellt', description: `${(project as any).project_number} – ${projectName}`,
    metadata: { import_id: importId || null, values_verified: true },
  })

  revalidatePath('/projects')
  revalidatePath('/dashboard')
  redirect(`/projects/${projectId}/overview`)
}
