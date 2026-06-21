'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell } from 'lucide-react'
import { NAV_ITEMS, NAV_ITEMS_SECONDARY } from '@/lib/types/constants'

// Map paths to page titles for the header
const PAGE_TITLES: Record<string, string> = {
  '/dashboard':  'Dashboard',
  '/projects':   'Projekte',
  '/deals':      'Deals',
  '/partners':   'Partner',
  '/investors':  'Investoren',
  '/tasks':      'Aufgaben',
  '/settings':   'Einstellungen',
  '/ai':         'KI Tools',
}

function getPageTitle(pathname: string): string {
  // Exact match
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]

  // Prefix match (e.g. /projects/abc → Projekte)
  const allItems = [...NAV_ITEMS, ...NAV_ITEMS_SECONDARY]
  for (const item of allItems) {
    if (item.href !== '/dashboard' && pathname.startsWith(item.href)) {
      return item.label
    }
  }

  return 'EMA Intelligence'
}

export function TopHeader() {
  const pathname = usePathname()
  const title = getPageTitle(pathname)

  return (
    <header className="app-header">
      {/* Logo (left) */}
      <Link href="/dashboard" className="flex items-center gap-2">
        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-[#1F2A44]">
          <span className="text-[#5CB800] font-bold text-xs">EMA</span>
        </div>
        <span className="text-sm font-semibold text-foreground">
          {title}
        </span>
      </Link>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        <button
          className="btn-icon relative text-muted-foreground hover:text-foreground"
          title="Benachrichtigungen"
          aria-label="Benachrichtigungen"
        >
          <Bell className="w-5 h-5" />
          {/* Notification dot – will be dynamic later */}
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#5CB800]" />
        </button>
      </div>
    </header>
  )
}
