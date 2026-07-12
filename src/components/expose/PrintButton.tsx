'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { generateMemorandumPdf, type MemorandumPdfData } from '@/lib/pdf/memorandumPdf'

const EXPORT_ROOT_ID = 'memorandum-export-root'

function textContent(element: Element | null) {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
}

function parseGermanNumber(value: string) {
  const cleaned = value.replace(/[^0-9,.-]/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

function buildFilename(projectName?: string | null, projectNumber?: string | null) {
  const namePart = (projectName ?? 'Projekt')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 60)
  const numberPart = projectNumber ? `_${projectNumber}` : ''
  return `Investment_Memorandum_${namePart || 'Projekt'}${numberPart}.pdf`
}

function collectPdfData(projectName?: string | null, projectNumber?: string | null): MemorandumPdfData {
  const root = document.getElementById(EXPORT_ROOT_ID)
  const firstPage = root?.querySelector<HTMLElement>('.memorandum-page:first-child')
  if (!root || !firstPage) throw new Error('Memorandum-Inhalt wurde nicht gefunden')

  const topHeader = firstPage.querySelector(':scope > div:first-child')
  const topHeaderTexts = Array.from(topHeader?.querySelectorAll('p') ?? []).map(textContent)
  const hero = firstPage.querySelector('section:first-of-type')
  const heroParagraphs = Array.from(hero?.querySelectorAll('p') ?? []).map(textContent)
  const status = textContent(hero?.querySelector('span:last-child')) || 'Investorenansprache'

  const metricCards = Array.from(firstPage.querySelectorAll('section:nth-of-type(2) > div:first-child > div'))
  const metrics = new Map<string, string>()
  metricCards.forEach((card) => {
    const paragraphs = Array.from(card.querySelectorAll('p')).map(textContent).filter(Boolean)
    if (paragraphs.length >= 2) metrics.set(paragraphs[0].toLowerCase(), paragraphs[paragraphs.length - 1])
  })

  const locationText = heroParagraphs.find((value) => value.includes(',')) || 'Deutschland'
  const dateText = heroParagraphs.find((value) => /\b20\d{2}\b/.test(value)) || new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(new Date())

  const pvKwp = parseGermanNumber(metrics.get('leistung') ?? '')
  const purchasePrice = parseGermanNumber(metrics.get('kaufpreis') ?? '')
  const specificYield = parseGermanNumber(metrics.get('spez. ertrag') ?? '')
  const tariffRaw = parseGermanNumber(metrics.get('vergütung') ?? '')
  const tariffEurKwh = tariffRaw > 1 ? tariffRaw / 100 : tariffRaw
  const annualRevenue = parseGermanNumber(metrics.get('jahreserlös') ?? '')
  const amortisation = parseGermanNumber(metrics.get('amortisation') ?? '')

  return {
    projectName: projectName || textContent(firstPage.querySelector('h1')) || 'Projekt',
    projectNumber: projectNumber || 'Projekt',
    projectType: topHeaderTexts.at(-1) || 'Energieinfrastrukturprojekt',
    location: locationText,
    dateLabel: dateText,
    status,
    pvKwp,
    purchasePrice,
    specificYield,
    tariffEurKwh,
    annualRevenue,
    amortisation,
  }
}

interface PrintButtonProps {
  projectName?: string | null
  projectNumber?: string | null
}

export function PrintButton({ projectName, projectNumber }: PrintButtonProps) {
  const [isPreparing, setIsPreparing] = useState(false)

  const createPdf = async () => {
    if (isPreparing) return
    setIsPreparing(true)

    try {
      const data = collectPdfData(projectName, projectNumber)
      const blob = await generateMemorandumPdf(data)
      const filename = buildFilename(projectName, projectNumber)
      const file = new File([blob], filename, { type: 'application/pdf' })

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: filename })
      } else {
        const blobUrl = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = blobUrl
        anchor.download = filename
        anchor.rel = 'noopener'
        document.body.appendChild(anchor)
        anchor.click()
        anchor.remove()
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 120000)
      }
    } catch (error) {
      console.error('PDF-Erstellung fehlgeschlagen', error)
      const message = error instanceof Error ? error.message : 'Unbekannter Fehler'
      window.alert(`Die PDF konnte nicht erstellt werden.\n\n${message}`)
    } finally {
      setIsPreparing(false)
    }
  }

  return (
    <button
      disabled={isPreparing}
      onClick={createPdf}
      className="print:hidden inline-flex items-center gap-2 rounded-2xl bg-[#5CB800] px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-[#5CB800]/20 transition hover:-translate-y-0.5 hover:bg-[#4EA000] disabled:cursor-wait disabled:opacity-70"
    >
      <Download className="h-4 w-4" />
      {isPreparing ? 'PDF wird erstellt…' : 'PDF erstellen'}
    </button>
  )
}
