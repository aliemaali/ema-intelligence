'use client'

import Link from 'next/link'
import { Bell, Search } from 'lucide-react'

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
        <button
          className="mobile-header-action"
          type="button"
          title="Suche"
          aria-label="Suche"
        >
          <Search className="h-5 w-5" />
        </button>
        <button
          className="mobile-header-action relative"
          type="button"
          title="Benachrichtigungen"
          aria-label="Benachrichtigungen"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#5CB800]" />
        </button>
      </div>
    </header>
  )
}
