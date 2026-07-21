'use client'

import { useEffect } from 'react'

const HIDDEN_ROOF_LABELS = new Set(['Baugenehmigung', 'Gutachten', 'Umweltprüfung'])

export function RoofDevelopmentStatusFilter({ projectType }: { projectType: string }) {
  useEffect(() => {
    if (projectType !== 'pv_dach') return

    const applyFilter = () => {
      const forms = Array.from(document.querySelectorAll('form'))
      forms.forEach((form) => {
        Array.from(form.querySelectorAll('span')).forEach((labelNode) => {
          const label = labelNode.textContent?.trim()
          if (!label || !HIDDEN_ROOF_LABELS.has(label)) return

          const row = labelNode.closest('div.flex.items-center.justify-between') as HTMLElement | null
          if (!row) return

          row.style.display = 'none'
          row.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button').forEach((control) => {
            control.disabled = true
          })
        })
      })
    }

    applyFilter()
    const observer = new MutationObserver(applyFilter)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [projectType])

  return null
}
