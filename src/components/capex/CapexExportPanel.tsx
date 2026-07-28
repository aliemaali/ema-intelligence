'use client'

import { useState } from 'react'
import { Download, Mail, Save } from 'lucide-react'
import type { CapexCalcResult, CapexProject } from '@/lib/types/capex.types'
import { createClient } from '@/lib/supabase/client'
import { createDocumentRecord } from '@/lib/actions/document.actions'

interface CapexExportPanelProps {
  project: CapexProject
  calc: CapexCalcResult
}

type ProjectVariant = {
  label: string
  powerUnit: string
  specificUnit: string
  symbol: 'pv' | 'bess' | 'wind' | 'data'
}

const VARIANTS: Record<string, ProjectVariant> = {
  pv: { label: 'PHOTOVOLTAIK', powerUnit: 'kWp', specificUnit: 'EUR/kWp', symbol: 'pv' },
  bess: { label: 'BATTERIESPEICHER (BESS)', powerUnit: 'MWh', specificUnit: 'EUR/kWh', symbol: 'bess' },
  wind: { label: 'WINDKRAFT', powerUnit: 'MW', specificUnit: 'EUR/kW', symbol: 'wind' },
  data: { label: 'RECHENZENTRUM', powerUnit: 'MW IT-Last', specificUnit: 'EUR/kW', symbol: 'data' },
}

const euro0 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 })
const number1 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const number2 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function safeName(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9äöüÄÖÜß_-]+/g, '_').replace(/^_+|_+$/g, '') || 'Projekt'
}

function inferVariant(project: CapexProject): ProjectVariant {
  const value = `${project.projektname} ${project.calculationName}`.toLowerCase()
  if (value.includes('bess') || value.includes('batter') || value.includes('speicher')) return VARIANTS.bess
  if (value.includes('wind')) return VARIANTS.wind
  if (value.includes('rechenzentrum') || value.includes('data center') || value.includes('datacenter')) return VARIANTS.data
  return VARIANTS.pv
}

function isPresent(value: unknown): boolean {
  return value !== null && value !== undefined && value !== '' && Number(value) !== 0
}

async function createPdf(project: CapexProject, calc: CapexCalcResult) {
  const { default: jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const variant = inferVariant(project)
  const navy = [31, 42, 68] as const
  const navyLight = [44, 58, 87] as const
  const green = [92, 184, 0] as const
  const grey = [107, 116, 132] as const
  const light = [244, 246, 249] as const
  const line = [221, 226, 234] as const
  const margin = 18
  const contentW = 174
  const today = new Date()
  const dateDisplay = today.toLocaleDateString('de-DE')

  const money = (value: number) => `${euro0.format(value)} EUR`
  const pct = (value: number) => `${number1.format(value)} %`
  const years = (value: number | null) => value == null ? null : `${number1.format(value)} Jahre`
  const section = (title: string, y: number) => {
    doc.setDrawColor(...green); doc.setLineWidth(0.8); doc.line(margin, y, margin + 14, y)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...navy)
    doc.text(title.toUpperCase(), margin + 18, y + 1.2)
  }
  const footer = (page: number, pages: number) => {
    doc.setDrawColor(...line); doc.setLineWidth(0.2); doc.line(margin, 281, 192, 281)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8); doc.setTextColor(...grey)
    doc.text('EMA Enterprise GmbH · Gabriel-von-Seidl-Str. 56 · 67550 Worms · unluer@ema-enterprise.de', margin, 286)
    doc.text('Vertraulich. Berechnung auf Basis der eingegebenen Annahmen – keine Anlageberatung.', margin, 290)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...navy)
    doc.text(`Seite ${page} / ${pages}`, 192, 288, { align: 'right' })
  }
  const drawSymbol = (x: number, y: number) => {
    doc.setDrawColor(...green); doc.setLineWidth(0.7)
    if (variant.symbol === 'pv') {
      doc.rect(x, y, 8, 5); doc.line(x + 2.7, y, x + 2.7, y + 5); doc.line(x + 5.4, y, x + 5.4, y + 5); doc.line(x, y + 2.5, x + 8, y + 2.5)
    } else if (variant.symbol === 'bess') {
      doc.rect(x, y, 7, 5); doc.line(x + 7, y + 1.6, x + 8, y + 1.6); doc.line(x + 7, y + 3.4, x + 8, y + 3.4); doc.line(x + 2, y + 2.5, x + 5, y + 2.5)
    } else if (variant.symbol === 'wind') {
      doc.circle(x + 4, y + 2.5, 0.8); doc.line(x + 4, y + 3.3, x + 4, y + 7); doc.line(x + 4, y + 2.5, x + 1, y); doc.line(x + 4, y + 2.5, x + 7.5, y + 1); doc.line(x + 4, y + 2.5, x + 3, y + 6)
    } else {
      doc.rect(x, y, 8, 6); doc.line(x + 1.5, y + 2, x + 6.5, y + 2); doc.line(x + 1.5, y + 4, x + 6.5, y + 4)
    }
  }

  doc.setFillColor(...navy); doc.rect(0, 0, 210, 50, 'F')
  doc.setFillColor(...green); doc.rect(0, 50, 210, 1.4, 'F')
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
  doc.text('EMA', margin, 18)
  doc.setFontSize(7); doc.setTextColor(169, 179, 198); doc.text('ENTERPRISE GMBH', margin + 16, 18)
  doc.text('EMA INTELLIGENCE', 192, 18, { align: 'right' })
  doc.setTextColor(255, 255, 255); doc.setFontSize(22); doc.text('CAPEX-KALKULATION', margin, 32)
  doc.setTextColor(...green); doc.setFontSize(11); doc.setFont('helvetica', 'normal')
  const title = project.projektname || project.calculationName
  doc.text(title.length > 52 ? `${title.slice(0, 49)}…` : title, margin, 40)
  doc.setFillColor(...navyLight); doc.roundedRect(148, 30, 44, 11, 1.5, 1.5, 'F')
  drawSymbol(151, 33)
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(6.8)
  doc.text(variant.label, 161, 36.8)

  section('Projektdaten', 64)
  const projectFields = [
    ['Kalkulation', project.calculationName],
    ['Projekttyp', variant.label],
    ['Erstellungsdatum', dateDisplay],
    ['Anlagenleistung', isPresent(project.anlagenleistungKwp) ? `${number2.format(project.anlagenleistungKwp)} ${variant.powerUnit}` : null],
    ['Spezifischer Ertrag', isPresent(project.spezErtragKwhKwp) ? `${number2.format(project.spezErtragKwhKwp)} kWh/kWp` : null],
    ['Strompreis', isPresent(project.strompreisEurKwh) ? `${number2.format(project.strompreisEurKwh * 100)} ct/kWh` : null],
    ['Pachtdauer', isPresent(project.pachtdauerJahre) ? `${number1.format(project.pachtdauerJahre)} Jahre` : null],
  ].filter((item): item is [string, string] => Boolean(item[1]))
  projectFields.forEach(([labelText, value], index) => {
    const col = index % 4
    const row = Math.floor(index / 4)
    const x = margin + col * 43.5
    const y = 72 + row * 13
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.6); doc.setTextColor(...grey); doc.text(labelText.toUpperCase(), x, y)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.2); doc.setTextColor(...navy)
    const short = value.length > 24 ? `${value.slice(0, 21)}…` : value
    doc.text(short, x, y + 4.6)
  })

  section('Kennzahlen', 104)
  const kpis = [
    ['GESAMT-CAPEX', money(calc.totalCapex), 'brutto Investitionsvolumen'],
    ['SPEZ. INVESTITIONSKOSTEN', `${number2.format(calc.specificCapex)} ${variant.specificUnit}`, `bezogen auf ${number2.format(project.anlagenleistungKwp)} ${variant.powerUnit}`],
    ['IRR (20 JAHRE)', pct(calc.irr * 100), ''],
    ['NPV', money(calc.npv), `bei WACC ${number1.format(project.waccPct)} %`],
    ['STATISCHE AMORTISATION', years(calc.staticPayback), 'CAPEX / Cashflow Jahr 1'],
    ['DYNAMISCHE AMORTISATION', years(calc.dynPayback), 'diskontiert mit WACC'],
  ].filter((item): item is [string, string, string] => Boolean(item[1]))
  kpis.forEach(([labelText, value, sub], index) => {
    const col = index % 3
    const row = Math.floor(index / 3)
    const x = margin + col * 59.7
    const y = 113 + row * 34
    const inverted = index === 0
    doc.setFillColor(...(inverted ? navy : light)); doc.rect(x, y, 54.7, 29, 'F')
    doc.setFillColor(...green); doc.rect(x, y, 1.6, 29, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.8); doc.setTextColor(...(inverted ? [169, 179, 198] as const : grey)); doc.text(labelText, x + 5, y + 7)
    doc.setFontSize(15); doc.setTextColor(...(inverted ? [255, 255, 255] as const : navy)); doc.text(value, x + 5, y + 17)
    if (sub) { doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...(inverted ? green : grey)); doc.text(sub, x + 5, y + 25) }
  })

  section('Kumulierter Cashflow', 188)
  const values = calc.years.slice(0, 21).map((row) => row.cum)
  const chartX = 38, chartY = 198, chartW = 154, chartH = 63
  const min = Math.min(...values, 0), max = Math.max(...values, 1), span = Math.max(max - min, 1)
  const mapY = (value: number) => chartY + chartH - ((value - min) / span) * chartH
  for (let index = 0; index < 5; index += 1) {
    const y = chartY + (index / 4) * chartH
    const value = max - (index / 4) * span
    doc.setDrawColor(237, 240, 245); doc.setLineWidth(0.2); doc.line(chartX, y, chartX + chartW, y)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.4); doc.setTextColor(...grey); doc.text(`${number1.format(value / 1_000_000)} Mio.`, chartX - 2.5, y + 1.8, { align: 'right' })
  }
  const zeroY = mapY(0)
  doc.setDrawColor(...navy); doc.setLineWidth(0.3); doc.line(chartX, zeroY, chartX + chartW, zeroY)
  doc.setDrawColor(...green); doc.setLineWidth(0.65)
  values.forEach((value, index) => {
    if (index === 0) return
    const x1 = chartX + ((index - 1) / Math.max(values.length - 1, 1)) * chartW
    const x2 = chartX + (index / Math.max(values.length - 1, 1)) * chartW
    doc.line(x1, mapY(values[index - 1]), x2, mapY(value))
  })
  const crossing = values.findIndex((value, index) => index > 0 && value >= 0 && values[index - 1] < 0)
  if (crossing > 0) {
    const prev = values[crossing - 1]
    const current = values[crossing]
    const fraction = Math.abs(prev) / Math.max(current - prev, 1)
    const breakEven = crossing - 1 + fraction
    const x = chartX + (breakEven / Math.max(values.length - 1, 1)) * chartW
    doc.setLineDashPattern([2, 2], 0); doc.setDrawColor(...navy); doc.line(x, chartY + chartH, x, zeroY); doc.setLineDashPattern([], 0)
    doc.setFillColor(...navy); doc.circle(x, zeroY, 1.5, 'F'); doc.setFillColor(255, 255, 255); doc.circle(x, zeroY, 0.65, 'F')
    const label = `Break-even Jahr ${number1.format(breakEven)} (nominal)`
    doc.setFillColor(...navy); doc.roundedRect(Math.min(x - 21, 149), zeroY - 9, 43, 6, 1, 1, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.2); doc.setTextColor(255, 255, 255); doc.text(label, Math.min(x + 0.5, 170), zeroY - 5, { align: 'center' })
  }
  for (let year = 0; year <= 20; year += 2) {
    const x = chartX + (year / 20) * chartW
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.4); doc.setTextColor(...grey); doc.text(`J${year}`, x, chartY + chartH + 5, { align: 'center' })
  }
  doc.text('Betriebsjahr, nominal', chartX + chartW / 2, chartY + chartH + 9.5, { align: 'center' })

  doc.addPage()
  doc.setFillColor(...navy); doc.rect(0, 0, 210, 22, 'F'); doc.setFillColor(...green); doc.rect(0, 22, 210, 1, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(255, 255, 255); doc.text('Kalkulation und Wirtschaftlichkeit', margin, 14.2)
  drawSymbol(174, 8)
  doc.setFontSize(8); doc.text('EMA', 192, 13.5, { align: 'right' })
  section('CAPEX-Positionen', 36)
  let y = 46
  doc.setFillColor(...navy); doc.rect(margin, y, contentW, 7.5, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.2); doc.setTextColor(255, 255, 255)
  doc.text('POSITION', margin + 3, y + 5); doc.text('KOSTEN (EUR)', 126, y + 5, { align: 'right' }); doc.text(variant.specificUnit.toUpperCase(), 160, y + 5, { align: 'right' }); doc.text('ANTEIL', 189, y + 5, { align: 'right' })
  y += 7.5
  const positions = calc.positions.filter((item) => item.cost > 0)
  positions.forEach((position, index) => {
    if (index % 2 === 1) { doc.setFillColor(...light); doc.rect(margin, y, contentW, 9, 'F') }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...navy); doc.text(position.name, margin + 3, y + 5.8)
    doc.text(euro0.format(position.cost), 126, y + 5.8, { align: 'right' })
    doc.setTextColor(...grey); doc.text(number2.format(position.eurPerKwp), 160, y + 5.8, { align: 'right' })
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.4); doc.setTextColor(...navy); doc.text(pct(position.share * 100), 189, y + 5.8, { align: 'right' })
    doc.setDrawColor(...line); doc.setLineWidth(0.15); doc.line(margin, y + 9, 192, y + 9)
    y += 9
  })
  doc.setFillColor(...navy); doc.rect(margin, y, contentW, 13, 'F'); doc.setFillColor(...green); doc.rect(margin, y, 1.6, 13, 'F')
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text('GESAMT-CAPEX', margin + 5, y + 8.2)
  doc.setFontSize(12); doc.text(euro0.format(calc.totalCapex), 126, y + 8.2, { align: 'right' })
  doc.setTextColor(...green); doc.setFontSize(9); doc.text(`${number2.format(calc.specificCapex)} ${variant.specificUnit}`, 166, y + 8.2, { align: 'right' })
  doc.setTextColor(255, 255, 255); doc.text('100,0 %', 189, y + 8.2, { align: 'right' })
  y += 29

  const economics: [string, string | null][] = [
    ['Ertrag Jahr 1', isPresent(calc.energyY1) ? `${euro0.format(calc.energyY1)} kWh` : null],
    ['Erlös Jahr 1', isPresent(calc.revenueY1) ? money(calc.revenueY1) : null],
    ['OPEX Jahr 1', isPresent(calc.opexY1) ? money(calc.opexY1) : null],
    ['Netto-Cashflow Jahr 1', isPresent(calc.ncfY1) ? money(calc.ncfY1) : null],
    ['IRR (20 Jahre)', pct(calc.irr * 100)],
    ['NPV', money(calc.npv)],
    ['Statische Amortisation', years(calc.staticPayback)],
    ['Dynamische Amortisation', years(calc.dynPayback)],
    ['WACC', pct(project.waccPct)],
    ['Strompreissteigerung', pct(project.strompreissteigerungPct)],
  ]
  const visibleEconomics = economics.filter((item): item is [string, string] => Boolean(item[1]))
  if (visibleEconomics.length) {
    section('Wirtschaftlichkeit', y)
    y += 9
    visibleEconomics.forEach(([labelText, value], index) => {
      const col = index % 2
      const row = Math.floor(index / 2)
      const x = margin + col * 90
      const rowY = y + row * 8.6
      if (row % 2 === 1 && col === 0) { doc.setFillColor(...light); doc.rect(margin, rowY - 2.3, contentW, 8.6, 'F') }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.6); doc.setTextColor(...grey); doc.text(labelText, x + 2, rowY + 3)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.4); doc.setTextColor(...navy); doc.text(value, x + 84, rowY + 3, { align: 'right' })
    })
  }

  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page += 1) { doc.setPage(page); footer(page, pages) }
  doc.setProperties({ title: `CAPEX-Kalkulation ${title}`, author: 'EMA Enterprise GmbH' })
  return doc.output('blob')
}

async function blobToBase64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  return btoa(binary)
}

export function CapexExportPanel({ project, calc }: CapexExportPanelProps) {
  const [recipient, setRecipient] = useState('')
  const [subject, setSubject] = useState(`CAPEX-Kalkulation – ${project.projektname || project.calculationName}`)
  const [message, setMessage] = useState('Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie die CAPEX-Kalkulation zum Projekt.\n\nMit freundlichen Grüßen\nEMA Enterprise GmbH')
  const [busy, setBusy] = useState<'download' | 'save' | 'send' | null>(null)
  const [status, setStatus] = useState('')
  const supabase = createClient()
  const date = new Date().toISOString().slice(0, 10)
  const fileName = `EMA_CAPEX_${safeName(project.projektname || project.calculationName)}_${date}.pdf`

  async function savePdf(blob: Blob) {
    if (!project.projectId) throw new Error('Kein Projekt zugeordnet.')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Nicht angemeldet.')
    const path = `${user.id}/${project.projectId}/${Date.now()}_${fileName}`
    const { error: uploadError } = await supabase.storage.from('project-documents').upload(path, blob, { contentType: 'application/pdf', cacheControl: '3600' })
    if (uploadError) throw uploadError
    const result = await createDocumentRecord({ projectId: project.projectId, displayName: `CAPEX-Kalkulation – ${project.projektname}`, fileName, filePath: path, fileSizeBytes: blob.size, mimeType: 'application/pdf', documentType: 'sonstiges' })
    if (result.error) { await supabase.storage.from('project-documents').remove([path]); throw new Error(result.error) }
  }

  async function run(mode: 'download' | 'save' | 'send') {
    if (busy) return
    setBusy(mode); setStatus('PDF wird erstellt…')
    try {
      const blob = await createPdf(project, calc)
      if (mode === 'download') {
        const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = fileName; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 60000)
        setStatus('PDF wurde erstellt.')
      } else {
        setStatus('PDF wird in EMA gespeichert…'); await savePdf(blob)
        if (mode === 'save') setStatus('PDF wurde im Projekt gespeichert.')
        else {
          if (!recipient.trim()) throw new Error('Bitte Empfänger-E-Mail eintragen.')
          setStatus('E-Mail wird über Microsoft 365 versendet…')
          const response = await fetch('/api/microsoft/send-mail', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: recipient, subject, body: message, fileName, contentBytes: await blobToBase64(blob) }) })
          const result = await response.json()
          if (!response.ok) throw new Error(result.error || 'Versand fehlgeschlagen.')
          setStatus('PDF wurde gespeichert und versendet.')
        }
      }
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Vorgang fehlgeschlagen.') }
    finally { setBusy(null) }
  }

  return <div className="space-y-4 rounded-[1.5rem] bg-white p-4 shadow-sm md:p-6">
    <div><h3 className="text-lg font-extrabold text-[#1F2A44]">CAPEX-PDF</h3><p className="mt-1 text-sm text-slate-500">Professionellen EMA-CAPEX-Report erstellen, speichern und über Microsoft 365 versenden.</p></div>
    <div className="grid gap-3 sm:grid-cols-2"><input type="email" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Empfänger-E-Mail" className="form-input" /><input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Betreff" className="form-input" /></div>
    <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} className="form-input w-full resize-y" />
    <div className="grid gap-2 sm:grid-cols-3">
      <button onClick={() => run('download')} disabled={Boolean(busy)} className="btn-secondary justify-center"><Download className="h-4 w-4" /> {busy === 'download' ? 'Erstellt…' : 'PDF erstellen'}</button>
      <button onClick={() => run('save')} disabled={Boolean(busy)} className="btn-secondary justify-center"><Save className="h-4 w-4" /> {busy === 'save' ? 'Speichert…' : 'PDF speichern'}</button>
      <button onClick={() => run('send')} disabled={Boolean(busy)} className="btn-primary justify-center"><Mail className="h-4 w-4" /> {busy === 'send' ? 'Versendet…' : 'Speichern & versenden'}</button>
    </div>
    {status && <div role="status" className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-[#1F2A44]">{status}</div>}
    <p className="text-xs leading-5 text-slate-500">Für den Versand muss Microsoft 365 verbunden sein. Gegebenenfalls ist wegen der Mail-Berechtigung eine erneute Verbindung erforderlich.</p>
  </div>
}
