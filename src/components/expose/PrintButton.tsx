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
            background: #ffffff !important;
          }

          body > div,
          body main,
          div:has(> .memorandum-page) {
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: #ffffff !important;
          }

          .memorandum-page {
            box-sizing: border-box !important;
            display: flex !important;
            flex-direction: column !important;
            position: relative !important;
            width: 210mm !important;
            height: 280mm !important;
            min-height: 280mm !important;
            max-height: 280mm !important;
            margin: 0 !important;
            overflow: hidden !important;
            break-inside: avoid-page !important;
            page-break-inside: avoid !important;
            box-shadow: none !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .memorandum-page + .memorandum-page {
            break-before: page !important;
            page-break-before: always !important;
          }

          .memorandum-page:last-child {
            break-after: auto !important;
            page-break-after: auto !important;
          }

          .memorandum-page:first-child > div:first-child {
            min-height: 18mm !important;
            padding: 3.5mm 12mm 2mm !important;
            border-bottom: 0.35mm solid #d8e2ea !important;
            background: linear-gradient(90deg, #ffffff 0%, #f8fbf5 100%) !important;
          }

          .memorandum-page:first-child > div:first-child img {
            height: 10mm !important;
          }

          .memorandum-page:first-child > div:first-child p:first-child {
            font-size: 13px !important;
            letter-spacing: 0.08em !important;
          }

          .memorandum-page:first-child > div:first-child p:last-child {
            margin-top: 1.2mm !important;
            font-size: 8px !important;
          }

          .memorandum-page:first-child > section:first-of-type {
            position: relative !important;
            height: 82mm !important;
            min-height: 82mm !important;
            overflow: hidden !important;
            background: #ffffff !important;
            border-bottom: 0.35mm solid #dbe4ea !important;
          }

          .memorandum-page:first-child > section:first-of-type > div:nth-of-type(1) {
            display: none !important;
          }

          .memorandum-page:first-child > section:first-of-type > div:nth-of-type(2) {
            position: absolute !important;
            inset: auto 0 22mm 0 !important;
            z-index: 2 !important;
            height: 13mm !important;
            background: linear-gradient(
              to bottom,
              rgba(255,255,255,0) 0%,
              rgba(255,255,255,0.34) 34%,
              rgba(255,255,255,0.88) 76%,
              #ffffff 100%
            ) !important;
          }

          .memorandum-page:first-child > section:first-of-type > div:last-child {
            position: absolute !important;
            inset: auto 0 0 0 !important;
            z-index: 3 !important;
            display: block !important;
            height: 25mm !important;
            padding: 2mm 12mm 3mm 15mm !important;
            background: linear-gradient(90deg, #ffffff 0%, #ffffff 76%, #f5faef 100%) !important;
            border-left: 1.4mm solid #5cb800 !important;
          }

          .memorandum-page:first-child > section:first-of-type h1 {
            max-width: 72% !important;
            margin: 0 !important;
            font-size: 26px !important;
            line-height: 1.02 !important;
            letter-spacing: -0.035em !important;
          }

          .memorandum-page:first-child > section:first-of-type h1 + p {
            margin-top: 1.6mm !important;
          }

          .memorandum-page:first-child > section:first-of-type h1 + p + div {
            margin-top: 2mm !important;
          }

          .memorandum-page:first-child > section:first-of-type > div:last-child > span:last-child {
            bottom: 4mm !important;
            right: 12mm !important;
            background: #ffffff !important;
            border-color: #dce7d2 !important;
            box-shadow: 0 1.5mm 5mm rgba(11, 22, 51, 0.08) !important;
          }

          .memorandum-page:first-child > section:nth-of-type(2) {
            background: linear-gradient(180deg, #ffffff 0%, #fbfcfa 100%) !important;
          }

          .memorandum-page:first-child > section:nth-of-type(2) > div:first-child > div {
            position: relative !important;
            overflow: hidden !important;
            border-color: #dce4e9 !important;
            background: #ffffff !important;
            box-shadow: 0 1mm 4mm rgba(11, 22, 51, 0.055) !important;
          }

          .memorandum-page:first-child > section:nth-of-type(2) > div:first-child > div::before {
            content: '' !important;
            position: absolute !important;
            inset: 0 0 auto 0 !important;
            height: 0.8mm !important;
            background: linear-gradient(90deg, #5cb800, #9ad75d) !important;
          }

          .memorandum-page:first-child > section:nth-of-type(2) > div:first-child > div:nth-child(2),
          .memorandum-page:first-child > section:nth-of-type(2) > div:first-child > div:nth-child(5),
          .memorandum-page:first-child > section:nth-of-type(2) > div:first-child > div:nth-child(6) {
            background: linear-gradient(180deg, #ffffff 0%, #f5faef 100%) !important;
          }

          .memorandum-page:first-child > section:nth-of-type(2) > div:nth-of-type(2) > section,
          .memorandum-page:first-child > section:nth-of-type(2) > div:nth-of-type(3) > section {
            border-radius: 3mm !important;
            background: #ffffff !important;
          }

          .memorandum-page:first-child > footer {
            background: linear-gradient(90deg, #f7fafc 0%, #ffffff 56%, #f7fbf4 100%) !important;
            border-top-color: #cfd9df !important;
          }

          .memorandum-page:nth-child(2) {
            background:
              radial-gradient(circle at 88% 10%, rgba(92,184,0,0.08), transparent 28%),
              linear-gradient(180deg, #ffffff 0%, #fbfcfa 100%) !important;
          }

          .memorandum-page:nth-child(2)::before {
            content: '' !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 2.2mm !important;
            background: linear-gradient(90deg, #0b1633 0%, #0b1633 62%, #5cb800 62%, #8ed04b 100%) !important;
            z-index: 5 !important;
          }

          .memorandum-page:nth-child(2) > header {
            padding-bottom: 4mm !important;
            border-bottom: 0.35mm solid #dbe4ea !important;
          }

          .memorandum-page:nth-child(2) h3 + div {
            background: linear-gradient(90deg, #5cb800, #95d45a) !important;
          }

          .memorandum-page:nth-child(2) section > div[class*='rounded-2xl'],
          .memorandum-page:nth-child(2) section > div[class*='rounded-xl'] {
            box-shadow: 0 1.2mm 5mm rgba(11, 22, 51, 0.055) !important;
          }

          .memorandum-page:nth-child(2) [class*='bg-[#F1F9E8]'] {
            background: linear-gradient(90deg, #f3faea 0%, #eef8e3 100%) !important;
          }

          .memorandum-page:nth-child(2) section[class*='bg-[#0B1633]'] {
            position: relative !important;
            overflow: hidden !important;
            background: linear-gradient(135deg, #0b1633 0%, #13284b 100%) !important;
            box-shadow: 0 2mm 7mm rgba(11, 22, 51, 0.18) !important;
          }

          .memorandum-page:nth-child(2) section[class*='bg-[#0B1633]']::after {
            content: '' !important;
            position: absolute !important;
            width: 28mm !important;
            height: 28mm !important;
            right: -8mm !important;
            top: -10mm !important;
            border-radius: 999px !important;
            background: rgba(135, 211, 59, 0.14) !important;
          }

          .memorandum-page:nth-child(2) section[class*='bg-[#0B1633]'],
          .memorandum-page:nth-child(2) section[class*='bg-[#0B1633]'] p,
          .memorandum-page:nth-child(2) section[class*='bg-[#0B1633]'] h3 {
            color: #ffffff !important;
          }

          .memorandum-page:nth-child(2) section[class*='bg-[#0B1633]'] span,
          .memorandum-page:nth-child(2) section[class*='bg-[#0B1633]'] p:first-child {
            color: #87d33b !important;
          }

          .memorandum-page img {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .memorandum-page img[alt='Hochwertiges Projektmotiv'] {
            display: block !important;
            visibility: visible !important;
            position: absolute !important;
            inset: 0 0 auto 0 !important;
            z-index: 0 !important;
            width: 100% !important;
            height: 60mm !important;
            max-width: none !important;
            object-fit: cover !important;
            object-position: center 52% !important;
            opacity: 1 !important;
            transform: none !important;
            filter: saturate(1.04) contrast(1.02) !important;
            background: #ffffff !important;
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
