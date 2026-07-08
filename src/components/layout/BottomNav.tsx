'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Bot,
  BriefcaseBusiness,
  Building2,
  Calculator,
  CheckSquare,
  FolderOpen,
  Handshake,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  UploadCloud,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { logout } from '@/lib/actions/auth.actions'

const MAIN_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Projekte', href: '/projects', icon: FolderOpen },
  { label: 'Import', href: '/project-import', icon: UploadCloud },
  { label: 'EMA AI', href: '/ai', icon: Bot },
] as const

const MORE_ITEMS = [
  { label: 'Investoren', href: '/investors', icon: Building2 },
  { label: 'Partner', href: '/partners', icon: Handshake },
  { label: 'CAPEX', href: '/capex', icon: Calculator },
  { label: 'Aufgaben', href: '/tasks', icon: CheckSquare },
  { label: 'Projekt-Import', href: '/project-import', icon: BriefcaseBusiness },
  { label: 'Einstellungen', href: '/settings', icon: Settings },
] as const

export function BottomNav() {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  const moreActive = MORE_ITEMS.some((item) => isActive(item.href))

  return (
    <>
      {moreOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Menü schließen"
            onClick={() => setMoreOpen(false)}
            className="absolute inset-0 bg-[#07142F]/30 backdrop-blur-[2px]"
          />

          <div className="absolute inset-x-0 bottom-0 rounded-t-[2rem] bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+6.5rem)] pt-4 shadow-2xl">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200" />
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#5CB800]">EMA Menü</p>
                <h2 className="text-2xl font-extrabold text-[#07142F]">Mehr</h2>
              </div>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-[#07142F]"
                aria-label="Menü schließen"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {MORE_ITEMS.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className="rounded-2xl border border-border/80 bg-white p-4 shadow-sm active:scale-[0.98]"
                  >
                    <Icon className="mb-3 h-6 w-6 text-[#5CB800]" />
                    <span className="text-sm font-extrabold text-[#07142F]">{item.label}</span>
                  </Link>
                )
              })}
            </div>

            <form action={logout} className="mt-3">
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm font-extrabold text-red-600"
              >
                <LogOut className="h-4 w-4" /> Abmelden
              </button>
            </form>
          </div>
        </div>
      )}

      <nav className="app-bottom-nav">
        {MAIN_ITEMS.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-1 px-2 py-2 min-w-[56px] flex-1',
                'text-xs font-medium transition-colors',
                active ? 'text-[#5CB800]' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className={cn('w-5 h-5', active && 'stroke-[2.5]')} />
              <span>{item.label}</span>
            </Link>
          )
        })}

        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={cn(
            'flex flex-col items-center gap-1 px-2 py-2 min-w-[56px] flex-1',
            'text-xs font-medium transition-colors',
            moreActive || moreOpen ? 'text-[#5CB800]' : 'text-muted-foreground hover:text-foreground'
          )}
          aria-label="Mehr öffnen"
        >
          <Menu className={cn('w-5 h-5', (moreActive || moreOpen) && 'stroke-[2.5]')} />
          <span>Mehr</span>
        </button>
      </nav>
    </>
  )
}
