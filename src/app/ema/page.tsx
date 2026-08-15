import type { Metadata, Viewport } from 'next'
import { EmaVoiceGate } from '@/components/layout/EmaVoiceGate'

export const metadata: Metadata = {
  title: 'EMA AI',
  description: 'Die persönliche KI-Assistentin von EMA Intelligence',
  manifest: '/ema-ai-manifest.webmanifest',
  icons: {
    icon: '/icons/ema-ai-192.png',
    apple: '/icons/ema-ai-512.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'EMA AI',
  },
}

export const viewport: Viewport = {
  themeColor: '#07142F',
}

export default function EmaStandalonePage() {
  return (
    <main className="min-h-dvh bg-[#f6f8fb]">
      <EmaVoiceGate standalone />
    </main>
  )
}
