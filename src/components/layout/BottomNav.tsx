'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Archive, BellRing, Bot, BriefcaseBusiness, Building2, Calculator,
  CalendarDays, CheckSquare, ChevronRight, ClipboardPenLine, FileText,
  FolderOpen, Handshake, Inbox, LayoutDashboard, LogOut, Mail,
  MoreHorizontal, Send, Settings, Users, X,
} from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { logout } from '@/lib/actions/auth.actions'

const MAIN_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Projekte', href: '/projects', icon: FolderOpen },
  { label: 'Investoren', href: '/investors', icon: Building2 },
  { label: 'EMA AI', href: '/ai', icon: Bot },
] as const

const MORE_GROUPS = [
  {
    label: 'Arbeit',
    items: [
      { label: 'Meine Assistenz', href: '/assistant', icon: BellRing },
      { label: 'Aufgaben', href: '/tasks', icon: CheckSquare },
      { label: 'Kalender', href: '/calendar', icon: CalendarDays },
      { label: 'Microsoft 365', href: '/microsoft', icon: Mail },
      { label: 'Versandcenter', href: '/versandcenter', icon: Send },
    ],
  },
  {
    label: 'Projekte & Kontakte',
    items: [
      { label: 'Projekt-Import', href: '/project-import', icon: BriefcaseBusiness },
      { label: 'Deals', href: '/deals', icon: Handshake },
      { label: 'Partner', href: '/partners', icon: Users },
      { label: 'Partner-Einreichungen', href: '/partner-submissions', icon: Inbox },
      { label: 'Kundenaufnahme', href: '/customer-intake', icon: ClipboardPenLine },
      { label: 'Exposé', href: '/expose', icon: FileText },
    ],
  },
  {
    label: 'Werkzeuge',
    items: [
      { label: 'Rechner', href: '/capex', icon: Calculator },
      { label: 'Archiv', href: '/archive', icon: Archive },
      { label: 'Einstellungen', href: '/settings', icon: Settings },
    ],
  },
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
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)
  const navigationHidden = HIDDEN_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname))
  const moreActive = MORE_GROUPS.some((group) => group.items.some((item) => isActive(item.href)))
  const displayName = user.name.trim() === 'Ali Ünlü' ? 'Ali Ünlüer' : user.name

  if (navigationHidden) return null

  return (
    <>
      {moreOpen && (
        <div className="fixed inset-0 z-[200]">
          <button type="button" aria-label="Menü schließen" onClick={() => setMoreOpen(false)} className="absolute inset-0 bg-[#020817]/78 backdrop-blur-md" />
          <section role="dialog" aria-modal="true" aria-label="Mehr Menü" className="absolute bottom-2 left-1/2 max-h-[88dvh] w-[calc(100%_-_1rem)] max-w-2xl -translate-x-1/2 overflow-hidden rounded-[2rem] border border-blue-300/25 bg-[#06162f]/[.97] text-white shadow-[0_30px_100px_rgba(0,0,0,.58),0_0_45px_rgba(45,99,230,.16)] backdrop-blur-2xl">
            <div aria-hidden="true" className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-[#5CB800]/12 blur-3xl" />
            <div aria-hidden="true" className="pointer-events-none absolute -right-20 top-10 h-64 w-64 rounded-full bg-blue-600/15 blur-3xl" />
            <div className="relative flex items-center justify-between border-b border-white/10 px-5 pb-4 pt-5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[.06] text-sm font-extrabold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.08),0_0_24px_rgba(117,238,53,.10)]">{user.avatarUrl ? <img src={user.avatarUrl} alt={displayName} className="h-full w-full object-cover" /> : getInitials(displayName)}</span>
                <div className="min-w-0"><p className="text-[10px] font-extrabold uppercase tracking-[.22em] text-[#82ef45] drop-shadow-[0_0_12px_rgba(117,238,53,.28)]">EMA Intelligence</p><h2 className="truncate text-xl font-extrabold text-white">{displayName}</h2></div>
              </div>
              <button type="button" onClick={() => setMoreOpen(false)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[.06] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.08)]" aria-label="Menü schließen"><X className="h-5 w-5" /></button>
            </div>
            <div className="relative max-h-[calc(88dvh-7rem)] overflow-y-auto px-4 py-3 sm:grid sm:grid-cols-2 sm:gap-x-3">
              {MORE_GROUPS.map((group) => <div key={group.label} className="mb-3 break-inside-avoid"><p className="px-3 pb-1 pt-2 text-[10px] font-extrabold uppercase tracking-[.18em] text-slate-400">{group.label}</p>{group.items.map((item) => { const Icon = item.icon; const active = isActive(item.href); return <Link key={item.href} href={item.href} onClick={() => setMoreOpen(false)} className={cn('flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2.5', active ? 'border border-[#72df32]/30 bg-[#5CB800]/12 shadow-[0_0_24px_rgba(117,238,53,.07)]' : 'border border-transparent bg-white/[.025] hover:border-blue-300/15 hover:bg-white/[.055]')}><span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', active ? 'bg-[#5CB800] text-white shadow-[0_0_22px_rgba(117,238,53,.35)]' : 'border border-blue-300/12 bg-[#10294f] text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,.05)]')}><Icon className="h-5 w-5" /></span><span className={cn('flex-1 text-sm font-bold', active ? 'text-[#9af45e]' : 'text-white')}>{item.label}</span><ChevronRight className="h-4 w-4 text-slate-500" /></Link>})}</div>)}
              <form action={logout} className="border-t border-white/10 pb-2 pt-3 sm:col-span-2"><button type="submit" className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-red-600"><span className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-400/15 bg-red-400/10"><LogOut className="h-5 w-5" /></span><span className="flex-1 text-left text-sm font-bold">Abmelden</span></button></form>
            </div>
          </section>
        </div>
      )}
      <nav className="app-bottom-nav" aria-label="Hauptnavigation">
        {MAIN_ITEMS.map((item) => { const Icon = item.icon; const active = isActive(item.href); return <Link key={item.href} href={item.href} className={cn('group relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-bold', active ? 'text-[#5CB800]' : 'text-slate-500')}><Icon className="h-[22px] w-[22px]" /><span className="truncate">{item.label}</span></Link> })}
        <button type="button" onClick={() => setMoreOpen(true)} className={cn('group relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-bold', moreActive || moreOpen ? 'text-[#5CB800]' : 'text-slate-500')}><MoreHorizontal className="h-[22px] w-[22px]" /><span>Mehr</span></button>
      </nav>
    </>
  )
}
