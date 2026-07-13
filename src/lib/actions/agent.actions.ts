'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const USER_AGENT = 'EMA-Intelligence/1.0 (contact: unluer@ema-enterprise.de)'

function inferJobType(prompt: string) {
  const text = prompt.toLowerCase()
  if (text.includes('dach') || text.includes('logistik') || text.includes('halle')) return 'roof_search'
  if (text.includes('projekt') || text.includes('pv') || text.includes('bess') || text.includes('hybrid')) return 'project_search'
  if (text.includes('mail') || text.includes('e-mail')) return 'email_drafting'
  if (text.includes('bewert') || text.includes('score')) return 'lead_scoring'
  return 'other'
}

function extractLocation(prompt: string) {
  const normalized = prompt.replace(/[.!?]+$/g, '').trim()
  const match = normalized.match(/(?:\bin\b|\bum\b|\bbei\b)\s+([A-Za-zÄÖÜäöüß\-\s]+?)(?=\s+(?:mit|ohne|und|ab|bis|im|in einem|innerhalb|größer|ueber|über)\b|$)/i)
  return match?.[1]?.trim() || ''
}

function extractRadiusKm(prompt: string) {
  const match = prompt.match(/(\d{1,3})\s*km/i)
  const requested = match ? Number(match[1]) : 20
  return Math.max(2, Math.min(requested, 50))
}

function polygonAreaSqm(points: Array<{ lat: number; lon: number }>) {
  if (points.length < 3) return 0
  const meanLat = points.reduce((sum, point) => sum + point.lat, 0) / points.length
  const latScale = 111_320
  const lonScale = 111_320 * Math.cos((meanLat * Math.PI) / 180)
  let area = 0

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]
    const next = points[(index + 1) % points.length]
    const x1 = current.lon * lonScale
    const y1 = current.lat * latScale
    const x2 = next.lon * lonScale
    const y2 = next.lat * latScale
    area += x1 * y2 - x2 * y1
  }

  return Math.abs(area / 2)
}

async function addJobLog(db: any, userId: string, jobId: string, message: string, level = 'info', metadata: Record<string, unknown> = {}) {
  await db.from('agent_logs').insert({ user_id: userId, job_id: jobId, level, message, metadata })
}

async function updateJob(db: any, userId: string, jobId: string, values: Record<string, unknown>) {
  await db.from('agent_jobs').update(values).eq('id', jobId).eq('user_id', userId)
}

export async function createAgentJob(formData: FormData) {
  const prompt = String(formData.get('prompt') || '').trim()
  if (prompt.length < 10) redirect('/ai-agent?error=prompt')

  const supabase = await createClient()
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const title = prompt.length > 72 ? `${prompt.slice(0, 69)}...` : prompt
  const { data: job, error } = await db.from('agent_jobs').insert({
    user_id: user.id,
    title,
    prompt,
    job_type: inferJobType(prompt),
    status: 'queued',
    progress: 0,
    current_step: 'Auftrag wartet auf Verarbeitung',
  }).select('id').single()

  if (error || !job) redirect('/ai-agent?error=create')

  await addJobLog(db, user.id, job.id, 'Auftrag wurde erstellt und in die Warteschlange aufgenommen.')
  revalidatePath('/ai-agent')
  redirect(`/ai-agent?job=${job.id}&created=1`)
}

export async function runRoofSearchJob(formData: FormData) {
  const jobId = String(formData.get('job_id') || '')
  const supabase = await createClient()
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: job } = await db
    .from('agent_jobs')
    .select('id,prompt,job_type,status')
    .eq('id', jobId)
    .eq('user_id', user.id)
    .single()

  if (!job || job.job_type !== 'roof_search' || ['completed', 'cancelled'].includes(job.status)) {
    redirect(`/ai-agent?job=${jobId}&error=unsupported`)
  }

  const location = extractLocation(job.prompt)
  const radiusKm = extractRadiusKm(job.prompt)
  if (!location) redirect(`/ai-agent?job=${jobId}&error=location`)

  try {
    await updateJob(db, user.id, jobId, {
      status: 'planning', progress: 8, current_step: `Suchgebiet ${location} wird vorbereitet`, started_at: new Date().toISOString(), error_message: null,
    })
    await addJobLog(db, user.id, jobId, `Suchgebiet wird geocodiert: ${location}.`)

    const geocodeUrl = new URL('https://nominatim.openstreetmap.org/search')
    geocodeUrl.searchParams.set('q', `${location}, Deutschland`)
    geocodeUrl.searchParams.set('format', 'jsonv2')
    geocodeUrl.searchParams.set('limit', '1')
    geocodeUrl.searchParams.set('countrycodes', 'de')

    const geocodeResponse = await fetch(geocodeUrl, { headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'de' }, cache: 'no-store' })
    if (!geocodeResponse.ok) throw new Error(`Geocoding fehlgeschlagen (${geocodeResponse.status})`)
    const geocode = await geocodeResponse.json() as Array<{ lat: string; lon: string; display_name: string }>
    if (!geocode[0]) throw new Error(`Ort nicht gefunden: ${location}`)

    const lat = Number(geocode[0].lat)
    const lon = Number(geocode[0].lon)
    const radiusMeters = radiusKm * 1000

    await updateJob(db, user.id, jobId, { status: 'researching', progress: 25, current_step: `Gewerbegebäude im Radius von ${radiusKm} km werden gesucht` })
    await addJobLog(db, user.id, jobId, `OpenStreetMap-Recherche im Radius von ${radiusKm} km gestartet.`)

    const query = `[out:json][timeout:45];(
      way(around:${radiusMeters},${lat},${lon})["building"~"industrial|warehouse|commercial|retail"];
      relation(around:${radiusMeters},${lat},${lon})["building"~"industrial|warehouse|commercial|retail"];
    );out tags center geom 80;`

    const overpassResponse = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', 'User-Agent': USER_AGENT },
      body: new URLSearchParams({ data: query }),
      cache: 'no-store',
    })
    if (!overpassResponse.ok) throw new Error(`OSM-Abfrage fehlgeschlagen (${overpassResponse.status})`)

    const overpass = await overpassResponse.json() as { elements?: Array<any> }
    const candidates = (overpass.elements || [])
      .map((element) => {
        const geometry = Array.isArray(element.geometry) ? element.geometry : []
        const areaSqm = Math.round(polygonAreaSqm(geometry))
        const tags = element.tags || {}
        const center = element.center || geometry[0] || { lat, lon }
        const name = tags.name || tags.operator || tags['addr:housename'] || `Gewerbedach OSM ${element.id}`
        const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ')
        const city = tags['addr:city'] || location
        const sourceUrl = `https://www.openstreetmap.org/${element.type}/${element.id}`
        const estimatedKwp = Math.round(areaSqm * 0.16)
        const score = Math.min(95, Math.round(45 + Math.min(areaSqm, 20_000) / 400 + (tags.name || tags.operator ? 10 : 0)))
        return { areaSqm, tags, center, name, street, city, sourceUrl, estimatedKwp, score }
      })
      .filter((candidate) => candidate.areaSqm >= 2_000)
      .sort((a, b) => b.score - a.score)
      .slice(0, 25)

    await updateJob(db, user.id, jobId, { status: 'analyzing', progress: 52, current_step: `${candidates.length} größere Dachflächen werden bewertet` })
    await addJobLog(db, user.id, jobId, `${candidates.length} Gebäude mit mindestens 2.000 m² geschätzter Grundfläche gefunden.`, 'success')

    const sourceUrls = candidates.map((candidate) => candidate.sourceUrl)
    const { data: existingRows } = sourceUrls.length
      ? await db.from('acquisition_leads').select('source_url').eq('user_id', user.id).in('source_url', sourceUrls)
      : { data: [] }
    const existing = new Set((existingRows || []).map((row: any) => row.source_url))
    const newCandidates = candidates.filter((candidate) => !existing.has(candidate.sourceUrl))

    await updateJob(db, user.id, jobId, { status: 'creating_leads', progress: 70, current_step: `${newCandidates.length} neue Leads werden angelegt` })

    let createdLeads = 0
    for (const candidate of newCandidates) {
      const { data: lead, error: leadError } = await db.from('acquisition_leads').insert({
        user_id: user.id,
        acquisition_type: 'roof',
        company_name: candidate.name,
        website: candidate.tags.website || candidate.tags['contact:website'] || null,
        phone: candidate.tags.phone || candidate.tags['contact:phone'] || null,
        email: candidate.tags.email || candidate.tags['contact:email'] || null,
        street: candidate.street || null,
        postal_code: candidate.tags['addr:postcode'] || null,
        city: candidate.city,
        state: null,
        source_name: 'OpenStreetMap / Overpass',
        source_url: candidate.sourceUrl,
        source_checked_at: new Date().toISOString(),
        project_type: 'pv_dach',
        estimated_potential_kwp: candidate.estimatedKwp,
        estimated_roof_area_sqm: candidate.areaSqm,
        owner_status: 'unknown',
        existing_pv_status: 'unknown',
        score: candidate.score,
        score_reason: 'Vorläufiger Scout-Score aus Gebäudegröße und verfügbaren OSM-Unternehmensdaten. Technische Eignung und Eigentümerstatus müssen geprüft werden.',
        status: 'researching',
        notes: `Automatisch durch EMA Scout gefunden. Koordinaten: ${candidate.center.lat}, ${candidate.center.lon}.`,
        next_action: 'Eigentümer, Ansprechpartner und vorhandene PV-Anlage prüfen',
      }).select('id').single()

      if (leadError || !lead) continue
      createdLeads += 1

      await db.from('agent_results').insert({
        user_id: user.id,
        job_id: jobId,
        result_type: 'roof',
        title: candidate.name,
        score: candidate.score,
        acquisition_lead_id: lead.id,
        payload: {
          source_url: candidate.sourceUrl,
          roof_area_sqm: candidate.areaSqm,
          estimated_potential_kwp: candidate.estimatedKwp,
          latitude: candidate.center.lat,
          longitude: candidate.center.lon,
          osm_tags: candidate.tags,
        },
      })

      await db.from('acquisition_activities').insert({
        user_id: user.id,
        lead_id: lead.id,
        activity_type: 'created',
        title: 'Durch EMA Scout angelegt',
        description: `Dachfläche aus OpenStreetMap-Recherche für ${location}.`,
        metadata: { job_id: jobId, source_url: candidate.sourceUrl },
      })
    }

    const summary = {
      location,
      radius_km: radiusKm,
      osm_candidates: candidates.length,
      duplicates_skipped: candidates.length - newCandidates.length,
      leads_created: createdLeads,
    }

    await updateJob(db, user.id, jobId, {
      status: 'completed', progress: 100, current_step: `${createdLeads} Dachflächen-Leads angelegt`, completed_at: new Date().toISOString(), result_summary: summary,
    })
    await addJobLog(db, user.id, jobId, `Recherche abgeschlossen: ${createdLeads} neue Dachflächen-Leads angelegt.`, 'success', summary)

    revalidatePath('/ai-agent')
    revalidatePath('/acquisition')
    redirect(`/ai-agent?job=${jobId}&completed=1`)
  } catch (error) {
    if (typeof error === 'object' && error && 'digest' in error && String((error as { digest?: unknown }).digest).startsWith('NEXT_REDIRECT')) {
      throw error
    }
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler bei der Dachflächenrecherche.'
    await updateJob(db, user.id, jobId, { status: 'failed', current_step: 'Recherche fehlgeschlagen', error_message: message })
    await addJobLog(db, user.id, jobId, message, 'error')
    revalidatePath('/ai-agent')
    redirect(`/ai-agent?job=${jobId}&error=run`)
  }
}

export async function cancelAgentJob(formData: FormData) {
  const jobId = String(formData.get('job_id') || '')
  const supabase = await createClient()
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !jobId) return

  await db.from('agent_jobs').update({ status: 'cancelled', current_step: 'Vom Benutzer gestoppt' }).eq('id', jobId).eq('user_id', user.id)
  await addJobLog(db, user.id, jobId, 'Auftrag wurde gestoppt.', 'warning')
  revalidatePath('/ai-agent')
}
