'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, FolderOpen, Handshake, Users,
  Building2, Sparkles, Settings, Calculator,
  LogOut, ChevronRight, UploadCloud, Inbox,
} from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { logout } from '@/lib/actions/auth.actions'
import { NAV_ITEMS, NAV_ITEMS_SECONDARY } from '@/lib/types/constants'

interface SidebarProps {
  user: { name: string; email: string; company: string; avatarUrl: string | null }
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, FolderOpen, Handshake, Users, Building2,
  Sparkles, Settings, Calculator, UploadCloud,
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const isActive = (href: string) => href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)
  const submissionsActive = isActive('/partner-submissions')
  const primaryItems = NAV_ITEMS.filter((item) => !['/tasks', '/data-sources'].includes(item.href))
  const displayName = user.name.trim() === 'Ali Ünlü' ? 'Ali Ünlüer' : user.name

  return (
    <aside className="app-sidebar">
      <div className="px-5 py-6 border-b border-border">
        <Link href="/apps" className="block rounded-2xl border border-blue-300/15 bg-white/[.035] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.06),0_0_28px_rgba(117,238,53,.08)]" title="EMA Apps"><img src="/brand/ema-mark-white.png" alt="EMA Enterprise" className="h-auto w-[150px] object-contain drop-shadow-[0_0_18px_rgba(117,238,53,.25)]" /></Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {primaryItems.map((item) => {
          const Icon = ICON_MAP[item.iconName]
          const active = isActive(item.href)
          return (
            <Link key={item.href} href={item.href} className={cn('nav-item group', active && 'nav-item-active')}>
              {Icon && <Icon className={cn('w-5 h-5 shrink-0 transition-colors', active ? 'text-white' : 'text-[#132060]/80 group-hover:text-[#132060]')} />}
              <span className="truncate">{item.label}</span>
              {active && <ChevronRight className="w-4 h-4 ml-auto text-white/80" />}
              {item.badge !== undefined && item.badge > 0 && <span className="ml-auto inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#5CB800] text-white text-2xs font-semibold">{item.badge > 99 ? '99+' : item.badge}</span>}
            </Link>
          )
        })}

        <div className="pt-4 mt-4 border-t border-border">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/60">Partner</p>
          <Link href="/partner-submissions" className={cn('nav-item group', submissionsActive && 'nav-item-active')}>
            <Inbox className={cn('w-5 h-5 shrink-0 transition-colors', submissionsActive ? 'text-white' : 'text-[#132060]/80 group-hover:text-[#132060]')} />
            <span className="truncate">Partner-Einreichungen</span>
            {submissionsActive && <ChevronRight className="w-4 h-4 ml-auto text-white/80" />}
          </Link>
        </div>

        <div className="pt-4 mt-4 border-t border-border">
          {NAV_ITEMS_SECONDARY.map((item) => {
            const Icon = ICON_MAP[item.iconName]
            const active = isActive(item.href)
            return <Link key={item.href} href={item.href} className={cn('nav-item group relative', active && 'nav-item-active')}>{Icon && <Icon className={cn('w-5 h-5 shrink-0 transition-colors', active ? 'text-white' : 'text-[#132060]/80 group-hover:text-[#132060]')} />}<span className="truncate">{item.label}</span></Link>
          })}
        </div>
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 px-2 py-2 rounded-md">
          <div className="w-9 h-9 rounded-full bg-[#EEF2F7] flex items-center justify-center shrink-0">{user.avatarUrl ? <img src={user.avatarUrl} alt={displayName} className="w-9 h-9 rounded-full object-cover" /> : <span className="text-xs font-semibold text-[#132060]">{getInitials(displayName)}</span>}</div>
          <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-foreground truncate">{displayName}</p><p className="text-xs text-muted-foreground truncate">Administrator</p></div>
          <form action={logout}><button type="submit" title="Abmelden" className="btn-icon text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"><LogOut className="w-4 h-4" /></button></form>
        </div>
      </div>
    </aside>
  )
}
