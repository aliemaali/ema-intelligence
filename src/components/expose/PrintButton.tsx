'use client'

import { useState } from 'react'
import { Download, Printer } from 'lucide-react'

async function waitForImages() {
  const images = Array.from(
    document.querySelectorAll<HTMLImageElement>('.memorandum-page img'),
  )

  await Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete && image.naturalWidth > 0) {
            resolve()
            return
          }

          const finish = () => resolve()
          image.addEventListener('load', finish, { once: true })
          image.addEventListener('error', finish, { once: true })
          window.setTimeout(finish, 5000)
        }),
    ),
  )

  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  )
}

export function PrintButton() {
  const [isPreparing, setIsPreparing] = useState(false)

  const print = async () => {
    if (isPreparing) return
    setIsPreparing(true)

    try {
      await waitForImages()
      await new Promise<void>((resolve) => window.setTimeout(resolve, 250))
      window.print()
    } finally {
      window.setTimeout(() => setIsPreparing(false), 500)
    }
  }

  return (
    <>
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 0;
        }

        @media print {
          html,
          body {
            width: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: #fff !important;
          }

          body > div,
          body main,
          div:has(> .memorandum-page) {
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }

          .memorandum-page {
            box-sizing: border-box !important;
            display: flex !important;
            flex-direction: column !important;
            position: relative !important;
            width: 210mm !important;
            height: 297mm !important;
            min-height: 297mm !important;
            max-height: 297mm !important;
            margin: 0 !important;
            overflow: hidden !important;
            break-inside: avoid-page !important;
            page-break-inside: avoid !important;
            box-shadow: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .memorandum-page + .memorandum-page {
            break-before: page !important;
            page-break-before: always !important;
          }

          .memorandum-page:first-child > div:first-child {
            min-height: 23mm !important;
            padding: 5mm 12mm 3.5mm !important;
            border-bottom: 0.35mm solid #e2e8f0 !important;
          }

          .memorandum-page:first-child > div:first-child img {
            height: 12mm !important;
          }

          .memorandum-page:first-child > div:first-child p:first-child {
            font-size: 13px !important;
            letter-spacing: 0.08em !important;
          }

          .memorandum-page:first-child > div:first-child p:last-child {
            margin-top: 1.5mm !important;
            font-size: 8px !important;
          }

          .memorandum-page:first-child > section:first-of-type {
            height: 61mm !important;
            min-height: 61mm !important;
            border-bottom: 0.35mm solid #e2e8f0 !important;
          }

          .memorandum-page:first-child > section:first-of-type > div:last-child {
            padding: 0 12mm 6mm !important;
          }

          .memorandum-page:first-child > section:first-of-type h1 {
            max-width: 72% !important;
            font-size: 27px !important;
            line-height: 1.02 !important;
            letter-spacing: -0.035em !important;
          }

          .memorandum-page:first-child > section:first-of-type h1 + p {
            margin-top: 2mm !important;
          }

          .memorandum-page img {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .memorandum-page img[alt='Hochwertiges Projektmotiv'] {
            display: block !important;
            visibility: visible !important;
            position: absolute !important;
            inset: 0 !important;
            z-index: 0 !important;
            width: 100% !important;
            height: 100% !important;
            max-width: none !important;
            object-fit: cover !important;
            object-position: center 52% !important;
            opacity: 1 !important;
            transform: none !important;
            filter: none !important;
            background: #e8eef2 !important;
          }
        }
      `}</style>

      <div className="print:hidden flex flex-wrap gap-3">
        <button
          disabled={isPreparing}
          onClick={print}
          className="inline-flex items-center gap-2 rounded-2xl bg-[#5CB800] px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-[#5CB800]/20 transition hover:-translate-y-0.5 hover:bg-[#4EA000] disabled:cursor-wait disabled:opacity-70"
        >
          <Download className="h-4 w-4" />
          {isPreparing ? 'PDF wird vorbereitet…' : 'Als PDF speichern'}
        </button>

        <button
          disabled={isPreparing}
          onClick={print}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-extrabold text-[#0B1633] shadow-sm transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-70"
        >
          <Printer className="h-4 w-4" /> Drucken
        </button>
      </div>
    </>
  )
}
