import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEmaVoiceUserName } from '@/lib/ema/voiceAccess'

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

const EMA_INSTRUCTIONS = `Du bist EMA, der KI-Assistent von EMA Intelligence.
Sprich auf Deutsch, außer der Nutzer wechselt bewusst die Sprache.
Deine Stimme klingt natürlich, warm, freundlich, weiblich und professionell. Sprich flüssig und menschlich, nicht abgehackt oder synthetisch.
## Antwortlänge
- STANDARD: Antworte mit genau einem kurzen Satz, idealerweise 5 bis 15 Wörter.
- Bei Bestätigungen oder Ja/Nein-Antworten: höchstens 3 bis 8 Wörter.
- Nach einem Werkzeugaufruf: Nenne nur das gefragte Ergebnis und keine zusätzlichen Daten.
- Wenn ein Werkzeug eine Tabelle oder Kennzahlen liefert, sage kurz, dass du das Ergebnis auf dem Bildschirm anzeigst.
- Bei Listen: Nenne höchstens 3 relevante Einträge und frage kurz, ob du weitere nennen sollst.
- Stelle höchstens eine Rückfrage auf einmal.
- Keine Vorrede, keine Wiederholung der Nutzerfrage und keine unnötige Zusammenfassung.
- Nur wenn der Nutzer ausdrücklich nach Details, einer Erklärung oder einer vollständigen Liste fragt, darfst du ausführlicher antworten.
Wenn dir Informationen fehlen, frage gezielt nach statt etwas zu erfinden.
Behaupte niemals, dass du eine Aktion in der EMA-App ausgeführt hast, wenn dir dafür kein Werkzeug zur Verfügung steht.
Wenn der Nutzer einen EMA-Bereich öffnen möchte, nutze das Werkzeug open_ema_area.
Für aktuelle Fragen zu Portfolio, Projekten, Investoren, Partnern oder Dokumenten nutze immer die passenden EMA-Werkzeuge und erfinde keine Live-Daten aus dem Gespräch.
Bei Fragen zu einzelnen Projekten innerhalb einer gespeicherten Länder-Projektliste – insbesondere der Frankreich-Liste – nutze search_ema_country_list_projects statt nur die aggregierte Länderübersicht.
Bei Dokumenten darfst du Inhalte nur wiedergeben, wenn das Werkzeug content_indexed=true bzw. extracted_content liefert. Nicht indexierte PDFs nicht aus Dateiname oder Typ interpretieren.
Kontakt-E-Mail oder Telefonnummer eines Investors oder Partners nur laden, wenn der Nutzer ausdrücklich nach Kontaktdaten fragt.
Kritische Aktionen wie Löschen, Versenden oder verbindliche Änderungen dürfen nie ohne ausdrückliche Bestätigung ausgeführt werden.
Wenn der Nutzer ein neues Projekt anlegen möchte, frage nacheinander nur nach fehlendem Projektname und Projekttyp. Weitere Angaben sind optional und werden nur übernommen, wenn der Nutzer sie selbst nennt. Sobald Name und Typ klar sind, nutze prepare_create_project. Rufe confirm_ema_action niemals in derselben Nutzerrunde wie prepare_create_project auf. Erst wenn der Nutzer in einer neuen Sprechrunde eindeutig mit Ja, Bestätigen, Mach das oder sinngleich zustimmt, nutze confirm_ema_action. Bei Ablehnung nutze cancel_ema_action.
Wenn der Nutzer ein Exposé erstellen möchte, identifiziere das Projekt und nutze prepare_project_expose. Bestätige auch hier nie in derselben Nutzerrunde. Erst nach eindeutiger Zustimmung in einer neuen Sprechrunde nutze confirm_ema_action. Bei Ablehnung nutze cancel_ema_action.
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

  const emaVoiceUserName = getEmaVoiceUserName(user.email)
  if (!emaVoiceUserName) {
    return NextResponse.json({ error: 'EMA AI ist für dieses Benutzerkonto nicht freigeschaltet.' }, { status: 403 })
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
    model: 'gpt-realtime-2.1',
    reasoning: {
      effort: 'medium',
    },
    output_modalities: ['audio'],
    instructions: `${EMA_INSTRUCTIONS}\nDer aktuell eingeloggte Nutzer heißt ${emaVoiceUserName}. Sprich die Person bei passenden Gelegenheiten natürlich mit „${emaVoiceUserName}“ an.`,
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
      {
        type: 'function',
        name: 'prepare_create_project',
        description: 'Bereitet das Anlegen eines neuen EMA-Projekts vor, führt aber noch keine Änderung aus. Nur aufrufen, wenn Projektname und Projekttyp feststehen.',
        parameters: {
          type: 'object',
          properties: {
            project_name: { type: 'string', description: 'Name des neuen Projekts.' },
            project_type: {
              type: 'string',
              enum: ['pv_freiflaeche', 'pv_dach', 'bess', 'hybrid', 'wind', 'rechenzentrum', 'sonstiges'],
              description: 'Projekttyp.',
            },
            location_country: { type: 'string', description: 'Optionales Land. Standard ist Deutschland.' },
            location_state: { type: 'string', description: 'Optionales Bundesland oder Region.' },
            location_city: { type: 'string', description: 'Optionaler Ort.' },
            pv_kwp: { type: 'number', minimum: 0, description: 'Optionale PV-Leistung in kWp.' },
            bess_mw: { type: 'number', minimum: 0, description: 'Optionale BESS-Leistung in MW.' },
            bess_mwh: { type: 'number', minimum: 0, description: 'Optionale BESS-Energie in MWh.' },
            bess_duration_h: { type: 'number', minimum: 0, description: 'Optionale Speicherdauer in Stunden.' },
            data_center_grid_mw: { type: 'number', minimum: 0, description: 'Optionale Netzanschlussleistung eines Rechenzentrums in MW.' },
            data_center_it_mw: { type: 'number', minimum: 0, description: 'Optionale IT-Leistung eines Rechenzentrums in MW.' },
            land_area_sqm: { type: 'number', minimum: 0, description: 'Optionale Grundstücksfläche in Quadratmetern.' },
            investment_volume_eur: { type: 'number', minimum: 0, description: 'Optionales Investitionsvolumen in Euro.' },
            lease_term_years: { type: 'number', minimum: 0, description: 'Optionale Pachtdauer in Jahren.' },
            contact_name: { type: 'string', description: 'Optionaler Ansprechpartner.' },
            contact_email: { type: 'string', description: 'Optionale Kontakt-E-Mail.' },
            contact_phone: { type: 'string', description: 'Optionale Telefonnummer.' },
            notes: { type: 'string', description: 'Optionale Notiz.' },
          },
          required: ['project_name', 'project_type'],
          additionalProperties: false,
        },
      },
      {
        type: 'function',
        name: 'prepare_project_expose',
        description: 'Bereitet das Öffnen des vorhandenen EMA-Exposés für ein Projekt vor. Führt erst nach separater Bestätigung aus.',
        parameters: {
          type: 'object',
          properties: {
            project_query: { type: 'string', description: 'Projektname, Projektnummer oder Projekt-ID.' },
          },
          required: ['project_query'],
          additionalProperties: false,
        },
      },
      {
        type: 'function',
        name: 'confirm_ema_action',
        description: 'Bestätigt genau die zuvor vorbereitete EMA-Aktion. Nur nach einer eindeutigen Zustimmung des Nutzers in einer neuen Sprechrunde aufrufen.',
        parameters: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
      },
      {
        type: 'function',
        name: 'cancel_ema_action',
        description: 'Verwirft die zuvor vorbereitete EMA-Aktion, wenn der Nutzer sie ablehnt oder abbricht.',
        parameters: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
      },
      {
        type: 'function',
        name: 'get_portfolio_summary',
        description: 'Liest die aktuellen EMA-Portfoliozahlen live aus der Datenbank. Für Fragen nach Anzahl, Gesamtleistung, Ländern, PV, BESS oder Rechenzentren verwenden.',
        parameters: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
      },
      {
        type: 'function',
        name: 'search_ema_projects',
        description: 'Durchsucht die für den angemeldeten Nutzer sichtbaren EMA-Projekte und Länderübersichten. Für Fragen nach Projekten in einem Land, Status, Typ, Ort, Nummer oder Namen verwenden.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Freie Suche nach Projektname, Nummer, Ort, Land, Typ oder Status.' },
            country: { type: 'string', description: 'Optionaler Länderfilter, z. B. Deutschland oder Frankreich.' },
            project_type: {
              type: 'string',
              enum: ['pv_freiflaeche', 'pv_dach', 'bess', 'hybrid', 'wind', 'rechenzentrum', 'sonstiges'],
              description: 'Optionaler Projekttyp.',
            },
            status: { type: 'string', description: 'Optionaler Projekt- oder Entwicklungsstatus, z. B. rtb, planung, dd oder closing.' },
            limit: { type: 'integer', minimum: 1, maximum: 20, description: 'Maximale Anzahl einzelner Treffer.' },
          },
          additionalProperties: false,
        },
      },
      {
        type: 'function',
        name: 'search_ema_country_list_projects',
        description: 'Durchsucht die einzelnen Projektzeilen einer gespeicherten EMA-Länder-Projektliste. Insbesondere für Fragen zu den 232 Frankreich-Projekten, Projektnummern, Départements, Leistung, Netzdistanz, Struktur, Genehmigung, Inbetriebnahme, Fläche oder PVSYST verwenden.',
        parameters: {
          type: 'object',
          properties: {
            country: { type: 'string', description: 'Land der gespeicherten Projektliste, z. B. Frankreich.' },
            query: { type: 'string', description: 'Optionale freie Suche nach Projektnummer, Projektname, Département/Region, Struktur oder Datum.' },
            region: { type: 'string', description: 'Optionaler Département-/Regionsfilter.' },
            min_pv_kwp: { type: 'number', description: 'Optionale minimale PV-Leistung in kWp.' },
            max_pv_kwp: { type: 'number', description: 'Optionale maximale PV-Leistung in kWp.' },
            limit: { type: 'integer', minimum: 1, maximum: 20, description: 'Maximale Anzahl Treffer.' },
          },
          required: ['country'],
          additionalProperties: false,
        },
      },
      {
        type: 'function',
        name: 'get_project_details',
        description: 'Liest die aktuellen Stammdaten eines konkreten EMA-Projekts, einschließlich Standort, Technik, Entwicklungsstatus und erfasster Wirtschaftlichkeits-/Projektdaten.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Projektname, Projektnummer oder zuvor gefundene Projekt-ID.' },
          },
          required: ['query'],
          additionalProperties: false,
        },
      },
      {
        type: 'function',
        name: 'search_ema_investors',
        description: 'Durchsucht die aktuell sichtbaren Investoren nach Firma, Kontaktperson, Land, Fokus, Status oder Suchprofil. Liefert bewusst keine E-Mail oder Telefonnummer.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Freie Suche nach Investor, Firma, Kontaktperson, Land, Fokus oder Status.' },
            focus: { type: 'string', description: 'Optionaler Fokusfilter, z. B. PV, BESS oder Rechenzentren.' },
            active_only: { type: 'boolean', description: 'Nur aktive Investoren zurückgeben.' },
            limit: { type: 'integer', minimum: 1, maximum: 20 },
          },
          additionalProperties: false,
        },
      },
      {
        type: 'function',
        name: 'get_investor_details',
        description: 'Liest Details zu einem konkreten Investor. Kontaktdaten nur anfordern, wenn der Nutzer ausdrücklich nach E-Mail oder Telefonnummer fragt.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Investor-ID, Firma oder Kontaktperson.' },
            include_contact_details: { type: 'boolean', description: 'Nur true, wenn ausdrücklich E-Mail oder Telefonnummer verlangt wurde.' },
          },
          required: ['query'],
          additionalProperties: false,
        },
      },
      {
        type: 'function',
        name: 'search_ema_partners',
        description: 'Durchsucht die aktuell sichtbaren EMA-Partner nach Name, Firma, Kategorie oder Ort. Liefert bewusst keine E-Mail oder Telefonnummer.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Freie Suche nach Partner, Firma, Kategorie oder Ort.' },
            category: { type: 'string', description: 'Optionale Partnerkategorie.' },
            active_only: { type: 'boolean', description: 'Nur aktive Partner zurückgeben.' },
            limit: { type: 'integer', minimum: 1, maximum: 20 },
          },
          additionalProperties: false,
        },
      },
      {
        type: 'function',
        name: 'get_partner_details',
        description: 'Liest Details zu einem konkreten Partner. Kontaktdaten nur anfordern, wenn der Nutzer ausdrücklich nach E-Mail oder Telefonnummer fragt.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Partner-ID, Name oder Firma.' },
            include_contact_details: { type: 'boolean', description: 'Nur true, wenn ausdrücklich E-Mail oder Telefonnummer verlangt wurde.' },
          },
          required: ['query'],
          additionalProperties: false,
        },
      },
      {
        type: 'function',
        name: 'search_ema_documents',
        description: 'Durchsucht die für den Nutzer sichtbaren Projektdokumente nach Projekt, Dokumentname oder Typ und zeigt, ob der Dateiinhalt bereits indexiert ist.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Freie Suche nach Dokumentname, Dateiname, Typ oder Projekt.' },
            project: { type: 'string', description: 'Optionaler Projektname, Projektnummer oder Projekt-ID.' },
            document_type: { type: 'string', description: 'Optionaler Dokumenttyp, z. B. expose, netzanschluss oder gutachten.' },
            limit: { type: 'integer', minimum: 1, maximum: 20 },
          },
          additionalProperties: false,
        },
      },
      {
        type: 'function',
        name: 'get_document_details',
        description: 'Liest Metadaten und – nur falls bereits sicher indexiert – extrahierte Inhalte eines konkreten Projektdokuments.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Dokument-ID, Dokumentname oder Dateiname.' },
          },
          required: ['query'],
          additionalProperties: false,
        },
      },
    ],
    tool_choice: 'auto',
    audio: {
      input: {
        noise_reduction: {
          type: 'near_field',
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.7,
          prefix_padding_ms: 300,
          silence_duration_ms: 1000,
          create_response: true,
          interrupt_response: true,
        },
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
