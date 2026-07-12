'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { generateMemorandumPdf, PdfGenerationError, type MemorandumPdfData } from '@/lib/pdf/memorandumPdf'

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
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

/**
 * Hands the finished PDF to the user. Deliberately avoids window.print(),
 * navigator.share() as a required step, and opening a blank new tab:
 * - iOS Safari ignores the `download` attribute on anchors, but it does
 *   open a `blob:` URL with a PDF mime type in its built-in PDF viewer when
 *   navigated to directly - from there the user can tap Share/Save
 *   themselves via the native UI. No Share API call is needed or made.
 * - Everywhere else, a normal downloading anchor click is used.
 */
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

interface PrintButtonProps {
  data: MemorandumPdfData
}

export function PrintButton({ data }: PrintButtonProps) {
  const [isPreparing, setIsPreparing] = useState(false)

  const createPdf = async () => {
    if (isPreparing) return
    setIsPreparing(true)

    let step = 'Daten prüfen'

    try {
      step = 'PDF erzeugen'
      const blob = await generateMemorandumPdf(data)

      step = 'PDF öffnen oder speichern'
      const filename = buildFilename(data.projectName, data.projectNumber)
      openOrDownloadPdf(blob, filename)
    } catch (error) {
      const failedStep = error instanceof PdfGenerationError ? error.step : step
      const name = error instanceof Error ? error.name : 'Error'
      const message = error instanceof Error ? error.message : String(error)
      const stack = error instanceof Error ? error.stack : undefined
      const cause = error instanceof PdfGenerationError ? error.cause : undefined

      // eslint-disable-next-line no-console
      console.error('PDF-Erstellung fehlgeschlagen', { step: failedStep, name, message, stack, cause })
      window.alert(`Die PDF konnte nicht erstellt werden.\n\nSchritt: ${failedStep}\n${name}: ${message}`)
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
