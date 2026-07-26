'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

export function DashboardTemplateShortcut() {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (pathname !== '/dashboard') return

    const buttons = document.querySelectorAll<HTMLButtonElement>('button.mobile-header-action')
    const button = buttons.item(1)
    if (!button) return

    button.title = 'Musterformulare öffnen'
    button.setAttribute('aria-label', 'Musterformulare öffnen')
    button.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M3 10h18"/></svg>'

    const openTemplates = () => router.push('/musterformulare')
    button.addEventListener('click', openTemplates)
    return () => button.removeEventListener('click', openTemplates)
  }, [pathname, router])

  return null
}
