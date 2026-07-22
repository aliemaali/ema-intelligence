'use client'

import Link from 'next/link'
import { Bell } from 'lucide-react'
import { MicrosoftTeamsIcon } from '@/components/microsoft/MicrosoftTeamsIcon'

export function TopHeader() {
  return (
    <header className="app-header">
      <Link href="/dashboard" className="flex items-center">
        <img
          src="/ema-logo.jpeg"
          alt="EMA Enterprise"
          className="h-12 w-auto object-contain"
        />
      </Link>

      <div className="flex items-center gap-2">
        <Link
          href="/microsoft"
          className="mobile-header-action"
          title="Microsoft 365"
          aria-label="Outlook-Kontakte, Kalender und Teams öffnen"
        >
          <MicrosoftTeamsIcon className="h-6 w-6" />
        </Link>
        <Link
          href="/calendar"
          className="mobile-header-action relative"
          title="Benachrichtigungen"
          aria-label="Benachrichtigungen und EMA-Kalender öffnen"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#5CB800]" />
        </Link>
      </div>
    </header>
  )
}
