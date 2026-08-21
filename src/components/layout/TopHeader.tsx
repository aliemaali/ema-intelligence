'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Bell, FolderOpen } from 'lucide-react'
import { MicrosoftTeamsIcon } from '@/components/microsoft/MicrosoftTeamsIcon'

export function TopHeader() {
  return (
    <header className="app-header">
      <Link href="/dashboard" className="flex items-center">
        <Image
          src="/brand/ema-logo.png"
          alt="EMA Enterprise"
          width={696}
          height={323}
          priority
          className="h-12 w-auto object-contain md:h-14"
        />
      </Link>

      <div className="flex items-center gap-2">
        <div id="ema-voice-header-action" className="contents" />
        <Link href="/microsoft" className="mobile-header-action" title="Microsoft 365" aria-label="Outlook-Kontakte, Kalender und Teams öffnen">
          <MicrosoftTeamsIcon className="h-6 w-6" />
        </Link>
        <Link href="/calendar" className="mobile-header-action relative" title="Benachrichtigungen" aria-label="Benachrichtigungen und EMA-Kalender öffnen">
          <Bell className="h-5 w-5" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#5CB800]" />
        </Link>
        <Link href="/dokumente" className="mobile-header-action" title="Dokumente" aria-label="Dokumente öffnen">
          <FolderOpen className="h-5 w-5" />
        </Link>
      </div>
    </header>
  )
}
