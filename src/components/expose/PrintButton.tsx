'use client'

import { useEffect } from 'react'
import { Download, Printer } from 'lucide-react'

function formatNumber(value: number, digits = 0) {
  return value.toLocaleString('de-DE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function formatMoney(value: number) {
  return value.toLocaleString('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  })
}

function setValuesForLabel(label: string, value: string) {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>('p, span'))
    .filter((node) => node.textContent?.trim() === label)

  for (const labelNode of nodes) {
    const parent = labelNode.parentElement
    if (!parent) continue
    const candidates = Array.from(parent.children).filter((child) => child !== labelNode) as HTMLElement[]
    const valueNode = candidates.find((child) => ['P', 'SPAN'].includes(child.tagName))
      ?? candidates[candidates.length - 1]
    if (valueNode) valueNode.textContent = value
  }
}

export function PrintButton() {
  const print = () => window.print()

  useEffect(() => {
    const match = window.location.pathname.match(/\/expose\/([^/]+)/)
    const projectId = match?.[1]
    if (!projectId) return

    let cancelled = false

    async function hydrateExposeValues() {
      try {
        const response = await fetch(`/api/expose-values/${projectId}`, { cache: 'no-store' })
        const data = await response.json()
        if (!response.ok || cancelled) return

        if (data.specificYield) {
          setValuesForLabel('Spezifischer Ertrag', `${formatNumber(data.specificYield)} kWh/kWp`)
        }

        if (data.tariff) {
          const tariffText = data.tariff <= 1
            ? `${formatNumber(data.tariff, 3)} €/kWh`
            : `${formatNumber(data.tariff, 2)} ct/kWh`
          setValuesForLabel('Vergütung', tariffText)
        }

        if (data.annualProduction) {
          setValuesForLabel('Jährlicher Ertrag', `${formatNumber(data.annualProduction)} kWh`)
        }

        if (data.annualRevenue) {
          setValuesForLabel('Jahreserlös', formatMoney(data.annualRevenue))
        }

        if (data.amortisation) {
          const amortisationText = `${formatNumber(data.amortisation, 1)} Jahre`
          setValuesForLabel('Amortisation', amortisationText)
        }
      } catch {
        // Das Exposé bleibt nutzbar, auch wenn die Nachladung fehlschlägt.
      }
    }

    hydrateExposeValues()
    return () => { cancelled = true }
  }, [])

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
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: #fff !important;
          }

          body > div,
          body main {
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }

          div:has(> .memorandum-page) {
            display: block !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }

          .memorandum-page {
            box-sizing: border-box !important;
            display: block !important;
            flex: none !important;
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
          }

          .memorandum-page + .memorandum-page {
            break-before: page !important;
            page-break-before: always !important;
          }

          .memorandum-page:not(:last-child),
          .memorandum-page:last-child {
            break-after: auto !important;
            page-break-after: auto !important;
          }

          .memorandum-page img[alt='Hochwertiges Projektmotiv'] {
            display: block !important;
            width: 100% !important;
            height: 100% !important;
            max-width: none !important;
            object-fit: cover !important;
            object-position: center 58% !important;
            transform: none !important;
            filter: none !important;
            opacity: 1 !important;
            background: #eef2f5 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .memorandum-page:first-child > section:first-of-type > div:nth-of-type(1) {
            background: linear-gradient(90deg, rgba(255,255,255,.72) 0%, rgba(255,255,255,.14) 43%, rgba(255,255,255,0) 70%) !important;
          }

          .memorandum-page:first-child > section:first-of-type > div:nth-of-type(2) {
            background: linear-gradient(0deg, rgba(255,255,255,.28) 0%, rgba(255,255,255,0) 100%) !important;
          }
        }
      `}</style>
      <div className="print:hidden flex flex-wrap gap-3">
        <button onClick={print} className="inline-flex items-center gap-2 rounded-2xl bg-[#5CB800] px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-[#5CB800]/20 transition hover:-translate-y-0.5 hover:bg-[#4EA000]">
          <Download className="h-4 w-4" /> Als PDF speichern
        </button>
        <button onClick={print} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-extrabold text-[#0B1633] shadow-sm transition hover:bg-slate-50">
          <Printer className="h-4 w-4" /> Drucken
        </button>
      </div>
    </>
  )
}
