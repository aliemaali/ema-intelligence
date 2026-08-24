'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Bell, FolderOpen } from 'lucide-react'
import { MicrosoftTeamsIcon } from '@/components/microsoft/MicrosoftTeamsIcon'

export function TopHeader() {
  return (
    <header className="app-header">
      <Link href="/apps" className="flex items-center gap-3" aria-label="EMA Startzentrale öffnen">
        <span className="ema-brand-logo" aria-hidden="true">
          <Image src="/brand/ema-mark-white.png" alt="" width={506} height={247} priority className="h-auto w-full" />
        </span>
        <span className="hidden text-lg font-extrabold tracking-tight text-white sm:block">EMA Intelligence</span>
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
