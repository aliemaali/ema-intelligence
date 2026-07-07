'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, FolderOpen, Handshake, Users,
  Building2, CheckSquare, Sparkles, Settings, Calculator,
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
  Calculator,
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <aside className="app-sidebar">
      <div className="px-5 py-6 border-b border-border">
        <Link href="/dashboard" className="block">
          <img src="/ema-logo.jpeg" alt="EMA Enterprise" className="w-[150px] h-auto object-contain" />
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
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
                  'w-5 h-5 shrink-0 transition-colors',
                  active ? 'text-white' : 'text-[#132060]/80 group-hover:text-[#132060]'
                )} />
              )}
              <span className="truncate">{item.label}</span>
              {active && <ChevronRight className="w-4 h-4 ml-auto text-white/80" />}
              {item.badge !== undefined && item.badge > 0 && (
                <span className="ml-auto inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#5CB800] text-white text-2xs font-semibold">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </Link>
          )
        })}

        <div className="pt-4 mt-4 border-t border-border">
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
                  <Icon className={cn(
                    'w-5 h-5 shrink-0 transition-colors',
                    active ? 'text-white' : 'text-[#132060]/80 group-hover:text-[#132060]'
                  )} />
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

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 px-2 py-2 rounded-md">
          <div className="w-9 h-9 rounded-full bg-[#EEF2F7] flex items-center justify-center shrink-0">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <span className="text-xs font-semibold text-[#132060]">{getInitials(user.name)}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">Administrator</p>
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
