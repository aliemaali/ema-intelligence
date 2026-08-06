import path from 'node:path'

import chromium from '@sparticuz/chromium-min'
import { NextResponse } from 'next/server'
import puppeteer from 'puppeteer-core'
import { z } from 'zod'

import regions from '@/data/geo/france-regions.json'
import type { RegionCollection } from '@/lib/pdf/projektliste/franceMap'
import { buildInterFontFaceCss, fileToDataUri } from '@/lib/pdf/projektliste/loadFonts'
import { mapEmaProjects } from '@/lib/pdf/projektliste/mapEmaProjects'
import { renderProjektlisteHtml } from '@/lib/pdf/projektliste/templateCre'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

const CHROMIUM_PACK_URL = process.env.CHROMIUM_PACK_URL ?? 'https://github.com/Sparticuz/chromium/releases/download/v149.0.0/chromium-v149.0.0-pack.x64.tar'
const optionalText = z.string().trim().max(500).nullish()
const optionalNumber = z.union([z.number(), z.string().trim().max(100)]).nullish()

const projectRecordSchema = z.object({
  externalNumber: z.union([z.string(), z.number()]).nullish(),
  region: optionalText,
  projectName: optionalText,
  pvKwp: optionalNumber,
  gridDistanceKm: optionalNumber,
  structure: optionalText,
  techType: optionalText,
  permissionDate: optionalText,
  commissioning: optionalText,
  securedLandHa: optionalNumber,
  specificYield: optionalNumber,
})

const requestSchema = z.object({
  records: z.array(projectRecordSchema).min(1).max(2_000),
  documentId: z.string().trim().min(1).max(120).optional(),
  subtitle: z.string().trim().min(1).max(240).optional(),
  language: z.enum(['de', 'en']).default('de'),
  country: z.string().trim().min(1).max(100).default('Frankreich'),
  countryCode: z.string().trim().min(2).max(3).default('FR'),
})

let fontFaceCssCache: string | null = null
function getFontFaceCss() {
  fontFaceCssCache ??= buildInterFontFaceCss(path.join(process.cwd(), 'public/fonts/inter'))
  return fontFaceCssCache
}
function safeFilename(value: string) {
  const cleaned = value.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100)
  return cleaned || 'EMA-Projektliste'
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })

  let json: unknown
  try { json = await request.json() } catch { return NextResponse.json({ error: 'Ungültiger JSON-Request.' }, { status: 400 }) }
  const parsed = requestSchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'Die übermittelten Projektdaten sind ungültig.', details: parsed.error.flatten() }, { status: 400 })

  const { rows, report } = mapEmaProjects(parsed.data.records)
  if (rows.length === 0) return NextResponse.json({ error: 'Keine verwertbaren Projektzeilen.', report }, { status: 422 })

  const documentId = parsed.data.documentId ?? `EMA-PL-FR-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`
  const language = parsed.data.language
  const country = language === 'en' && parsed.data.country === 'Frankreich' ? 'France' : parsed.data.country
  const subtitle = parsed.data.subtitle ?? `${country} – Utility Scale PV`
  const root = process.cwd()
  const heroImage = fileToDataUri(path.join(root, 'public/pdf/hero-solarpark.jpg'), 'image/jpeg')
  const html = renderProjektlisteHtml({
    meta: { language, title: language === 'de' ? 'Projektliste' : 'Project List', subtitle, documentId, createdAt: new Date().toISOString().slice(0, 10), country, countryCode: parsed.data.countryCode.toUpperCase(), confidentialityNote: language === 'de' ? 'Vertraulich · ausschließlich zur Prüfung durch den benannten Empfänger · kein öffentliches Angebot' : 'Confidential · solely for review by the named recipient · not a public offer' },
    projects: rows,
    heroImage,
    creHeroImage: heroImage,
  }, {
    regions: regions as unknown as RegionCollection,
    fontFaceCss: getFontFaceCss(),
    logoDataUri: fileToDataUri(path.join(root, 'public/brand/ema-logo.png'), 'image/png'),
    logoMarkDataUri: fileToDataUri(path.join(root, 'public/brand/ema-mark.png'), 'image/png'),
    logoWhiteDataUri: fileToDataUri(path.join(root, 'public/brand/ema-mark-white.png'), 'image/png'),
  })

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null
  try {
    chromium.setGraphicsMode = false
    const executablePath = await chromium.executablePath(CHROMIUM_PACK_URL)
    browser = await puppeteer.launch({ args: await puppeteer.defaultArgs({ args: chromium.args, headless: 'shell' }), executablePath, headless: 'shell' })
    const page = await browser.newPage()
    await page.emulateMediaType('print')
    await page.setContent(html, { waitUntil: 'load', timeout: 45_000 })
    const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true, tagged: true })
    return new NextResponse(Buffer.from(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${safeFilename(documentId)}.pdf"`, 'Cache-Control': 'private, no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' } })
  } catch (error) {
    console.error('Projektlisten-PDF konnte nicht erzeugt werden:', error)
    return NextResponse.json({ error: 'Die Projektliste konnte nicht als PDF erzeugt werden.' }, { status: 500 })
  } finally { await browser?.close().catch(() => undefined) }
}

