import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEmaVoiceUserName } from '@/lib/ema/voiceAccess'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DIBT_SOURCE = 'https://www.dibt.de/de/wir-bieten/technische-baubestimmungen/'

function outputText(payload: any) {
  if (typeof payload?.output_text === 'string') return payload.output_text
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') return content.text
    }
  }
  return ''
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  if (!getEmaVoiceUserName(user.email)) return NextResponse.json({ error: 'Für dieses Konto nicht freigeschaltet.' }, { status: 403 })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'EMA ist noch nicht mit OpenAI verbunden.' }, { status: 503 })

  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 }) }
  const city = typeof body.city === 'string' ? body.city.trim() : ''
  const state = typeof body.state === 'string' ? body.state.trim() : ''
  const country = typeof body.country === 'string' ? body.country.trim() : 'Deutschland'
  const address = typeof body.address === 'string' ? body.address.trim() : ''
  if (!city) return NextResponse.json({ error: 'Für die Lastzonen wird mindestens der Ort benötigt.' }, { status: 400 })
  if (!/deutschland|germany/i.test(country)) return NextResponse.json({ error: 'Die automatische DIBt-Zuordnung ist derzeit nur für Deutschland verfügbar.' }, { status: 400 })

  const schema = {
    type: 'object',
    properties: {
      wind_zone: { type: 'string' }, snow_zone: { type: 'string' },
      municipality: { type: 'string' }, official_match: { type: 'boolean' }, note: { type: 'string' },
    },
    required: ['wind_zone', 'snow_zone', 'municipality', 'official_match', 'note'],
    additionalProperties: false,
  }
  const location = [address, city, state, country].filter(Boolean).join(', ')
  const prompt = [
    `Ermittle für ${location} die Windzone und Schneelastzone in Deutschland.`,
    'Nutze ausschließlich die offiziellen DIBt-Zuordnungen der Wind- und Schneelastzonen nach Verwaltungsgrenzen.',
    'Gib official_match nur dann als true zurück, wenn Gemeinde und Bundesland eindeutig zugeordnet sind.',
    'Zulässige Windzonen sind 1, 2, 3 oder 4. Schneelastzonen sind 1, 1a, 2, 2a oder 3.',
    'Erfinde keine Zuordnung. Bei Mehrdeutigkeit Zonen leer lassen und die nötige manuelle Prüfung im Hinweis nennen.',
  ].join(' ')

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json',
      'OpenAI-Safety-Identifier': createHash('sha256').update(user.id).digest('hex'),
    },
    body: JSON.stringify({
      model: 'gpt-5.6-luna', reasoning: { effort: 'none' }, store: false, max_output_tokens: 900,
      tools: [{ type: 'web_search', filters: { allowed_domains: ['dibt.de', 'www.dibt.de'] } }],
      input: prompt,
      text: { format: { type: 'json_schema', name: 'ema_site_load_zones', strict: true, schema } },
    }),
    cache: 'no-store',
  })
  const raw = await response.text()
  if (!response.ok) {
    console.error('EMA site load lookup failed:', response.status, raw.slice(0, 500))
    return NextResponse.json({ error: 'EMA konnte die Lastzonen gerade nicht ermitteln.' }, { status: 502 })
  }
  let result: any
  try { result = JSON.parse(outputText(JSON.parse(raw))) } catch { return NextResponse.json({ error: 'EMA erhielt keine eindeutige Zonenzuordnung.' }, { status: 502 }) }
  const windZone = ['1', '2', '3', '4'].includes(String(result.wind_zone)) ? String(result.wind_zone) : ''
  const snowZone = ['1', '1a', '2', '2a', '3'].includes(String(result.snow_zone).toLowerCase()) ? String(result.snow_zone).toLowerCase() : ''
  const official = result.official_match === true && !!windZone && !!snowZone

  return NextResponse.json({
    windZone, snowZone, official,
    sourceUrl: DIBT_SOURCE,
    checkedAt: new Date().toISOString(),
    note: official
      ? `DIBt-Zuordnung für ${result.municipality || city}. Nur für CAPEX-Vorplanung; Gebäudehöhe, Geländekategorie, Höhenlage und Statik separat prüfen.`
      : String(result.note || 'Keine eindeutige offizielle Zuordnung. Bitte manuell prüfen.'),
  }, { headers: { 'Cache-Control': 'no-store' } })
}
