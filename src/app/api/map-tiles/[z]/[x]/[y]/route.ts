import { NextResponse } from 'next/server'

export const runtime = 'edge'

const TILE_CACHE_SECONDS = 60 * 60 * 24 * 7

function validTileCoordinate(value: string, max: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 && parsed < max ? parsed : null
}

export async function GET(
  _request: Request,
  { params }: { params: { z: string; x: string; y: string } },
) {
  const zoom = Number(params.z)
  if (!Number.isInteger(zoom) || zoom < 0 || zoom > 19) {
    return NextResponse.json({ error: 'Ungültige Zoomstufe' }, { status: 400 })
  }

  const tileCount = 2 ** zoom
  const x = validTileCoordinate(params.x, tileCount)
  const y = validTileCoordinate(params.y, tileCount)
  if (x === null || y === null) {
    return NextResponse.json({ error: 'Ungültige Kartenkoordinaten' }, { status: 400 })
  }

  const upstream = await fetch(`https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`, {
    headers: {
      Accept: 'image/png,image/*;q=0.8',
      'User-Agent': 'EMA-Intelligence/9.0 (+https://github.com/aliemaali/ema-intelligence)',
    },
  })

  if (!upstream.ok) {
    return NextResponse.json(
      { error: 'OpenStreetMap-Kachel konnte nicht geladen werden' },
      { status: upstream.status },
    )
  }

  return new NextResponse(await upstream.arrayBuffer(), {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'image/png',
      'Cache-Control': `public, max-age=${TILE_CACHE_SECONDS}, s-maxage=${TILE_CACHE_SECONDS}, stale-while-revalidate=2592000`,
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
