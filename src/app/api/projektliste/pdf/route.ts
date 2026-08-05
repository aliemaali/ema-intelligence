import { NextResponse } from 'next/server'
import path from 'node:path'
import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium-min'

import { createClient } from '@/lib/supabase/server'
import { renderProjektlisteHtml } from '@/lib/pdf/projektliste/template'
import { mapEmaProjects, type EmaProjectRecord } from '@/lib/pdf/projektliste/mapEmaProjects'
import { buildInterFontFaceCss, fileToDataUri } from '@/lib/pdf/projektliste/loadFonts'
import type { RegionCollection } from '@/lib/pdf/projektliste/franceMap'
import regions from '@/data/geo/france-regions.json'

export const runtime = 'nodejs'
export const maxDuration = 60

/** Brotli-Paket der Chromium-Binary – Version zu @sparticuz/chromium-min passend wählen */
const CHROMIUM_PACK =
  process.env.CHROMIUM_PACK_URL ??
  'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar'

// Schrift einmal pro Lambda-Instanz einlesen, nicht pro Request
let fontFaceCssCache: string | null = null
function fontFaceCss() {
  fontFaceCssCache ??= buildInterFontFaceCss(path.join(process.cwd(), 'public/fonts/inter'))
  return fontFaceCssCache
}

type RequestBody = {
  records?: EmaProjectRecord[]
  documentId?: string
  subtitle?: string
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  }

  let body: RequestBody
  try {
    body = (await request.json()) as RequestBody
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body.' }, { status: 400 })
  }

  const records = Array.isArray(body.records) ? body.records : []
  if (records.length === 0) {
    return NextResponse.json({ error: 'Keine Projektzeilen übergeben.' }, { status: 400 })
  }

  // Ausschließlich über mapEmaProjects() gemappt – keine Ableitung von permit
  // aus permissionDate, keine erfundenen Koordinaten, keine geratene Struktur.
  const { rows, report } = mapEmaProjects(records)
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Keine verwertbaren Projektzeilen.', report }, { status: 422 })
  }

  const documentId = body.documentId || `EMA-PL-FR-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`
  const subtitle = body.subtitle || 'Frankreich – Utility Scale PV'

  const root = process.cwd()
  const html = renderProjektlisteHtml(
    {
      meta: {
        title: 'Projektliste',
        subtitle,
        documentId,
        createdAt: new Date().toISOString().slice(0, 10),
        country: 'Frankreich',
        countryCode: 'FR',
        confidentialityNote:
          'Vertraulich · ausschließlich zur Prüfung durch den benannten Empfänger · kein öffentliches Angebot',
      },
      projects: rows,
      heroImage: fileToDataUri(path.join(root, 'public/pdf/hero-solarpark.jpg'), 'image/jpeg'),
    },
    {
      regions: regions as unknown as RegionCollection,
      fontFaceCss: fontFaceCss(),
      logoDataUri: fileToDataUri(path.join(root, 'public/brand/ema-logo.png'), 'image/png'),
      logoMarkDataUri: fileToDataUri(path.join(root, 'public/brand/ema-mark.png'), 'image/png'),
      logoWhiteDataUri: fileToDataUri(path.join(root, 'public/brand/ema-mark-white.png'), 'image/png'),
    },
  )

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(CHROMIUM_PACK),
      headless: true,
    })

    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'load' })
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    })

    return new NextResponse(pdf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${documentId}.pdf"`,
        'X-Mapping-Report': JSON.stringify(report),
      },
    })
  } catch (error) {
    console.error('Projektliste PDF generation failed', error)
    return NextResponse.json({ error: 'Die PDF-Erstellung ist fehlgeschlagen.' }, { status: 500 })
  } finally {
    await browser?.close()
  }
}
