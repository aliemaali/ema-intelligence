'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type OsmElement = {
  type: 'node' | 'way' | 'relation'
  id: number
  tags?: Record<string, string>
}

function text(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function normalizeWebsite(value: string | null) {
  if (!value) return null
  return value.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '').toLowerCase()
}

function scoreCandidate(input: { email: string | null; website: string | null; city: string | null; tags: Record<string, string> }) {
  let score = 20
  if (input.email) score += 20
  if (input.website) score += 15
  if (input.city) score += 5
  if (input.tags.building === 'warehouse' || input.tags.building === 'industrial') score += 20
  if (input.tags.industrial || input.tags.landuse === 'industrial') score += 10
  if (input.tags['contact:phone'] || input.tags.phone) score += 5
  return Math.min(score, 100)
}

function sourceUrl(element: OsmElement) {
  return `https://www.openstreetmap.org/${element.type}/${element.id}`
}

export async function runOpenStreetMapResearch(formData: FormData) {
  const supabase = await createClient()
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const location = text(formData, 'location')
  const radiusInput = Number(text(formData, 'radius_km') || '10')
  const radiusKm = Math.min(Math.max(Number.isFinite(radiusInput) ? radiusInput : 10, 1), 50)
  const category = text(formData, 'category') || 'all'

  if (!location) redirect('/acquisition/research?error=location')

  const geocodeUrl = new URL('https://nominatim.openstreetmap.org/search')
  geocodeUrl.searchParams.set('format', 'jsonv2')
  geocodeUrl.searchParams.set('limit', '1')
  geocodeUrl.searchParams.set('countrycodes', 'de')
  geocodeUrl.searchParams.set('q', location)

  const geocodeResponse = await fetch(geocodeUrl, {
    headers: { 'User-Agent': 'EMA-Intelligence/1.0 (unluer@ema-enterprise.de)' },
    cache: 'no-store',
  })

  if (!geocodeResponse.ok) redirect('/acquisition/research?error=search')
  const geocoded = await geocodeResponse.json() as Array<{ lat: string; lon: string; display_name?: string }>
  if (!geocoded.length) redirect('/acquisition/research?error=location')

  const lat = Number(geocoded[0].lat)
  const lon = Number(geocoded[0].lon)
  const radiusMeters = Math.round(radiusKm * 1000)

  const filters = category === 'logistics'
    ? `nwr(around:${radiusMeters},${lat},${lon})["building"~"warehouse|industrial"]["name"];\nnwr(around:${radiusMeters},${lat},${lon})["industrial"~"warehouse|logistics"]["name"];`
    : category === 'industry'
      ? `nwr(around:${radiusMeters},${lat},${lon})["building"="industrial"]["name"];\nnwr(around:${radiusMeters},${lat},${lon})["landuse"="industrial"]["name"];\nnwr(around:${radiusMeters},${lat},${lon})["industrial"]["name"];`
      : `nwr(around:${radiusMeters},${lat},${lon})["building"~"industrial|warehouse|commercial"]["name"];\nnwr(around:${radiusMeters},${lat},${lon})["landuse"="industrial"]["name"];\nnwr(around:${radiusMeters},${lat},${lon})["office"="company"]["name"];\nnwr(around:${radiusMeters},${lat},${lon})["industrial"]["name"];`

  const query = `[out:json][timeout:25];\n(\n${filters}\n);\nout center tags 80;`
  const overpassResponse = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'User-Agent': 'EMA-Intelligence/1.0 (unluer@ema-enterprise.de)',
    },
    body: new URLSearchParams({ data: query }),
    cache: 'no-store',
  })

  if (!overpassResponse.ok) redirect('/acquisition/research?error=search')
  const payload = await overpassResponse.json() as { elements?: OsmElement[] }
  const elements = (payload.elements || []).filter((item) => item.tags?.name).slice(0, 80)

  const seen = new Set<string>()
  const rows = elements.flatMap((element) => {
    const tags = element.tags || {}
    const companyName = tags.name?.trim()
    if (!companyName) return []

    const website = tags.website || tags['contact:website'] || null
    const email = (tags.email || tags['contact:email'] || '').trim().toLowerCase() || null
    const city = tags['addr:city'] || location
    const dedupeKey = `${companyName.toLowerCase()}|${normalizeWebsite(website) || ''}`
    if (seen.has(dedupeKey)) return []
    seen.add(dedupeKey)

    const kind = tags.building || tags.industrial || tags.landuse || tags.office || 'Gewerbestandort'
    return [{
      user_id: user.id,
      acquisition_type: 'roof',
      company_name: companyName,
      website,
      email,
      city,
      state: tags['addr:state'] || null,
      source_name: 'OpenStreetMap / Overpass',
      source_url: sourceUrl(element),
      source_snippet: `Öffentlicher Standorttreffer: ${kind}. Suche: ${location}, Radius ${radiusKm} km.`,
      project_type: 'Gewerbedach / PV-Potenzial',
      project_stage: 'Standorttreffer – Kontaktdaten prüfen',
      estimated_potential_kwp: null,
      estimated_roof_area_sqm: null,
      score: scoreCandidate({ email, website, city, tags }),
      status: 'new',
    }]
  }).slice(0, 30)

  if (!rows.length) redirect('/acquisition/research?searched=1&found=0&added=0')

  const sourceUrls = rows.map((row) => row.source_url)
  const { data: existing } = await db
    .from('acquisition_research_candidates')
    .select('source_url')
    .eq('user_id', user.id)
    .in('source_url', sourceUrls)

  const existingUrls = new Set((existing || []).map((item: { source_url: string }) => item.source_url))
  const newRows = rows.filter((row) => !existingUrls.has(row.source_url))

  if (newRows.length) {
    const { error } = await db.from('acquisition_research_candidates').insert(newRows)
    if (error) redirect('/acquisition/research?error=save')
  }

  revalidatePath('/acquisition/research')
  revalidatePath('/acquisition/research/inbox')
  redirect(`/acquisition/research?searched=1&found=${rows.length}&added=${newRows.length}`)
}
