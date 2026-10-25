'use client'

import { usePathname } from 'next/navigation'
import { BottomNav } from './BottomNav'
import { TopHeader } from './TopHeader'

interface AppShellProps {
  children: React.ReactNode
  user: {
    name:      string
    email:     string
    company:   string
    avatarUrl: string | null
  }
}

export function AppShell({ children, user }: AppShellProps) {
  const pathname = usePathname()
  return (
    <div className="app-shell">
      <div className={pathname === '/dashboard' ? 'app-main app-main--dashboard' : 'app-main'}>
        {pathname !== '/dashboard' ? <TopHeader /> : null}
        <main className="app-content animate-fade-in">
          {children}
        </main>
        <BottomNav user={user} />
      </div>
    </div>
  )
}
