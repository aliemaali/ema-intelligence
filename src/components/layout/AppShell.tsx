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
      <div className="app-main">
        {pathname !== '/dashboard' ? <TopHeader /> : null}
        <main className="app-content animate-fade-in">
          {children}
        </main>
      </div>
      <BottomNav user={user} />
    </div>
  )
}
