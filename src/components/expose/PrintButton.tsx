'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { generateMemorandumPdf, PdfGenerationError, type MemorandumPdfData } from '@/lib/pdf/memorandumPdf'
import { markProjectOutputGenerated } from '@/lib/actions/project-output.actions'

function buildFilename(projectName: string, projectNumber: string) {
  const namePart = projectName
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 60)
  const numberPart = projectNumber && projectNumber !== '—' ? `_${projectNumber}` : ''
  return `Investment_Memorandum_${namePart || 'Projekt'}${numberPart}.pdf`
}

function isIosDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function currentProjectId() {
  const match = window.location.pathname.match(/^\/expose\/([^/]+)/)
  return match?.[1] ? decodeURIComponent(match[1]) : null
}

function openOrDownloadPdf(blob: Blob, filename: string) {
  const blobUrl = URL.createObjectURL(blob)
  if (isIosDevice()) {
    window.location.href = blobUrl
  } else {
    const anchor = document.createElement('a')
    anchor.href = blobUrl
    anchor.download = filename
    anchor.rel = 'noopener'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  }
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 120000)
}

async function generatePdfWithoutHeroStatusBadge(data: MemorandumPdfData) {
  const { default: jsPDF } = await import('jspdf')
  const api = (jsPDF as unknown as { API: Record<string, unknown> }).API
  const originalRoundedRect = api.roundedRect as ((...args: unknown[]) => unknown) | undefined
  if (!originalRoundedRect) return generateMemorandumPdf(data)

  api.roundedRect = function patchedRoundedRect(this: unknown, ...args: unknown[]) {
    const [x, y, width, height] = args as number[]
    if (x === 22 && y === 88 && width === 40 && height === 6) return this
    return originalRoundedRect.apply(this, args)
  }

  try {
    return await generateMemorandumPdf(data)
  } finally {
    api.roundedRect = originalRoundedRect
  }
}

interface PrintButtonProps { data: MemorandumPdfData }

export function PrintButton({ data }: PrintButtonProps) {
  const [isPreparing, setIsPreparing] = useState(false)

  const createPdf = async () => {
    if (isPreparing) return
    setIsPreparing(true)
    let step = 'Daten prüfen'

    try {
      step = 'PDF erzeugen'
      const blob = await generatePdfWithoutHeroStatusBadge(data)
      const projectId = currentProjectId()
      if (projectId) {
        step = 'Dokumentversion speichern'
        const result = await markProjectOutputGenerated(projectId, 'investment_memorandum')
        if (result.error) throw new Error(result.error)
      }
      step = 'PDF öffnen oder speichern'
      openOrDownloadPdf(blob, buildFilename(data.projectName, data.projectNumber))
    } catch (error) {
      const failedStep = error instanceof PdfGenerationError ? error.step : step
      const name = error instanceof Error ? error.name : 'Error'
      const message = error instanceof Error ? error.message : String(error)
      const stack = error instanceof Error ? error.stack : undefined
      const cause = error instanceof PdfGenerationError ? error.cause : undefined
      console.error('PDF-Erstellung fehlgeschlagen', { step: failedStep, name, message, stack, cause })
      window.alert(`Die PDF konnte nicht erstellt werden.\n\nSchritt: ${failedStep}\n${name}: ${message}`)
    } finally {
      setIsPreparing(false)
    }
  }

  return (
    <button disabled={isPreparing} onClick={createPdf} className="print:hidden inline-flex items-center gap-2 rounded-2xl bg-[#5CB800] px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-[#5CB800]/20 transition hover:-translate-y-0.5 hover:bg-[#4EA000] disabled:cursor-wait disabled:opacity-70">
      <Download className="h-4 w-4" />
      {isPreparing ? 'PDF wird erstellt…' : 'PDF erstellen'}
    </button>
  )
}
