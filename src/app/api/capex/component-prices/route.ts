import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEmaVoiceUserName } from '@/lib/ema/voiceAccess'
import { INVERTER_CATALOG, MODULE_CATALOG } from '@/lib/capex/componentCatalog'
import type { ComponentKind, ComponentPriceSource } from '@/lib/types/capex.types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses'
const OPENAI_PRICE_MODEL = 'gpt-5.6-luna'
const MAX_REQUEST_BYTES = 4 * 1024

const responseSchema = {
  type: 'object',
  properties: {
    offers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          retailer: { type: 'string' },
          url: { type: 'string' },
          displayed_price_eur: { type: 'number' },
          vat_basis: {
            type: 'string',
            enum: ['net', 'gross_19', 'zero_vat', 'unknown'],
          },
          price_net_eur: { type: 'number' },
          shipping_net_eur: { type: 'number' },
          available: { type: 'boolean' },
          observed_at: { type: 'string' },
          note: { type: 'string' },
        },
        required: [
          'retailer',
          'url',
          'displayed_price_eur',
          'vat_basis',
          'price_net_eur',
          'shipping_net_eur',
          'available',
          'observed_at',
          'note',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['offers'],
  additionalProperties: false,
} as const

function safetyIdentifier(userId: string) {
  return createHash('sha256').update(userId).digest('hex')
}

function getOutputText(payload: any): string {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim()
  }

  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (content?.type === 'output_text' && typeof content.text === 'string' && content.text.trim()) {
        return content.text.trim()
      }
    }
  }

  return ''
}

function findCatalogEntry(kind: ComponentKind, manufacturer: string, model: string) {
  if (kind === 'module') {
    const item = MODULE_CATALOG.find((entry) => (
      entry.manufacturer === manufacturer && entry.model === model
    ))
    return item ? { ratedPower: item.powerWp, unit: 'ein einzelnes PV-Modul' } : null
  }

  const brand = INVERTER_CATALOG.find((entry) => entry.manufacturer === manufacturer)
  const item = brand?.models.find((entry) => entry.model === model)
  return item ? { ratedPower: item.acPowerKw, unit: 'einen einzelnen Wechselrichter' } : null
}

function normalizeOffers(value: unknown): ComponentPriceSource[] {
  if (!value || typeof value !== 'object') return []
  const offers = Array.isArray((value as any).offers) ? (value as any).offers : []
  const seen = new Set<string>()
  const normalized: ComponentPriceSource[] = []

  for (const offer of offers) {
    const url = typeof offer?.url === 'string' ? offer.url.trim() : ''
    const retailer = typeof offer?.retailer === 'string' ? offer.retailer.trim() : ''
    const priceNetEur = Number(offer?.price_net_eur)
    const shippingNetEur = Math.max(0, Number(offer?.shipping_net_eur) || 0)
    const available = offer?.available === true
    const vatBasis = String(offer?.vat_basis ?? '')

    if (
      !url.startsWith('https://')
      || !retailer
      || !available
      || vatBasis === 'zero_vat'
      || !Number.isFinite(priceNetEur)
      || priceNetEur <= 0
      || priceNetEur > 2_000_000
      || seen.has(url)
    ) continue

    seen.add(url)
    normalized.push({
      retailer,
      url,
      priceNetEur: priceNetEur + shippingNetEur,
      shippingNetEur,
      available,
      observedAt: typeof offer?.observed_at === 'string'
        ? offer.observed_at
        : new Date().toISOString(),
      note: typeof offer?.note === 'string' ? offer.note.slice(0, 240) : '',
    })
  }

  return normalized
    .sort((a, b) => a.priceNetEur - b.priceNetEur)
    .slice(0, 5)
}

function cleanedAverage(offers: ComponentPriceSource[]) {
  if (offers.length < 3) return null

  const prices = offers.map((offer) => offer.priceNetEur).sort((a, b) => a - b)
  const median = prices[Math.floor(prices.length / 2)]
  const plausible = offers.filter((offer) => (
    offer.priceNetEur >= median * 0.5 && offer.priceNetEur <= median * 2
  ))

  if (plausible.length < 3) return null
  const ordered = [...plausible].sort((a, b) => a.priceNetEur - b.priceNetEur)
  const used = ordered.length >= 5 ? ordered.slice(1, -1) : ordered
  return {
    average: used.reduce((sum, offer) => sum + offer.priceNetEur, 0) / used.length,
    usedCount: used.length,
  }
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: 'Anfrage ist zu groß.' }, { status: 413 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  }

  if (!getEmaVoiceUserName(user.email)) {
    return NextResponse.json({ error: 'Die EMA-Preisermittlung ist für dieses Konto nicht freigeschaltet.' }, { status: 403 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'EMA ist noch nicht mit OpenAI verbunden.' }, { status: 503 })
  }

  let body: { kind?: unknown; manufacturer?: unknown; model?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  const kind = body.kind === 'module' || body.kind === 'inverter' ? body.kind : null
  const manufacturer = typeof body.manufacturer === 'string' ? body.manufacturer.trim() : ''
  const model = typeof body.model === 'string' ? body.model.trim() : ''
  if (!kind || !manufacturer || !model) {
    return NextResponse.json({ error: 'Komponente ist unvollständig.' }, { status: 400 })
  }

  const catalogEntry = findCatalogEntry(kind, manufacturer, model)
  if (!catalogEntry) {
    return NextResponse.json({ error: 'Komponente ist nicht im freigegebenen EMA-Katalog.' }, { status: 400 })
  }

  const today = new Date().toISOString().slice(0, 10)
  const prompt = [
    `Recherchiere exakt ${manufacturer} ${model} (${catalogEntry.ratedPower} ${kind === 'module' ? 'Wp' : 'kW'}) für den deutschen gewerblichen PV-Markt.`,
    `Gesucht sind bis zu fünf aktuell verfügbare Online-Angebote für ${catalogEntry.unit}.`,
    'Nutze bevorzugt deutsche oder EU-Fachhändler und nur konkrete Produktseiten mit sichtbarem Preis.',
    'Normalisiere jeden Preis auf netto ohne Umsatzsteuer und auf eine einzelne Einheit.',
    'Bei Bruttopreisen mit 19 % Umsatzsteuer: korrekt durch 1,19 teilen.',
    '0-%-Umsatzsteuer-Angebote für private PV-Anlagen nicht verwenden.',
    'Paket-, Paletten- oder Mengenpreise nur verwenden, wenn der Netto-Einzelpreis eindeutig berechenbar ist.',
    'Versandkosten netto separat erfassen; unbekannte Versandkosten mit 0 und einem klaren Hinweis kennzeichnen.',
    'Nicht verfügbare, gebrauchte, generalüberholte oder abweichende Modelle als available=false kennzeichnen.',
    'Keine Preise schätzen. Wenn weniger als fünf belastbare Angebote existieren, nur die belastbaren zurückgeben.',
    `Recherchezeitpunkt: ${today}.`,
  ].join(' ')

  let openAiResponse: Response
  try {
    openAiResponse = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Safety-Identifier': safetyIdentifier(user.id),
      },
      body: JSON.stringify({
        model: OPENAI_PRICE_MODEL,
        reasoning: { effort: 'none' },
        store: false,
        max_output_tokens: 2400,
        tools: [{ type: 'web_search' }],
        input: prompt,
        text: {
          format: {
            type: 'json_schema',
            name: 'ema_component_price_research',
            strict: true,
            schema: responseSchema,
          },
        },
      }),
      cache: 'no-store',
    })
  } catch (error) {
    console.error('EMA component price connection failed:', error)
    return NextResponse.json({ error: 'EMA konnte die Preissuche gerade nicht erreichen.' }, { status: 502 })
  }

  const responseText = await openAiResponse.text()
  if (!openAiResponse.ok) {
    console.error('EMA component price search failed:', openAiResponse.status, responseText.slice(0, 600))
    return NextResponse.json({ error: 'EMA konnte aktuell keine Preise ermitteln.' }, { status: 502 })
  }

  let payload: any
  try {
    payload = JSON.parse(responseText)
  } catch {
    return NextResponse.json({ error: 'EMA erhielt keine gültige Preisantwort.' }, { status: 502 })
  }

  const outputText = getOutputText(payload)
  let research: unknown
  try {
    research = JSON.parse(outputText)
  } catch {
    return NextResponse.json({ error: 'EMA erhielt keine strukturierte Preisantwort.' }, { status: 502 })
  }

  const offers = normalizeOffers(research)
  const result = cleanedAverage(offers)
  if (!result) {
    return NextResponse.json({
      error: 'Es wurden weniger als drei belastbare Netto-Angebote gefunden. Bitte den Preis manuell eintragen.',
      offers,
    }, { status: 422 })
  }

  return NextResponse.json({
    kind,
    manufacturer,
    model,
    ratedPower: catalogEntry.ratedPower,
    priceDate: new Date().toISOString(),
    averageOnlineNetEur: Math.round(result.average * 100) / 100,
    sourceCount: offers.length,
    averagedOfferCount: result.usedCount,
    offers,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
