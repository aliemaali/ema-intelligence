'use client'

import { useEffect, useState } from 'react'
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

function getHeroImage() {
  return document.querySelector<HTMLImageElement>(".memorandum-page img[alt='Hochwertiges Projektmotiv']")
}

async function installPrintSafeHero() {
  const hero = getHeroImage()
  if (!hero) throw new Error('Hero image element not found')

  hero.removeAttribute('srcset')
  hero.removeAttribute('sizes')
  hero.src = '/ema-pv-freiflaeche-default.svg'
  hero.style.display = 'block'
  hero.style.visibility = 'visible'
  hero.style.opacity = '1'

  await new Promise<void>((resolve, reject) => {
    if (hero.complete && hero.naturalWidth > 0) {
      resolve()
      return
    }

    const timeout = window.setTimeout(() => reject(new Error('Hero image timed out')), 8000)
    hero.addEventListener('load', () => {
      window.clearTimeout(timeout)
      resolve()
    }, { once: true })
    hero.addEventListener('error', () => {
      window.clearTimeout(timeout)
      reject(new Error('Hero image failed to load'))
    }, { once: true })
  })

  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  await new Promise<void>((resolve) => window.setTimeout(resolve, 250))
}

async function waitForPrintableImages() {
  const images = Array.from(document.querySelectorAll<HTMLImageElement>('.memorandum-page img'))
  await Promise.all(images.map(async (image) => {
    if (image.complete && image.naturalWidth > 0) return
    await new Promise<void>((resolve) => {
      const finish = () => resolve()
      image.addEventListener('load', finish, { once: true })
      image.addEventListener('error', finish, { once: true })
      window.setTimeout(finish, 5000)
    })
  }))
}

export function PrintButton() {
  const [isPreparing, setIsPreparing] = useState(false)

  const print = async () => {
    if (isPreparing) return
    setIsPreparing(true)

    try {
      await installPrintSafeHero()
      await waitForPrintableImages()
      window.print()
    } catch (error) {
      console.error('PDF preparation failed:', error)
      window.alert('Das Projektbild konnte nicht vorbereitet werden. Bitte die Seite neu laden und erneut versuchen.')
    } finally {
      window.setTimeout(() => setIsPreparing(false), 700)
    }
  }

  useEffect(() => {
    installPrintSafeHero().catch((error) => {
      console.error('Hero image preload failed:', error)
    })

    const beforePrint = () => {
      const hero = getHeroImage()
      if (!hero) return
      hero.removeAttribute('srcset')
      hero.removeAttribute('sizes')
      hero.src = '/ema-pv-freiflaeche-default.svg'
      hero.style.display = 'block'
      hero.style.visibility = 'visible'
      hero.style.opacity = '1'
    }

    window.addEventListener('beforeprint', beforePrint)

    const match = window.location.pathname.match(/\/expose\/([^/]+)/)
    const projectId = match?.[1]
    let cancelled = false

    async function hydrateExposeValues() {
      if (!projectId) return
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
          setValuesForLabel('Amortisation', `${formatNumber(data.amortisation, 1)} Jahre`)
        }
      } catch {
        // Das Exposé bleibt auch ohne Nachladung nutzbar.
      }
    }

    hydrateExposeValues()

    return () => {
      cancelled = true
      window.removeEventListener('beforeprint', beforePrint)
    }
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
            object-position: center 58% !important;
            transform: none !important;
            filter: none !important;
            opacity: 1 !important;
            background: #e8eef2 !important;
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
