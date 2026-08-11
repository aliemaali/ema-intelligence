import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEmaVoiceUserName } from '@/lib/ema/voiceAccess'
import { getMountingSystem } from '@/lib/capex/mountingCatalog'
import type { ComponentPriceSource } from '@/lib/types/capex.types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function outputText(payload: any) {
  if (typeof payload?.output_text === 'string') return payload.output_text
  for (const item of Array.isArray(payload?.output) ? payload.output : []) for (const content of Array.isArray(item?.content) ? item.content : []) if (content?.type === 'output_text' && typeof content.text === 'string') return content.text
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
  const manufacturer = typeof body.manufacturer === 'string' ? body.manufacturer.trim() : ''
  const system = typeof body.system === 'string' ? body.system.trim() : ''
  const catalog = getMountingSystem(manufacturer, system)
  if (!catalog) return NextResponse.json({ error: 'Montagesystem ist nicht im EMA-Katalog.' }, { status: 400 })
  const plantKwp = Math.max(0, Number(body.plantKwp) || 0)

  const schema = {
    type: 'object', properties: { offers: { type: 'array', items: { type: 'object', properties: {
      retailer: { type: 'string' }, url: { type: 'string' }, price_net_eur_per_kwp: { type: 'number' },
      available: { type: 'boolean' }, observed_at: { type: 'string' }, note: { type: 'string' },
    }, required: ['retailer', 'url', 'price_net_eur_per_kwp', 'available', 'observed_at', 'note'], additionalProperties: false } } },
    required: ['offers'], additionalProperties: false,
  }
  const prompt = [
    `Recherchiere aktuelle gewerbliche Netto-Marktpreise für das PV-Montagesystem ${manufacturer} ${system} in Deutschland.`,
    `Projekt: ${plantKwp} kWp, Anwendung ${catalog.application}, Untergrund ${body.surfaceType || body.terrainType || 'nicht angegeben'}, Modul ${body.moduleLengthMm || '?'} × ${body.moduleWidthMm || '?'} mm.`,
    'Gesucht sind bis zu fünf belastbare Fachhandelsangebote oder öffentlich belegte Systempreise, jeweils normiert auf netto EUR/kWp.',
    'Nur konkrete Quellen verwenden. Komplettpreise nur normieren, wenn enthaltene kWp eindeutig sind. Keine Montagearbeit, Ballastierung, Erdarbeiten oder Fundamente einrechnen.',
    'Wenn kein belastbarer normierter Preis vorhanden ist, keine Angebote erfinden und eine leere Liste zurückgeben.',
  ].join(' ')
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST', headers: {
      Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json',
      'OpenAI-Safety-Identifier': createHash('sha256').update(user.id).digest('hex'),
    },
    body: JSON.stringify({ model: 'gpt-5.6-luna', reasoning: { effort: 'none' }, store: false, max_output_tokens: 1800, tools: [{ type: 'web_search' }], input: prompt, text: { format: { type: 'json_schema', name: 'ema_mounting_prices', strict: true, schema } } }),
    cache: 'no-store',
  })
  const raw = await response.text()
  if (!response.ok) return NextResponse.json({ error: 'EMA konnte aktuell keine Montagesystempreise ermitteln.' }, { status: 502 })
  let parsed: any
  try { parsed = JSON.parse(outputText(JSON.parse(raw))) } catch { parsed = { offers: [] } }
  const offers: ComponentPriceSource[] = (Array.isArray(parsed.offers) ? parsed.offers : []).flatMap((offer: any) => {
    const price = Number(offer?.price_net_eur_per_kwp)
    const url = String(offer?.url || '')
    if (!offer?.available || !url.startsWith('https://') || !Number.isFinite(price) || price < 10 || price > 500) return []
    return [{ retailer: String(offer.retailer || 'Quelle'), url, priceNetEur: Math.round(price * 100) / 100, shippingNetEur: 0, available: true, observedAt: String(offer.observed_at || new Date().toISOString()), note: String(offer.note || 'Netto-Richtwert je kWp') }]
  }).slice(0, 5)
  const average = offers.length
    ? offers.reduce((sum, offer) => sum + offer.priceNetEur, 0) / offers.length
    : catalog.referenceEurPerKwp
  return NextResponse.json({
    averageNetEurPerKwp: Math.round(average * 100) / 100,
    priceDate: new Date().toISOString().slice(0, 10), offers,
    warning: offers.length
      ? offers.length < 3 ? `Richtwert aus nur ${offers.length} belastbaren Quelle(n). Bitte vor Bestellung gegenprüfen.` : ''
      : 'Keine belastbaren Onlinepreise gefunden. EMA verwendet den internen System-Richtwert; bitte mit einem Projektangebot bestätigen.',
  }, { headers: { 'Cache-Control': 'no-store' } })
}
