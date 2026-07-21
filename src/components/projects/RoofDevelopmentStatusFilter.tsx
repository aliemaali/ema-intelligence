'use client'

import { useEffect } from 'react'

const HIDDEN_ROOF_LABELS = new Set(['Baugenehmigung', 'Gutachten', 'Umweltprüfung'])

export function RoofDevelopmentStatusFilter({ projectType }: { projectType: string }) {
  useEffect(() => {
    if (projectType !== 'pv_dach') return

    const form = document.querySelector('form')
    if (!form) return

    const applyFilter = () => {
      const headings = Array.from(form.querySelectorAll('p')).filter((node) => node.textContent?.trim() === 'Entwicklungsstand')
      const section = headings[0]?.parentElement
      if (!section) return

      Array.from(section.children).forEach((row) => {
        const label = row.querySelector('span')?.textContent?.trim()
        if (!label || !HIDDEN_ROOF_LABELS.has(label)) return
        ;(row as HTMLElement).style.display = 'none'
        row.querySelectorAll<HTMLInputElement>('input').forEach((input) => {
          input.disabled = true
        })
      })
    }

    applyFilter()
    const timer = window.setTimeout(applyFilter, 100)
    return () => window.clearTimeout(timer)
  }, [projectType])

  return null
}
