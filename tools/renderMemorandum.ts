import fs from 'node:fs'
import path from 'node:path'

import chromium from '@sparticuz/chromium-min'
import germany from '@svg-maps/germany'
import puppeteer from 'puppeteer-core'

import type { MemorandumPdfData } from '../src/lib/pdf/memorandumPdf'
import { buildInterFontFaceCss, fileToDataUri } from '../src/lib/pdf/projektliste/loadFonts'
import { renderMemorandumHtml } from '../src/lib/pdf/projektliste/memorandumTemplate'

const root = process.cwd()
const out = path.join(root, '.tmp')
fs.mkdirSync(out, { recursive: true })

const imagePath = process.env.PROJECT_IMAGE_PATH
const projectImage = imagePath && fs.existsSync(imagePath)
  ? fileToDataUri(imagePath, imagePath.toLocaleLowerCase('en-US').endsWith('.png') ? 'image/png' : 'image/jpeg')
  : undefined

const data: MemorandumPdfData = {
  projectName: 'Gut Polßen',
  projectNumber: 'PV-2026-003',
  projectType: 'pv_dach',
  typeLabel: 'PV-Dachanlage',
  location: 'Polßen, Brandenburg',
  country: 'Deutschland',
  countryFlag: '',
  dateLabel: 'August 2026',
  status: 'RTB',
  language: 'de',
  summary: 'PV-Dachanlage in Polßen, Brandenburg, mit den vorhandenen technischen und wirtschaftlichen Projektdaten. Der Netzanschluss ist vorhanden, die Anlage befindet sich im Status RTB und ist für die Volleinspeisung vorgesehen.',
  metrics: [
    { label: 'PV-Leistung', value: '327,85 kWp' },
    { label: 'Amortisation', value: '8,9 Jahre' },
    { label: 'Kaufpreis', value: '318.877 €' },
    { label: 'Vergütung', value: '0,112 €/kWh' },
    { label: 'Spez. Ertrag', value: '973 kWh/kWp' },
  ],
  profile: [
    { label: 'Standort', value: 'Polßen, Brandenburg' },
    { label: 'Projektstatus', value: 'RTB' },
    { label: 'Netzanschluss', value: 'Vorhanden' },
    { label: 'Pachtdauer', value: '20 Jahre' },
    { label: 'Einspeiseart', value: 'Volleinspeisung' },
  ],
  highlights: [
    'Spezifischer Ertrag von 973 kWh/kWp',
    'Vergütung von 0,112 €/kWh',
    'Netzanschluss vorhanden',
    'Projektstatus: RTB',
  ],
  heroImage: '/pdf/hero-solarpark.jpg',
  projectImage: '',
  showPvEconomics: true,
  pvEconomics: {
    annualYield: 319073,
    annualRevenue: 35736,
    purchasePrice: 318877,
    tariffEurKwh: 0.112,
    roi: 11.21,
    amortisation: 8.9,
  },
}

const heroImage = fileToDataUri(path.join(root, 'public/pdf/hero-solarpark.jpg'), 'image/jpeg')
if (!heroImage) throw new Error('Hero-Bild fehlt.')

const html = renderMemorandumHtml(data, {
  germanyMap: germany,
  fontFaceCss: buildInterFontFaceCss(path.join(root, 'public/fonts/inter')),
  heroImage,
  logoWhiteDataUri: fileToDataUri(path.join(root, 'public/brand/ema-mark-white.png'), 'image/png'),
  projectImage,
})
const htmlPath = path.join(out, 'gut-polssen-memorandum.html')
const pdfPath = path.join(out, 'Gut-Polssen-Investment-Memorandum.pdf')
fs.writeFileSync(htmlPath, html)

async function main() {
  const localChrome = process.env.CHROME_PATH
  const executablePath = localChrome || await chromium.executablePath(process.env.CHROMIUM_PACK_URL ?? 'https://github.com/Sparticuz/chromium/releases/download/v149.0.0/chromium-v149.0.0-pack.x64.tar')
  const browser = await puppeteer.launch({
    executablePath,
    args: localChrome ? ['--no-sandbox', '--font-render-hinting=none'] : await puppeteer.defaultArgs({ args: chromium.args, headless: 'shell' }),
    headless: 'shell',
  })
  try {
    const page = await browser.newPage()
    await page.emulateMediaType('print')
    await page.setContent(html, { waitUntil: 'load' })
    await page.evaluate(() => document.fonts.ready)
    await page.pdf({ path: pdfPath, format: 'A4', printBackground: true, preferCSSPageSize: true, tagged: true })
    console.log(pdfPath)
  } finally {
    await browser.close()
  }
}

void main()
