import path from 'node:path'

import chromium from '@sparticuz/chromium-min'
import germany from '@svg-maps/germany'
import { NextResponse } from 'next/server'
import puppeteer from 'puppeteer-core'
import { z } from 'zod'

import { buildInterFontFaceCss, fileToDataUri } from '@/lib/pdf/projektliste/loadFonts'
import { renderMemorandumHtml } from '@/lib/pdf/projektliste/memorandumTemplate'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

const CHROMIUM_PACK_URL = process.env.CHROMIUM_PACK_URL ?? 'https://github.com/Sparticuz/chromium/releases/download/v149.0.0/chromium-v149.0.0-pack.x64.tar'

const metricSchema = z.object({ label: z.string().trim().max(100), value: z.string().trim().max(160) })
const dataCenterDetailsSchema = z.object({
  sourceDate: z.string().trim().max(100).optional(),
  sections: z.array(z.object({
    title: z.string().trim().max(120),
    rows: z.array(metricSchema).max(12),
  })).max(6),
})
const economicsSchema = z.object({
  annualYield: z.number().finite(),
  annualRevenue: z.number().finite(),
  purchasePrice: z.number().finite(),
  tariffEurKwh: z.number().finite(),
  roi: z.number().finite(),
  amortisation: z.number().finite(),
})
const requestSchema = z.object({
  projectName: z.string().trim().min(1).max(160),
  projectNumber: z.string().trim().max(120),
  projectType: z.string().trim().max(80),
  typeLabel: z.string().trim().max(120),
  location: z.string().trim().max(200),
  country: z.string().trim().max(100),
  countryFlag: z.string().max(2_048),
  dateLabel: z.string().trim().max(100),
  status: z.string().trim().max(100),
  summary: z.string().trim().max(1_200),
  metrics: z.array(metricSchema).max(12),
  profile: z.array(metricSchema).max(16),
  highlights: z.array(z.string().trim().max(240)).max(12),
  dataCenterDetails: dataCenterDetailsSchema.optional(),
  heroImage: z.string().max(2_048),
  projectImage: z.string().max(4_096).optional(),
  language: z.enum(['de', 'en']).default('de'),
  showPvEconomics: z.boolean(),
  latitude: z.number().finite().nullish(),
  longitude: z.number().finite().nullish(),
  pvEconomics: economicsSchema.nullable(),
})

let fontFaceCssCache: string | null = null
function fontFaceCss() {
  fontFaceCssCache ??= buildInterFontFaceCss(path.join(process.cwd(), 'public/fonts/inter'))
  return fontFaceCssCache
}

function safeFilename(value: string) {
  const cleaned = value.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100)
  return cleaned || 'EMA-Expose'
}

function allowedImageHost(hostname: string) {
  const configured = process.env.NEXT_PUBLIC_SUPABASE_URL
  let configuredHostname = ''
  try { configuredHostname = configured ? new URL(configured).hostname : '' } catch { configuredHostname = '' }
  return hostname === configuredHostname || hostname.endsWith('.supabase.co') || hostname.endsWith('.supabase.in')
}

async function remoteImageToDataUri(value?: string): Promise<string | undefined> {
  if (!value || value.startsWith('/') || value.toLocaleLowerCase('en-US').endsWith('.svg')) return undefined
  let url: URL
  try { url = new URL(value) } catch { return undefined }
  if (url.protocol !== 'https:' || !allowedImageHost(url.hostname)) return undefined

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)
  try {
    const response = await fetch(url, { cache: 'no-store', redirect: 'follow', signal: controller.signal })
    if (!response.ok) return undefined
    const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLocaleLowerCase('en-US') ?? ''
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) return undefined
    const bytes = Buffer.from(await response.arrayBuffer())
    if (!bytes.length || bytes.length > 10 * 1024 * 1024) return undefined
    return `data:${contentType};base64,${bytes.toString('base64')}`
  } catch {
    return undefined
  } finally {
    clearTimeout(timeout)
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })

  let json: unknown
  try { json = await request.json() } catch { return NextResponse.json({ error: 'Ungültiger JSON-Request.' }, { status: 400 }) }
  const parsed = requestSchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'Die Exposé-Daten sind ungültig.', details: parsed.error.flatten() }, { status: 400 })

  const root = process.cwd()
  const heroImage = fileToDataUri(path.join(root, 'public/pdf/hero-solarpark.jpg'), 'image/jpeg')
  if (!heroImage) return NextResponse.json({ error: 'Das EMA-Hero-Bild fehlt.' }, { status: 500 })
  const uploadedProjectImage = await remoteImageToDataUri(parsed.data.projectImage)
  const defaultDataCenterImage = parsed.data.projectType === 'rechenzentrum'
    ? fileToDataUri(path.join(root, 'public/hero-datacenter.webp'), 'image/webp')
    : undefined
  const projectImage = uploadedProjectImage ?? defaultDataCenterImage
  const html = renderMemorandumHtml(parsed.data, {
    germanyMap: germany,
    fontFaceCss: fontFaceCss(),
    heroImage,
    logoWhiteDataUri: fileToDataUri(path.join(root, 'public/brand/ema-mark-white.png'), 'image/png'),
    projectImage,
  })

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null
  try {
    chromium.setGraphicsMode = false
    const executablePath = await chromium.executablePath(CHROMIUM_PACK_URL)
    browser = await puppeteer.launch({ args: await puppeteer.defaultArgs({ args: chromium.args, headless: 'shell' }), executablePath, headless: 'shell' })
    const page = await browser.newPage()
    await page.emulateMediaType('print')
    await page.setContent(html, { waitUntil: 'load', timeout: 45_000 })
    await page.evaluate(() => document.fonts.ready)
    const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true, tagged: true })
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeFilename(`${parsed.data.projectNumber}-${parsed.data.projectName}`)}.pdf"`,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
        'X-EMA-Project-Image': projectImage ? 'embedded' : 'not-available',
      },
    })
  } catch (error) {
    console.error('Exposé-PDF konnte nicht erzeugt werden:', error)
    return NextResponse.json({ error: 'Das Exposé konnte nicht als PDF erzeugt werden.' }, { status: 500 })
  } finally {
    await browser?.close().catch(() => undefined)
  }
}
