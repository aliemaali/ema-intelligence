'use client'

import { useState } from 'react'
import { Download, Printer } from 'lucide-react'

async function waitForImages() {
  const images = Array.from(document.querySelectorAll<HTMLImageElement>('.memorandum-page img'))

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
      await new Promise<void>((resolve) => window.setTimeout(resolve, 300))
      window.print()
    } finally {
      window.setTimeout(() => setIsPreparing(false), 500)
    }
  }

  return (
    <>
      <style jsx global>{`
        @page {
          size: 297mm 210mm;
          margin: 0;
        }

        @media print {
          html,
          body {
            width: 297mm !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: #ffffff !important;
          }

          body > div,
          body main,
          div:has(> .memorandum-page) {
            width: 297mm !important;
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
            width: 297mm !important;
            height: 210mm !important;
            min-height: 210mm !important;
            max-height: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            break-inside: avoid-page !important;
            page-break-inside: avoid !important;
            box-shadow: none !important;
            background: #ffffff !important;
            transform: none !important;
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
            min-height: 16mm !important;
            padding: 3mm 12mm 2mm !important;
            border-bottom: 0.35mm solid #d8e1e8 !important;
            background: #ffffff !important;
          }

          .memorandum-page:first-child > div:first-child img {
            height: 9mm !important;
          }

          .memorandum-page:first-child > div:first-child p:first-child {
            font-size: 13px !important;
            letter-spacing: 0.12em !important;
          }

          .memorandum-page:first-child > div:first-child p:last-child {
            margin-top: 1mm !important;
            font-size: 7.5px !important;
          }

          .memorandum-page:first-child > section:first-of-type {
            position: relative !important;
            height: 76mm !important;
            min-height: 76mm !important;
            overflow: hidden !important;
            background: #07182f !important;
            border-bottom: none !important;
          }

          .memorandum-page:first-child > section:first-of-type > div:nth-of-type(1),
          .memorandum-page:first-child > section:first-of-type > div:nth-of-type(2) {
            display: none !important;
          }

          .memorandum-page:first-child > section:first-of-type > div:last-child {
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

          .memorandum-page:first-child > section:first-of-type > div:last-child::after {
            content: '' !important;
            position: absolute !important;
            top: 0 !important;
            right: 5% !important;
            width: 1.2mm !important;
            height: 100% !important;
            background: #79b900 !important;
            transform: skewX(-11deg) !important;
          }

          .memorandum-page:first-child > section:first-of-type h1 {
            max-width: 78% !important;
            margin: 0 !important;
            color: #ffffff !important;
            font-size: 29px !important;
            line-height: 1.02 !important;
            letter-spacing: -0.035em !important;
          }

          .memorandum-page:first-child > section:first-of-type h1 + p {
            margin-top: 2.2mm !important;
            color: #8ed03f !important;
          }

          .memorandum-page:first-child > section:first-of-type h1 + p + div {
            margin-top: 4mm !important;
            max-width: 78% !important;
            color: #ffffff !important;
            font-size: 8px !important;
          }

          .memorandum-page:first-child > section:first-of-type h1 + p + div span {
            color: #ffffff !important;
          }

          .memorandum-page:first-child > section:first-of-type > div:last-child > span:last-child {
            position: static !important;
            align-self: flex-start !important;
            margin-top: 4mm !important;
            padding: 1.6mm 3.5mm !important;
            color: #07182f !important;
            background: #ffffff !important;
            border-color: #ffffff !important;
            box-shadow: none !important;
          }

          .memorandum-page img[alt='Hochwertiges Projektmotiv'] {
            display: block !important;
            visibility: visible !important;
            position: absolute !important;
            inset: 0 0 0 auto !important;
            z-index: 0 !important;
            width: 64% !important;
            height: 76mm !important;
            max-width: none !important;
            object-fit: cover !important;
            object-position: center 52% !important;
            opacity: 1 !important;
            transform: none !important;
            filter: saturate(1.05) contrast(1.03) !important;
            background: #ffffff !important;
          }

          .memorandum-page:first-child > section:nth-of-type(2) {
            position: relative !important;
            z-index: 5 !important;
            padding: 0 12mm 4mm !important;
            background: #ffffff !important;
          }

          .memorandum-page:first-child > section:nth-of-type(2) > div:first-child {
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

          .memorandum-page:first-child > section:nth-of-type(2) > div:first-child > div {
            border: 0 !important;
            border-right: 0.25mm solid #e4e9ed !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: #ffffff !important;
          }

          .memorandum-page:first-child > section:nth-of-type(2) > div:first-child > div:last-child {
            border-right: 0 !important;
          }

          .memorandum-page:first-child > section:nth-of-type(2) > div:nth-of-type(2),
          .memorandum-page:first-child > section:nth-of-type(2) > div:nth-of-type(3) {
            margin-top: 4mm !important;
            gap: 5mm !important;
          }

          .memorandum-page:first-child > section:nth-of-type(2) > div:nth-of-type(2) > section,
          .memorandum-page:first-child > section:nth-of-type(2) > div:nth-of-type(3) > section {
            padding: 0 !important;
            border: 0 !important;
            background: #ffffff !important;
          }

          .memorandum-page:first-child > footer {
            margin-top: auto !important;
            padding: 2.2mm 12mm !important;
            background: #ffffff !important;
            border-top: 0.3mm solid #d8e1e8 !important;
          }

          .memorandum-page:nth-child(2) {
            padding: 0 !important;
            background: #ffffff !important;
          }

          .memorandum-page:nth-child(2) > header {
            min-height: 18mm !important;
            padding: 4mm 12mm !important;
            align-items: center !important;
            background: #07182f !important;
            border-bottom: 1.2mm solid #79b900 !important;
          }

          .memorandum-page:nth-child(2) > header img {
            height: 9mm !important;
          }

          .memorandum-page:nth-child(2) > header p:first-child {
            color: #ffffff !important;
          }

          .memorandum-page:nth-child(2) > header p:last-child {
            color: #9bd758 !important;
          }

          .memorandum-page:nth-child(2) > div:nth-of-type(1) {
            margin-top: 0 !important;
            padding: 5mm 12mm 2mm !important;
          }

          .memorandum-page:nth-child(2) > div:nth-of-type(1) h2 {
            margin-top: 1mm !important;
            font-size: 20px !important;
          }

          .memorandum-page:nth-child(2) > div:nth-of-type(2) {
            margin-top: 2mm !important;
            padding: 0 12mm !important;
            gap: 6mm !important;
          }

          .memorandum-page:nth-child(2) h3 {
            font-size: 11px !important;
          }

          .memorandum-page:nth-child(2) h3 + div {
            background: #79b900 !important;
          }

          .memorandum-page:nth-child(2) section > div[class*='rounded-2xl'],
          .memorandum-page:nth-child(2) section > div[class*='rounded-xl'] {
            border-radius: 2.2mm !important;
            border-color: #dbe3e9 !important;
            box-shadow: 0 1.2mm 4mm rgba(11, 22, 51, 0.06) !important;
          }

          .memorandum-page:nth-child(2) [class*='border-b-2'][class*='border-[#0B1633]'] {
            color: #ffffff !important;
            background: #07182f !important;
            border-bottom-color: #07182f !important;
          }

          .memorandum-page:nth-child(2) [class*='bg-[#F1F9E8]'] {
            background: #eff7e6 !important;
          }

          .memorandum-page:nth-child(2) section[class*='bg-[#0B1633]'] {
            position: relative !important;
            overflow: hidden !important;
            margin-top: 4mm !important;
            background: linear-gradient(135deg, #07182f 0%, #102b50 100%) !important;
            border-radius: 2.5mm !important;
            box-shadow: none !important;
          }

          .memorandum-page:nth-child(2) section[class*='bg-[#0B1633]'],
          .memorandum-page:nth-child(2) section[class*='bg-[#0B1633]'] p,
          .memorandum-page:nth-child(2) section[class*='bg-[#0B1633]'] h3 {
            color: #ffffff !important;
          }

          .memorandum-page:nth-child(2) section[class*='bg-[#0B1633]'] span,
          .memorandum-page:nth-child(2) section[class*='bg-[#0B1633]'] p:first-child {
            color: #95d44f !important;
          }

          .memorandum-page:nth-child(2) p[class*='text-slate-400'] {
            margin-top: 3mm !important;
            font-size: 5.5px !important;
            line-height: 2.7mm !important;
          }

          .memorandum-page img {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
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
