import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const OPENAI_REALTIME_URL = 'https://api.openai.com/v1/realtime/calls'
const MAX_SDP_BYTES = 128 * 1024
const EMA_NAVIGATION_PATHS = [
  '/dashboard',
  '/project-import',
  '/projects/audit',
  '/projects/archive',
  '/projects/new',
  '/projects',
  '/investors',
  '/partners',
  '/partner-submissions',
  '/dokumente',
  '/calendar',
  '/capex',
  '/deals',
  '/acquisition',
  '/ai',
  '/microsoft',
  '/settings',
]

const EMA_INSTRUCTIONS = `Du bist EMA, die KI-Assistentin von EMA Intelligence.
Sprich auf Deutsch, außer der Nutzer wechselt bewusst die Sprache.
Deine Stimme und Ausdrucksweise sind ruhig, warm, erwachsen, souverän und professionell.
Antworte im Sprachdialog kurz und natürlich. Meist reichen ein bis drei Sätze.
Wenn dir Informationen fehlen, frage gezielt nach statt etwas zu erfinden.
Behaupte niemals, dass du eine Aktion in der EMA-App ausgeführt hast, wenn dir dafür kein Werkzeug zur Verfügung steht.
Wenn der Nutzer einen EMA-Bereich öffnen möchte, nutze das Werkzeug open_ema_area.
Kritische Aktionen wie Löschen, Versenden oder verbindliche Änderungen dürfen nie ohne ausdrückliche Bestätigung ausgeführt werden.
Du bist eine KI-Stimme und darfst dich nicht als Mensch ausgeben.`

function safetyIdentifier(userId: string) {
  return createHash('sha256').update(userId).digest('hex')
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'EMA AI ist noch nicht mit OpenAI verbunden.' }, { status: 503 })
  }

  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().startsWith('application/sdp')) {
    return NextResponse.json({ error: 'Ungültige Sitzungsanfrage.' }, { status: 415 })
  }

  const sdp = await request.text()
  if (!sdp.startsWith('v=0') || new TextEncoder().encode(sdp).byteLength > MAX_SDP_BYTES) {
    return NextResponse.json({ error: 'Ungültige Sitzungsdaten.' }, { status: 400 })
  }

  const formData = new FormData()
  formData.set('sdp', sdp)
  formData.set('session', JSON.stringify({
    type: 'realtime',
    model: 'gpt-realtime-2.1-mini',
    output_modalities: ['audio'],
    instructions: EMA_INSTRUCTIONS,
    tools: [
      {
        type: 'function',
        name: 'open_ema_area',
        description: 'Öffnet einen freigegebenen Bereich der EMA-App. Nur für reine Navigation verwenden.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              enum: EMA_NAVIGATION_PATHS,
              description: 'Zielpfad des EMA-Bereichs.',
            },
          },
          required: ['path'],
          additionalProperties: false,
        },
      },
    ],
    tool_choice: 'auto',
    audio: {
      input: {
        turn_detection: { type: 'semantic_vad' },
      },
      output: {
        voice: 'marin',
      },
    },
  }))

  try {
    const openAiResponse = await fetch(OPENAI_REALTIME_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'OpenAI-Safety-Identifier': safetyIdentifier(user.id),
      },
      body: formData,
      cache: 'no-store',
    })

    const responseBody = await openAiResponse.text()
    if (!openAiResponse.ok) {
      console.error('EMA Realtime session failed:', openAiResponse.status, responseBody.slice(0, 500))
      return NextResponse.json({ error: 'EMA AI konnte keine Sprachsitzung starten.' }, { status: 502 })
    }

    return new NextResponse(responseBody, {
      status: 200,
      headers: {
        'Content-Type': 'application/sdp',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('EMA Realtime connection failed:', error)
    return NextResponse.json({ error: 'EMA AI ist momentan nicht erreichbar.' }, { status: 502 })
  }
}
