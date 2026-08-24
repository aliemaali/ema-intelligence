'use client'

import { EmaVoice } from './EmaVoice'
import { useAuth } from '@/lib/hooks/useAuth'
import { getEmaVoiceUserName } from '@/lib/ema/voiceAccess'
import { usePathname } from 'next/navigation'

/**
 * Mount EMA voice once beneath the root AuthProvider so an active Realtime
 * WebRTC session survives client-side navigation between EMA sections.
 */
export function EmaVoiceGate({ standalone = false }: { standalone?: boolean }) {
  const { user, loading } = useAuth()
  const pathname = usePathname()

  // The app launcher stays completely minimal. The dedicated EMA AI route
  // mounts its own full-screen voice workspace.
  if (
    !standalone &&
    (pathname === '/apps' || pathname.startsWith('/apps/') ||
      pathname === '/ema' || pathname.startsWith('/ema/'))
  ) {
    return null
  }

  if (loading || !user) return null

  const userName = getEmaVoiceUserName(user.email)
  if (!userName) return null

  return <EmaVoice userName={userName} standalone={standalone} />
}
