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

const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const number = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 })

function safeName(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9äöüÄÖÜß_-]+/g, '_').replace(/^_+|_+$/g, '') || 'Projekt'
}

async function createPdf(project: CapexProject, calc: CapexCalcResult) {
  const { default: jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margin = 16
  let y = 18

  const line = (label: string, value: string) => {
    if (y > 276) { doc.addPage(); y = 18 }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90)
    doc.text(label, margin, y)
    doc.setFont('helvetica', 'bold'); doc.setTextColor(31, 42, 68)
    doc.text(value, 194, y, { align: 'right' })
    doc.setDrawColor(230); doc.line(margin, y + 2.5, 194, y + 2.5)
    y += 7
  }

  doc.setFillColor(31, 42, 68); doc.rect(0, 0, 210, 39, 'F')
  doc.setFillColor(92, 184, 0); doc.rect(0, 39, 210, 2.5, 'F')
  doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(20)
  doc.text('CAPEX-KALKULATION', margin, 19)
  doc.setFontSize(10); doc.text('EMA Enterprise GmbH', margin, 29)
  doc.setFont('helvetica', 'normal'); doc.text(new Date().toLocaleDateString('de-DE'), 194, 29, { align: 'right' })
  y = 52

  doc.setTextColor(31, 42, 68); doc.setFont('helvetica', 'bold'); doc.setFontSize(15)
  doc.text(project.projektname || project.calculationName, margin, y); y += 10
  line('Kalkulation', project.calculationName)
  line('Anlagenleistung', `${number.format(project.anlagenleistungKwp)} kWp`)
  line('Spezifischer Ertrag', `${number.format(project.spezErtragKwhKwp)} kWh/kWp`)
  line('Strompreis', `${number.format(project.strompreisEurKwh * 100)} ct/kWh`)
  line('Pachtdauer', `${number.format(project.pachtdauerJahre)} Jahre`)

  y += 5; doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text('Investitionsübersicht', margin, y); y += 8
  for (const position of calc.positions.filter((item) => item.cost > 0)) {
    line(position.name, `${euro.format(position.cost)} · ${number.format(position.eurPerKwp)} €/kWp`)
  }

  y += 4; doc.setFillColor(244, 249, 238); doc.roundedRect(margin, y, 178, 38, 3, 3, 'F')
  doc.setTextColor(31, 42, 68); doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
  doc.text('Gesamt-CAPEX', margin + 6, y + 10); doc.text(euro.format(calc.totalCapex), 188, y + 10, { align: 'right' })
  doc.text('CAPEX je kWp', margin + 6, y + 20); doc.text(`${number.format(calc.specificCapex)} €/kWp`, 188, y + 20, { align: 'right' })
  doc.text('IRR / NPV', margin + 6, y + 30); doc.text(`${number.format(calc.irr * 100)} % · ${euro.format(calc.npv)}`, 188, y + 30, { align: 'right' })
  y += 48

  doc.setFontSize(13); doc.text('Wirtschaftlichkeit', margin, y); y += 8
  line('Ertrag Jahr 1', `${number.format(calc.energyY1)} kWh`)
  line('Erlös Jahr 1', euro.format(calc.revenueY1))
  line('OPEX Jahr 1', euro.format(calc.opexY1))
  line('Cashflow Jahr 1', euro.format(calc.ncfY1))
  line('Statische Amortisation', calc.staticPayback == null ? '—' : `${number.format(calc.staticPayback)} Jahre`)
  line('Dynamische Amortisation', calc.dynPayback == null ? '—' : `${number.format(calc.dynPayback)} Jahre`)

  if (y > 215) { doc.addPage(); y = 18 }
  y += 5; doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text('Kumulierter Cashflow', margin, y); y += 8
  const chartX = margin, chartY = y, chartW = 178, chartH = 48
  const values = calc.years.map((row) => row.cum)
  const min = Math.min(...values, 0), max = Math.max(...values, 1), span = Math.max(max - min, 1)
  const zeroY = chartY + chartH - ((0 - min) / span) * chartH
  doc.setDrawColor(205); doc.rect(chartX, chartY, chartW, chartH); doc.line(chartX, zeroY, chartX + chartW, zeroY)
  doc.setDrawColor(92, 184, 0); doc.setLineWidth(0.8)
  values.forEach((value, index) => {
    if (index === 0) return
    const x1 = chartX + ((index - 1) / (values.length - 1)) * chartW
    const x2 = chartX + (index / (values.length - 1)) * chartW
    const y1 = chartY + chartH - ((values[index - 1] - min) / span) * chartH
    const y2 = chartY + chartH - ((value - min) / span) * chartH
    doc.line(x1, y1, x2, y2)
  })

  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page); doc.setFontSize(7.5); doc.setTextColor(130)
    doc.text(`EMA Enterprise GmbH · CAPEX · Seite ${page}/${pages}`, 105, 291, { align: 'center' })
  }
  return doc.output('blob')
}

async function blobToBase64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  }
  return btoa(binary)
}

export function CapexExportPanel({ project, calc }: CapexExportPanelProps) {
  const [recipient, setRecipient] = useState('')
  const [subject, setSubject] = useState(`CAPEX-Kalkulation – ${project.projektname || project.calculationName}`)
  const [message, setMessage] = useState('Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie die CAPEX-Kalkulation zum Projekt.\n\nMit freundlichen Grüßen\nEMA Enterprise GmbH')
  const [busy, setBusy] = useState<'download' | 'save' | 'send' | null>(null)
  const [status, setStatus] = useState('')
  const supabase = createClient()
  const fileName = `EMA_CAPEX_${safeName(project.projektname || project.calculationName)}.pdf`

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
    <div><h3 className="text-lg font-extrabold text-[#1F2A44]">CAPEX-PDF</h3><p className="mt-1 text-sm text-slate-500">Erstellen, im Projekt speichern und direkt über Microsoft 365 versenden.</p></div>
    <div className="grid gap-3 sm:grid-cols-2"><input type="email" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Empfänger-E-Mail" className="form-input" /><input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Betreff" className="form-input" /></div>
    <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} className="form-input w-full resize-y" />
    <div className="grid gap-2 sm:grid-cols-3">
      <button onClick={() => run('download')} disabled={Boolean(busy)} className="btn-secondary justify-center"><Download className="h-4 w-4" /> {busy === 'download' ? 'Erstellt…' : 'PDF erstellen'}</button>
      <button onClick={() => run('save')} disabled={Boolean(busy)} className="btn-secondary justify-center"><Save className="h-4 w-4" /> {busy === 'save' ? 'Speichert…' : 'PDF speichern'}</button>
      <button onClick={() => run('send')} disabled={Boolean(busy)} className="btn-primary justify-center"><Mail className="h-4 w-4" /> {busy === 'send' ? 'Versendet…' : 'Speichern & versenden'}</button>
    </div>
    {status && <div role="status" className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-[#1F2A44]">{status}</div>}
    <p className="text-xs leading-5 text-slate-500">Für den Versand muss Microsoft 365 verbunden sein. Wegen der neuen Mail-Berechtigung ist gegebenenfalls einmaliges Trennen und erneutes Verbinden erforderlich.</p>
  </div>
}
