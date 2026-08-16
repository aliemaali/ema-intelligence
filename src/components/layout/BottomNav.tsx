'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Archive,
  BellRing,
  Bot,
  BriefcaseBusiness,
  Building2,
  Calculator,
  CalendarDays,
  CheckSquare,
  ChevronRight,
  ClipboardPenLine,
  FileText,
  FolderOpen,
  Handshake,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  Send,
  Settings,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { logout } from '@/lib/actions/auth.actions'

const MAIN_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Projekte', href: '/projects', icon: FolderOpen },
  { label: 'Investoren', href: '/investors', icon: Building2 },
  { label: 'EMA AI', href: '/ai', icon: Bot },
] as const

const MORE_ITEMS = [
  { label: 'Meine Assistenz', href: '/assistant', icon: BellRing },
  { label: 'Projektarchiv', href: '/projects/archive', icon: Archive },
  { label: 'Exposé', href: '/expose', icon: FileText },
  { label: 'Versandcenter', href: '/versandcenter', icon: Send },
  { label: 'Dokumente', href: '/dokumente', icon: FileText },
  { label: 'Partner', href: '/partners', icon: Handshake },
  { label: 'Kalender', href: '/calendar', icon: CalendarDays },
  { label: 'Kundenaufnahme', href: '/customer-intake', icon: ClipboardPenLine },
  { label: 'CAPEX', href: '/capex', icon: Calculator },
  { label: 'Aufgaben', href: '/tasks', icon: CheckSquare },
  { label: 'Projekt-Import', href: '/project-import', icon: BriefcaseBusiness },
  { label: 'Einstellungen', href: '/settings', icon: Settings },
] as const

const HIDDEN_ROUTE_PATTERNS = [
  /^\/expose(?:\/|$)/,
  /^\/project-import(?:\/|$)/,
  /^\/projects\/new(?:\/|$)/,
  /^\/projects\/[^/]+\/(?:edit|documents)(?:\/|$)/,
]

export function BottomNav() {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => {
    setMoreOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!moreOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [moreOpen])

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  const navigationHidden = HIDDEN_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname))
  const moreActive = MORE_ITEMS.some((item) => isActive(item.href))

  if (navigationHidden) return null

  return (
    <>
      {moreOpen && (
        <div className="fixed inset-0 z-[200] md:hidden">
          <button
            type="button"
            aria-label="Menü schließen"
            onClick={() => setMoreOpen(false)}
            className="absolute inset-0 bg-[#07142F]/48 backdrop-blur-[3px]"
          />

          <section
            role="dialog"
            aria-modal="true"
            aria-label="Mehr Menü"
            className="absolute inset-x-2 bottom-2 max-h-[88dvh] overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-[0_28px_90px_rgba(7,20,47,0.28)]"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 pb-4 pt-5">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#5CB800]">EMA Intelligence</p>
                <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-[#07142F]">Mehr</h2>
              </div>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-[#07142F] transition active:scale-95"
                aria-label="Menü schließen"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[calc(88dvh-9.5rem)] overflow-y-auto overscroll-contain px-4 py-2" style={{ WebkitOverflowScrolling: 'touch' }}>
              {MORE_ITEMS.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      'flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2.5 transition active:scale-[0.99]',
                      active ? 'bg-[#5CB800]/10' : 'hover:bg-slate-50'
                    )}
                  >
                    <span className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                      active ? 'bg-[#5CB800] text-white' : 'bg-slate-100 text-[#07142F]'
                    )}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className={cn('min-w-0 flex-1 text-sm font-bold', active ? 'text-[#3D9200]' : 'text-[#07142F]')}>
                      {item.label}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                  </Link>
                )
              })}

              <form action={logout} className="mt-2 border-t border-slate-100 pb-2 pt-3">
                <button
                  type="submit"
                  className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-red-600 transition hover:bg-red-50 active:scale-[0.99]"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50">
                    <LogOut className="h-5 w-5" />
                  </span>
                  <span className="flex-1 text-sm font-bold">Abmelden</span>
                  <ChevronRight className="h-4 w-4 text-red-300" />
                </button>
              </form>
            </div>

            <div className="h-[env(safe-area-inset-bottom)] bg-white" />
          </section>
        </div>
      )}

      <nav className="app-bottom-nav" aria-label="Hauptnavigation">
        {MAIN_ITEMS.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-bold transition-all',
                active ? 'text-[#5CB800]' : 'text-slate-500 active:text-[#07142F]'
              )}
            >
              <Icon className={cn('h-[22px] w-[22px] transition-transform group-active:scale-90', active && 'stroke-[2.5]')} />
              <span className="max-w-full truncate">{item.label}</span>
              <span className={cn(
                'absolute bottom-1 h-1 w-1 rounded-full bg-[#5CB800] transition-opacity',
                active ? 'opacity-100' : 'opacity-0'
              )} />
            </Link>
          )
        })}

        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={cn(
            'group relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-bold transition-all',
            moreActive || moreOpen ? 'text-[#5CB800]' : 'text-slate-500 active:text-[#07142F]'
          )}
          aria-label="Mehr öffnen"
          aria-expanded={moreOpen}
        >
          <MoreHorizontal className={cn('h-[22px] w-[22px] transition-transform group-active:scale-90', (moreActive || moreOpen) && 'stroke-[2.5]')} />
          <span>Mehr</span>
          <span className={cn(
            'absolute bottom-1 h-1 w-1 rounded-full bg-[#5CB800] transition-opacity',
            moreActive || moreOpen ? 'opacity-100' : 'opacity-0'
          )} />
        </button>
      </nav>
    </>
  )
}
