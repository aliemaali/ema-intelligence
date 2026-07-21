import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get('city')?.trim()
  if (!city || city.length < 2) return NextResponse.json({ state: null })

  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', `${city}, Deutschland`)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('countrycodes', 'de')
  url.searchParams.set('limit', '2')

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'EMA-Intelligence/1.0 (location-state lookup)',
        'Accept-Language': 'de',
      },
      next: { revalidate: 86400 },
    })

    if (!response.ok) return NextResponse.json({ state: null })
    const results = await response.json() as Array<{ address?: { state?: string } }>
    const states = Array.from(new Set(results.map((item) => item.address?.state).filter(Boolean)))

    return NextResponse.json({ state: states.length === 1 ? states[0] : null })
  } catch {
    return NextResponse.json({ state: null })
  }
}
