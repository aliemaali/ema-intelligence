'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

function value(formData: FormData, key: string) {
  const current = formData.get(key)
  return typeof current === 'string' ? current.trim() : ''
}

function number(formData: FormData, key: string) {
  const raw = value(formData, key).replace(/\s/g, '').replace(',', '.')
  if (!raw) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

export async function updateVerifiedProjectValues(projectId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Nicht angemeldet.' }

  const pvKwp = number(formData, 'pv_kwp')
  const tariffCt = number(formData, 'feed_in_tariff_ct_kwh')
  const specificYield = number(formData, 'specific_yield_kwh_kwp')
  const purchasePrice = number(formData, 'purchase_price')
  const projectType = value(formData, 'project_type')

  if (pvKwp !== null && pvKwp <= 0) return { error: 'PV-Leistung muss größer als 0 sein.' }
  if (projectType === 'pv_dach' && pvKwp !== null && pvKwp > 20000) return { error: 'Dachleistung über 20.000 kWp ist unplausibel. Bitte Einheit prüfen.' }
  if (tariffCt !== null && (tariffCt <= 0 || tariffCt > 100)) return { error: 'Vergütung muss zwischen 0 und 100 ct/kWh liegen.' }
  if (specificYield !== null && (specificYield < 400 || specificYield > 2500)) return { error: 'Spezifischer Ertrag muss zwischen 400 und 2.500 kWh/kWp liegen.' }
  if (purchasePrice !== null && purchasePrice > 1000000000) return { error: 'EK-Kaufpreis ist unplausibel hoch.' }

  const annualYield = pvKwp !== null && specificYield !== null ? pvKwp * specificYield : null
  const { error } = await supabase.from('projects').update({
    pv_mwp: pvKwp,
    feed_in_type: value(formData, 'feed_in_type') || null,
    feed_in_tariff_ct_kwh: tariffCt,
    specific_yield_kwh_kwp: specificYield,
    annual_yield_kwh: annualYield,
    values_verified_at: new Date().toISOString(),
    values_verified_by: user.id,
  } as never).eq('id', projectId).eq('user_id', user.id)

  if (error) return { error: error.message }

  const { data: deal } = await supabase.from('deals').select('id').eq('project_id', projectId).eq('user_id', user.id).eq('is_active', true).maybeSingle()
  if (deal && purchasePrice !== null) {
    await supabase.from('deals').update({
      purchase_price: purchasePrice,
      sales_price: purchasePrice,
      purchase_per_kwp: pvKwp ? purchasePrice / pvKwp : null,
    } as never).eq('id', (deal as any).id)
  }

  await supabase.from('activity_log').insert({
    user_id: user.id,
    project_id: projectId,
    activity_type: 'manual' as never,
    title: 'Projektwerte manuell geprüft',
    description: 'Technische und wirtschaftliche Werte wurden bestätigt und aktualisiert.',
    metadata: { values_verified: true },
  })

  revalidatePath(`/projects/${projectId}/overview`)
  revalidatePath(`/projects/${projectId}/edit`)
  revalidatePath(`/expose/${projectId}`)
  revalidatePath('/projects')
  revalidatePath('/dashboard')
  return { success: true }
}
