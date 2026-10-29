'use client'

import { useEffect, useId, useRef } from 'react'
import Link from 'next/link'
import {
  Archive, BellRing, Bot, BriefcaseBusiness, Building2, Calculator,
  CalendarDays, CheckSquare, ChevronRight, ClipboardPenLine, FolderOpen,
  Grid2X2, Handshake, Inbox, LogOut, Mail, Send, Settings, Users, X,
  type LucideIcon,
} from 'lucide-react'
import { getInitials } from '@/lib/utils'
import { logout } from '@/lib/actions/auth.actions'
import styles from './compact-more-menu.module.css'

type MenuLink = { label: string; href: string; icon: LucideIcon }
type MenuEntry = MenuLink | { label: string; icon: LucideIcon; children: MenuLink[] }

export const MORE_ITEMS: MenuEntry[] = [
  { label: 'Hauptseite', href: '/apps', icon: Grid2X2 },
  { label: 'Assistenz', icon: BellRing, children: [
    { label: 'Meine Übersicht', href: '/assistant', icon: BellRing },
    { label: 'Mit EMA sprechen', href: '/ema', icon: Bot },
    { label: 'Aufgaben', href: '/tasks', icon: CheckSquare },
    { label: 'Kalender', href: '/calendar', icon: CalendarDays },
    { label: 'PLAUD-Archiv', href: '/archive/plaud', icon: Archive },
  ] },
  { label: 'Projekte', icon: FolderOpen, children: [
    { label: 'Projektübersicht', href: '/projects', icon: FolderOpen },
    { label: 'Deals', href: '/deals', icon: Handshake },
    { label: 'Projekt-Import', href: '/project-import', icon: BriefcaseBusiness },
    { label: 'Rechner', href: '/capex', icon: Calculator },
    { label: 'Projektarchiv', href: '/projects/archive', icon: Archive },
  ] },
  { label: 'Investoren', href: '/investors', icon: Building2 },
  { label: 'Partner', icon: Users, children: [
    { label: 'Partnerübersicht', href: '/partners', icon: Users },
    { label: 'Partner-Einreichungen', href: '/partner-submissions', icon: Inbox },
    { label: 'Kontaktarchiv', href: '/archive/contacts', icon: Archive },
  ] },
  { label: 'Kundenaufnahme', href: '/customer-intake', icon: ClipboardPenLine },
  { label: 'Kommunikation', icon: Mail, children: [
    { label: 'Microsoft 365', href: '/microsoft', icon: Mail },
    { label: 'Versandcenter', href: '/versandcenter', icon: Send },
  ] },
  { label: 'Einstellungen', icon: Settings, children: [
    { label: 'Einstellungen öffnen', href: '/settings', icon: Settings },
    { label: 'Archivübersicht', href: '/archive', icon: Archive },
  ] },
]

export const MORE_LINKS = MORE_ITEMS.flatMap(item => 'children' in item ? item.children : [item])

interface Props {
  displayName: string
  avatarUrl: string | null
  pathname: string
  onClose: () => void
}

export function CompactMoreMenu({ displayName, avatarUrl, pathname, onClose }: Props) {
  const panel = useRef<HTMLElement>(null)
  const titleId = useId()
  const activeHref = MORE_LINKS.filter(item => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => { if (previousFocus?.isConnected) previousFocus.focus() }
  }, [])

  function renderLink(item: MenuLink, nested = false) {
    const Icon = item.icon
    return <Link key={item.href} href={item.href} onClick={onClose}
      className={nested ? styles.childLink : styles.row} aria-current={item.href === activeHref ? 'page' : undefined}>
      <span className={styles.icon}><Icon aria-hidden="true" /></span>
      <span className={styles.label}>{item.label}</span>
      {!nested && <ChevronRight className={styles.chevron} aria-hidden="true" />}
    </Link>
  }

  return <div className={styles.layer}>
    <button type="button" tabIndex={-1} aria-label="Menü schließen" onClick={onClose} className={styles.backdrop} />
    <section ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} className={styles.panel}
      onKeyDown={event => {
        if (event.key !== 'Tab') return
        const focusable = Array.from(panel.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), summary') ?? [])
          .filter(element => element.getClientRects().length > 0)
        const first = focusable[0], last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }}>
      <header className={styles.header}>
        <span className={styles.avatar}>{avatarUrl ? <img src={avatarUrl} alt="" /> : getInitials(displayName)}</span>
        <div className={styles.identity}><p>EMA Intelligence</p><h2 id={titleId}>{displayName}</h2></div>
        <button type="button" onClick={onClose} className={styles.close} aria-label="Menü schließen"><X aria-hidden="true" /></button>
      </header>
      <nav className={styles.content} aria-label="Weitere Bereiche">
        {MORE_ITEMS.map(item => 'children' in item
          ? <details key={item.label} className={styles.group} open={item.children.some(child => child.href === activeHref) || undefined}>
              <summary className={styles.row}>
                <span className={styles.icon}><item.icon aria-hidden="true" /></span>
                <span className={styles.label}>{item.label}</span><ChevronRight className={styles.chevron} aria-hidden="true" />
              </summary>
              <div className={styles.children}>{item.children.map(child => renderLink(child, true))}</div>
            </details>
          : renderLink(item))}
      </nav>
      <form action={logout} className={styles.footer}>
        <button type="submit" className={styles.logout}><LogOut aria-hidden="true" /><span>Abmelden</span></button>
      </form>
    </section>
  </div>
}
