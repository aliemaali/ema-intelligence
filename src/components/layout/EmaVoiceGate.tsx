'use client'

import { EmaVoice } from './EmaVoice'
import { useAuth } from '@/lib/hooks/useAuth'
import { getEmaVoiceUserName } from '@/lib/ema/voiceAccess'

/**
 * Mount EMA voice once beneath the root AuthProvider so an active Realtime
 * WebRTC session survives client-side navigation between EMA sections.
 */
export function EmaVoiceGate() {
  const { user, loading } = useAuth()

  if (loading || !user) return null

  const userName = getEmaVoiceUserName(user.email)
  if (!userName) return null

  return <EmaVoice userName={userName} />
}
