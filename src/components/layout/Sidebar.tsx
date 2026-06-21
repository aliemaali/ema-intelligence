'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, FolderOpen, Handshake, Users,
  Building2, CheckSquare, Sparkles, Settings,
  LogOut, ChevronRight,
} from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { logout } from '@/lib/actions/auth.actions'
import { NAV_ITEMS, NAV_ITEMS_SECONDARY } from '@/lib/types/constants'

interface SidebarProps {
  user: {
    name:      string
    email:     string
    company:   string
    avatarUrl: string | null
  }
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  FolderOpen,
  Handshake,
  Users,
  Building2,
  CheckSquare,
  Sparkles,
  Settings,
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <aside className="app-sidebar">

      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-border">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#1F2A44] shrink-0 shadow">
          <span className="text-[#5CB800] font-bold text-sm">EMA</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">EMA Intelligence</p>
          <p className="text-xs text-muted-foreground truncate">Enterprise GmbH</p>
        </div>
      </div>

      {/* Primary Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-3 mb-2 text-2xs font-semibold uppercase tracking-widest text-muted-foreground/60">
          Navigation
        </p>

        {NAV_ITEMS.map((item) => {
          const Icon   = ICON_MAP[item.iconName]
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn('nav-item group', active && 'nav-item-active')}
            >
              {Icon && (
                <Icon className={cn(
                  'w-4 h-4 shrink-0 transition-colors',
                  active ? 'text-[#5CB800]' : 'text-muted-foreground group-hover:text-foreground'
                )} />
              )}
              <span className="truncate">{item.label}</span>
              {active && <ChevronRight className="w-3 h-3 ml-auto text-[#5CB800]" />}
              {item.badge !== undefined && item.badge > 0 && (
                <span className="ml-auto inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#5CB800] text-white text-2xs font-semibold">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </Link>
          )
        })}

        {/* Secondary Nav */}
        <div className="pt-4 mt-4 border-t border-border">
          <p className="px-3 mb-2 text-2xs font-semibold uppercase tracking-widest text-muted-foreground/60">
            Tools
          </p>
          {NAV_ITEMS_SECONDARY.map((item) => {
            const Icon        = ICON_MAP[item.iconName]
            const active      = isActive(item.href)
            const isComingSoon = item.href === '/ai'
            return (
              <Link
                key={item.href}
                href={isComingSoon ? '#' : item.href}
                aria-disabled={isComingSoon}
                className={cn(
                  'nav-item group relative',
                  active && !isComingSoon && 'nav-item-active',
                  isComingSoon && 'opacity-50 cursor-not-allowed pointer-events-none'
                )}
              >
                {Icon && (
                  <Icon className="w-4 h-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
                )}
                <span className="truncate">{item.label}</span>
                {isComingSoon && (
                  <span className="ml-auto text-2xs text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded font-medium">
                    v1.1
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* User + Logout */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 px-2 py-2 rounded-md">
          <div className="w-8 h-8 rounded-full bg-[#1F2A44] flex items-center justify-center shrink-0">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <span className="text-xs font-semibold text-[#5CB800]">{getInitials(user.name)}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.company}</p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              title="Abmelden"
              className="btn-icon text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  )
}
