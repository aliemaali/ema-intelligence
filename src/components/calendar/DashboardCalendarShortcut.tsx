'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

export function DashboardCalendarShortcut() {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (pathname !== '/dashboard') return

    const button = document.querySelector<HTMLButtonElement>('button.mobile-header-action')
    if (!button) return

    button.title = 'Microsoft 365 öffnen'
    button.setAttribute('aria-label', 'Outlook-Kontakte, Kalender und Teams öffnen')
    button.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="2.5" y="6.5" width="11" height="11" rx="2.4" fill="#6264A7"/><path d="M6.2 9.1h5.1v1.7H9.7v4.1H7.8v-4.1H6.2V9.1Z" fill="white"/><circle cx="16.7" cy="6.4" r="2.2" fill="#7B83EB"/><circle cx="20.2" cy="8.1" r="1.6" fill="#9EA2FF"/><path d="M14.7 10.1h4.1c1 0 1.8.8 1.8 1.8v3.7c0 1-.8 1.8-1.8 1.8h-4.1v-7.3Z" fill="#7B83EB"/><path d="M19 11.2h1.9c.9 0 1.6.7 1.6 1.6v2.5c0 .9-.7 1.6-1.6 1.6H19v-5.7Z" fill="#9EA2FF"/></svg>'

    const openMicrosoft = () => router.push('/microsoft')
    button.addEventListener('click', openMicrosoft)
    return () => button.removeEventListener('click', openMicrosoft)
  }, [pathname, router])

  return null
}
