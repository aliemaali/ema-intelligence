import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get('city')?.trim()
  const state = request.nextUrl.searchParams.get('state')?.trim()

  if (!city && !state) {
    return NextResponse.json({ error: 'Standort fehlt.' }, { status: 400 })
  }

  try {
    const address = [city, state, 'Deutschland'].filter(Boolean).join(', ')
    const geocodeUrl = new URL('https://nominatim.openstreetmap.org/search')
    geocodeUrl.searchParams.set('q', address)
    geocodeUrl.searchParams.set('format', 'jsonv2')
    geocodeUrl.searchParams.set('limit', '1')
    geocodeUrl.searchParams.set('countrycodes', 'de')

    const geocodeResponse = await fetch(geocodeUrl, {
      headers: {
        'User-Agent': 'EMA-Intelligence/1.0 (info@ema-enterprise.de)',
        Accept: 'application/json',
      },
      cache: 'no-store',
    })

    if (!geocodeResponse.ok) throw new Error('Geocoding fehlgeschlagen')

    const locations = (await geocodeResponse.json()) as Array<{ lat: string; lon: string; display_name?: string }>
    const location = locations[0]
    if (!location) {
      return NextResponse.json({ error: 'Standort konnte nicht gefunden werden.' }, { status: 404 })
    }

    const pvgisUrl = new URL('https://re.jrc.ec.europa.eu/api/v5_3/PVcalc')
    pvgisUrl.searchParams.set('lat', location.lat)
    pvgisUrl.searchParams.set('lon', location.lon)
    pvgisUrl.searchParams.set('peakpower', '1')
    pvgisUrl.searchParams.set('loss', '14')
    pvgisUrl.searchParams.set('angle', '35')
    pvgisUrl.searchParams.set('aspect', '0')
    pvgisUrl.searchParams.set('outputformat', 'json')

    const pvgisResponse = await fetch(pvgisUrl, { cache: 'no-store' })
    if (!pvgisResponse.ok) throw new Error('PVGIS-Abfrage fehlgeschlagen')

    const pvgis = await pvgisResponse.json()
    const annualEnergy = Number(pvgis?.outputs?.totals?.fixed?.E_y)

    if (!Number.isFinite(annualEnergy) || annualEnergy <= 0) {
      throw new Error('Ungültiger PVGIS-Wert')
    }

    return NextResponse.json({
      specificYield: Math.round(annualEnergy),
      location: location.display_name ?? address,
      assumptions: 'PVGIS-Standortschätzung bei 35° Neigung, Südausrichtung und 14 % Systemverlusten.',
    })
  } catch (error) {
    console.error('Specific-yield estimate failed:', error)
    return NextResponse.json(
      { error: 'Der spezifische Ertrag konnte nicht automatisch ermittelt werden. Bitte manuell eintragen.' },
      { status: 502 }
    )
  }
}
