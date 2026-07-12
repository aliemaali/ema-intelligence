'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { generateMemorandumPdf } from '@/lib/pdf/memorandumPdf'

const EXPORT_ROOT_ID = 'memorandum-export-root'

function getPages(): HTMLElement[] {
  const root = document.getElementById(EXPORT_ROOT_ID)
  if (!root) return []
  return Array.from(root.querySelectorAll<HTMLElement>('.memorandum-page'))
}

async function withPdfRenderMode<T>(fn: () => Promise<T>): Promise<T> {
  const root = document.getElementById(EXPORT_ROOT_ID)
  root?.classList.add('pdf-render')
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))

  try {
    return await fn()
  } finally {
    root?.classList.remove('pdf-render')
  }
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

interface PrintButtonProps {
  projectName?: string | null
  projectNumber?: string | null
}

export function PrintButton({ projectName, projectNumber }: PrintButtonProps) {
  const [isPreparing, setIsPreparing] = useState(false)

  const downloadPdf = async () => {
    if (isPreparing) return
    setIsPreparing(true)

    try {
      const pages = getPages()
      if (!pages.length) throw new Error('Keine Memorandum-Seiten gefunden')

      const filename = buildFilename(projectName, projectNumber)
      const blob = await withPdfRenderMode(() => generateMemorandumPdf(pages))
      const file = new File([blob], filename, { type: 'application/pdf' })

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: filename })
        return
      }

      const blobUrl = URL.createObjectURL(blob)
      window.location.href = blobUrl
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 300000)
    } catch (error) {
      if ((error as DOMException)?.name !== 'AbortError') {
        console.error('PDF-Erstellung fehlgeschlagen', error)
        window.alert('Die PDF konnte nicht erstellt werden. Bitte lade die Seite neu und versuche es erneut.')
      }
    } finally {
      setIsPreparing(false)
    }
  }

  return (
    <>
      <style jsx global>{`
        .pdf-render .memorandum-page {
          box-sizing: border-box !important;
          display: flex !important;
          flex-direction: column !important;
          position: relative !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
          box-shadow: none !important;
          background: #ffffff !important;
          transform: none !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        .pdf-render .memorandum-page:first-child > div:first-child {
          border-bottom: 0.35mm solid #d8e1e8 !important;
          background: #ffffff !important;
        }

        .pdf-render .memorandum-page:first-child > section:first-of-type {
          position: relative !important;
          overflow: hidden !important;
          background: #07182f !important;
          border-bottom: none !important;
        }

        .pdf-render .memorandum-page:first-child > section:first-of-type > div:nth-of-type(1),
        .pdf-render .memorandum-page:first-child > section:first-of-type > div:nth-of-type(2) {
          display: none !important;
        }

        .pdf-render .memorandum-page:first-child > section:first-of-type > div:last-child {
          position: absolute !important;
          inset: 0 auto 0 0 !important;
          z-index: 3 !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: center !important;
          width: 41% !important;
          height: 100% !important;
          padding: 8mm 12mm 7mm !important;
          background: linear-gradient(135deg, #06162b 0%, #0b2443 100%) !important;
          color: #ffffff !important;
          clip-path: polygon(0 0, 91% 0, 100% 100%, 0 100%) !important;
        }

        .pdf-render .memorandum-page:first-child > section:first-of-type > div:last-child::after {
          content: '' !important;
          position: absolute !important;
          top: 0 !important;
          right: 5% !important;
          width: 1.2mm !important;
          height: 100% !important;
          background: #79b900 !important;
          transform: skewX(-11deg) !important;
        }

        .pdf-render .memorandum-page:first-child > section:first-of-type h1 {
          max-width: 78% !important;
          margin: 0 !important;
          color: #ffffff !important;
          line-height: 1.02 !important;
          letter-spacing: -0.035em !important;
        }

        .pdf-render .memorandum-page:first-child > section:first-of-type h1 + p {
          margin-top: 2.2mm !important;
          color: #8ed03f !important;
        }

        .pdf-render .memorandum-page:first-child > section:first-of-type h1 + p + div {
          margin-top: 4mm !important;
          max-width: 78% !important;
          color: #ffffff !important;
        }

        .pdf-render .memorandum-page:first-child > section:first-of-type h1 + p + div span {
          color: #ffffff !important;
        }

        .pdf-render .memorandum-page:first-child > section:first-of-type > div:last-child > span:last-child {
          position: static !important;
          align-self: flex-start !important;
          margin-top: 4mm !important;
          padding: 1.6mm 3.5mm !important;
          color: #07182f !important;
          background: #ffffff !important;
          border-color: #ffffff !important;
          box-shadow: none !important;
        }

        .pdf-render .memorandum-page img[alt='Hochwertiges Projektmotiv'] {
          display: block !important;
          visibility: visible !important;
          position: absolute !important;
          inset: 0 0 0 auto !important;
          z-index: 0 !important;
          width: 64% !important;
          max-width: none !important;
          object-fit: cover !important;
          object-position: center 52% !important;
          opacity: 1 !important;
          transform: none !important;
          filter: saturate(1.05) contrast(1.03) !important;
          background: #ffffff !important;
        }

        .pdf-render .memorandum-page:first-child > section:nth-of-type(2) {
          position: relative !important;
          z-index: 5 !important;
          background: #ffffff !important;
        }

        .pdf-render .memorandum-page:first-child > section:nth-of-type(2) > div:first-child {
          position: relative !important;
          z-index: 6 !important;
          margin-top: -8mm !important;
          gap: 0 !important;
          overflow: hidden !important;
          border: 0.35mm solid #dbe3e9 !important;
          border-radius: 3mm !important;
          background: #ffffff !important;
          box-shadow: 0 2mm 7mm rgba(11, 22, 51, 0.13) !important;
        }

        .pdf-render .memorandum-page:first-child > section:nth-of-type(2) > div:first-child > div {
          border: 0 !important;
          border-right: 0.25mm solid #e4e9ed !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          background: #ffffff !important;
        }

        .pdf-render .memorandum-page:first-child > section:nth-of-type(2) > div:first-child > div:last-child {
          border-right: 0 !important;
        }

        .pdf-render .memorandum-page:first-child > footer {
          margin-top: auto !important;
          background: #ffffff !important;
          border-top: 0.3mm solid #d8e1e8 !important;
        }

        .pdf-render .memorandum-page:nth-child(2) {
          background: #ffffff !important;
        }

        .pdf-render .memorandum-page:nth-child(2) > header {
          align-items: center !important;
          background: #07182f !important;
          border-bottom: 1.2mm solid #79b900 !important;
        }

        .pdf-render .memorandum-page:nth-child(2) > header p:first-child {
          color: #ffffff !important;
        }

        .pdf-render .memorandum-page:nth-child(2) > header p:last-child {
          color: #9bd758 !important;
        }

        .pdf-render .memorandum-page:nth-child(2) h3 + div {
          background: #79b900 !important;
        }

        .pdf-render .memorandum-page:nth-child(2) section > div[class*='rounded-2xl'],
        .pdf-render .memorandum-page:nth-child(2) section > div[class*='rounded-xl'] {
          border-color: #dbe3e9 !important;
          box-shadow: 0 1.2mm 4mm rgba(11, 22, 51, 0.06) !important;
        }

        .pdf-render .memorandum-page:nth-child(2) [class*='border-b-2'][class*='border-[#0B1633]'] {
          color: #ffffff !important;
          background: #07182f !important;
          border-bottom-color: #07182f !important;
        }

        .pdf-render .memorandum-page:nth-child(2) [class*='bg-[#F1F9E8]'] {
          background: #eff7e6 !important;
        }

        .pdf-render .memorandum-page:nth-child(2) section[class*='bg-[#0B1633]'] {
          position: relative !important;
          overflow: hidden !important;
          background: linear-gradient(135deg, #07182f 0%, #102b50 100%) !important;
          box-shadow: none !important;
        }

        .pdf-render .memorandum-page:nth-child(2) section[class*='bg-[#0B1633]'],
        .pdf-render .memorandum-page:nth-child(2) section[class*='bg-[#0B1633]'] p,
        .pdf-render .memorandum-page:nth-child(2) section[class*='bg-[#0B1633]'] h3 {
          color: #ffffff !important;
        }

        .pdf-render .memorandum-page:nth-child(2) section[class*='bg-[#0B1633]'] span,
        .pdf-render .memorandum-page:nth-child(2) section[class*='bg-[#0B1633]'] p:first-child {
          color: #95d44f !important;
        }

        .pdf-render .memorandum-page img {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      `}</style>

      <button
        disabled={isPreparing}
        onClick={downloadPdf}
        className="print:hidden inline-flex items-center gap-2 rounded-2xl bg-[#5CB800] px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-[#5CB800]/20 transition hover:-translate-y-0.5 hover:bg-[#4EA000] disabled:cursor-wait disabled:opacity-70"
      >
        <Download className="h-4 w-4" />
        {isPreparing ? 'PDF wird erstellt…' : 'PDF erstellen'}
      </button>
    </>
  )
}
