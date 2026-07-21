'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

export function DashboardCalendarShortcut() {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (pathname !== '/dashboard') return

    // The dashboard has its own desktop header. Target the real button element,
    // not a link from another global/mobile header.
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button.mobile-header-action'))
    const button = buttons[0]
    if (!button) return

    button.title = 'Kalender öffnen'
    button.setAttribute('aria-label', 'Kalender öffnen')
    button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/></svg>'

    const openCalendar = () => router.push('/calendar')
    button.addEventListener('click', openCalendar)
    return () => button.removeEventListener('click', openCalendar)
  }, [pathname, router])

  return null
}
