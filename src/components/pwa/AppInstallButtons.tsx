'use client'

import { useEffect, useState } from 'react'
import { Download, Smartphone } from 'lucide-react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function AppInstallButtons() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIosHelp, setShowIosHelp] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
    setInstalled(standalone)

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }

    const handleInstalled = () => {
      setInstalled(true)
      setInstallPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  async function installAndroid() {
    if (!installPrompt) return
    await installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  if (installed) {
    return (
      <div className="mt-6 rounded-2xl border border-[#5CB800]/25 bg-[#5CB800]/10 px-4 py-3 text-center text-sm font-bold text-[#2F8A00]">
        EMA ist bereits auf diesem Gerät installiert.
      </div>
    )
  }

  return (
    <div className="mt-6">
      <p className="text-center text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Als App installieren</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setShowIosHelp((current) => !current)}
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-extrabold text-[#1F2A44] shadow-sm"
        >
          <Smartphone className="h-5 w-5" /> iOS
        </button>
        <button
          type="button"
          onClick={installAndroid}
          disabled={!installPrompt}
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#1F2A44] px-3 py-3 text-sm font-extrabold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Download className="h-5 w-5" /> Android
        </button>
      </div>

      {showIosHelp && (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-600">
          In Safari unten auf <strong>Teilen</strong> tippen und anschließend <strong>„Zum Home-Bildschirm“</strong> auswählen.
        </div>
      )}

      {!installPrompt && (
        <p className="mt-2 text-center text-xs text-slate-400">Android: Installation erscheint in Chrome, sobald sie verfügbar ist.</p>
      )}
    </div>
  )
}
