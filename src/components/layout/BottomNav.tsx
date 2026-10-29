'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FolderOpen, LayoutDashboard, MoreHorizontal, Users } from 'lucide-react'
import { CompactMoreMenu, MORE_LINKS } from './CompactMoreMenu'
import { cn } from '@/lib/utils'

const MAIN_ITEMS = [
  { label: 'Zentrale', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Projekte', href: '/projects', icon: FolderOpen },
  { label: 'Kontakte', href: '/microsoft', icon: Users },
] as const

const HIDDEN_ROUTE_PATTERNS = [
  /^\/expose(?:\/|$)/,
  /^\/project-import(?:\/|$)/,
  /^\/projects\/new(?:\/|$)/,
  /^\/projects\/[^/]+\/(?:edit|documents)(?:\/|$)/,
]

interface BottomNavProps {
  user: {
    name: string
    email: string
    company: string
    avatarUrl: string | null
  }
}

export function BottomNav({ user }: BottomNavProps) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => setMoreOpen(false), [pathname])
  useEffect(() => {
    if (!moreOpen) return
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [moreOpen])

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname === href || pathname.startsWith(`${href}/`)
  const navigationHidden = HIDDEN_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname))
  const moreActive = !MAIN_ITEMS.some((item) => isActive(item.href)) && MORE_LINKS.some((item) => isActive(item.href))
  const displayName = user.name.trim() === 'Ali Ünlü' ? 'Ali Ünlüer' : user.name

  if (navigationHidden) return null

  return (
    <>
      {moreOpen && <CompactMoreMenu displayName={displayName} avatarUrl={user.avatarUrl} pathname={pathname} onClose={() => setMoreOpen(false)} />}
      <nav className="app-bottom-nav" aria-label="Hauptnavigation">
        {MAIN_ITEMS.map((item) => { const Icon = item.icon; const active = isActive(item.href); return <Link key={item.href} href={item.href} className={cn('group relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-bold', active ? 'text-[#5CB800]' : 'text-slate-500')}><Icon className="h-[22px] w-[22px]" /><span className="truncate">{item.label}</span></Link> })}
        <button type="button" aria-haspopup="dialog" aria-expanded={moreOpen} onClick={() => setMoreOpen(true)} className={cn('group relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-bold', moreActive || moreOpen ? 'text-[#5CB800]' : 'text-slate-500')}><MoreHorizontal className="h-[22px] w-[22px]" /><span>Mehr</span></button>
      </nav>
    </>
  )
}
