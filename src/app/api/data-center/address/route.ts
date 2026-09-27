import { NextRequest, NextResponse } from 'next/server'

type NominatimResult = {
  display_name: string
  lat: string
  lon: string
  address?: Record<string, string>
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (query.length < 2) return NextResponse.json({ suggestions: [] })

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 7000)

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('q', query)
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('addressdetails', '1')
    url.searchParams.set('limit', '8')
    url.searchParams.set('countrycodes', 'de')

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'EMA-Intelligence/1.0 (data-center address search)',
        'Accept-Language': 'de,en;q=0.8',
      },
    })
    if (!response.ok) throw new Error(`Nominatim ${response.status}`)

    const results = await response.json() as NominatimResult[]
    return NextResponse.json({
      suggestions: results.map((result) => {
        const address = result.address ?? {}
        return {
          label: result.display_name,
          address: result.display_name,
          street: address.road || address.pedestrian || address.industrial || '',
          houseNumber: address.house_number || '',
          postalCode: address.postcode || '',
          city: address.city || address.town || address.village || address.municipality || '',
          municipality: address.municipality || address.city || address.town || '',
          district: address.county || address.city_district || '',
          state: address.state || '',
          country: address.country || 'Deutschland',
          latitude: Number(result.lat),
          longitude: Number(result.lon),
        }
      }),
    })
  } catch {
    return NextResponse.json({ suggestions: [], unavailable: true })
  } finally {
    clearTimeout(timeout)
  }
}
