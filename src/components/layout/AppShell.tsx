'use client'

import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { TopHeader } from './TopHeader'
import { AppIntro } from './AppIntro'
import { EmaVoice } from './EmaVoice'
import { getEmaVoiceUserName } from '@/lib/ema/voiceAccess'

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
  const emaVoiceUserName = getEmaVoiceUserName(user.email)

  return (
    <div className="app-shell">
      <AppIntro />
      {emaVoiceUserName && <EmaVoice userName={emaVoiceUserName} />}

      {/* ── Desktop Sidebar ──────────────────────────────────── */}
      <Sidebar user={user} />

      {/* ── Main Area ────────────────────────────────────────── */}
      <div className="app-main">

        {/* Mobile header (hidden on desktop) */}
        <TopHeader />

        {/* Page content */}
        <main className="app-content animate-fade-in">
          {children}
        </main>
      </div>

      {/* ── Mobile Bottom Navigation ─────────────────────────── */}
      <BottomNav />
    </div>
  )
}
