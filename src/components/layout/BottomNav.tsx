'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, FolderOpen, Users, CheckSquare, Plus, UploadCloud, Building2, Calculator } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_ITEMS_MOBILE } from '@/lib/types/constants'

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  FolderOpen,
  Users,
  CheckSquare,
  UploadCloud,
  Building2,
  Calculator,
}

export function BottomNav() {
  const pathname = usePathname()
  const router   = useRouter()

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  const handleFAB = () => router.push('/project-import')

  return (
    <nav className="app-bottom-nav">
      {NAV_ITEMS_MOBILE.slice(0, 2).map((item) => {
        const Icon   = ICON_MAP[item.iconName]
        const active = isActive(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-col items-center gap-1 px-4 py-2 min-w-[56px]',
              'text-xs font-medium transition-colors',
              active ? 'text-[#5CB800]' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {Icon && <Icon className={cn('w-5 h-5', active && 'stroke-[2.5]')} />}
            <span>{item.label}</span>
          </Link>
        )
      })}

      <div className="flex flex-col items-center justify-center px-2">
        <button
          onClick={handleFAB}
          className="w-12 h-12 rounded-full bg-[#5CB800] text-white shadow-lg shadow-[#5CB800]/30
                     flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Projekt importieren"
        >
          <Plus className="w-6 h-6" strokeWidth={2.5} />
        </button>
      </div>

      {NAV_ITEMS_MOBILE.slice(2, 4).map((item) => {
        const Icon   = ICON_MAP[item.iconName]
        const active = isActive(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-col items-center gap-1 px-4 py-2 min-w-[56px]',
              'text-xs font-medium transition-colors',
              active ? 'text-[#5CB800]' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {Icon && <Icon className={cn('w-5 h-5', active && 'stroke-[2.5]')} />}
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
