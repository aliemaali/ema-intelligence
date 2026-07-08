'use client'

import { useState } from 'react'
import { Cable, CheckCircle2, Lock, RefreshCw, ShieldCheck, Sun, XCircle } from 'lucide-react'

type ConnectionState = 'idle' | 'checking' | 'ready'

export function SoldeskConnectionPanel() {
  const [status, setStatus] = useState<ConnectionState>('idle')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('Noch nicht verbunden.')

  const canConnect = username.trim().length > 0 && password.trim().length > 0

  const handleConnectionCheck = () => {
    if (!canConnect) {
      setMessage('Bitte Benutzername und Passwort eingeben.')
      return
    }

    setStatus('checking')
    setMessage('Verbindung wird vorbereitet ...')

    window.setTimeout(() => {
      setStatus('ready')
      setMessage('Soldesk-Zugang ist in EMA vorbereitet. Der echte Server-Login folgt im nächsten Schritt.')
    }, 700)
  }

  const connected = status === 'ready'

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="card-padded rounded-[2rem] space-y-5">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5CB800]/10 text-[#2F8A00]">
            <Sun className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-extrabold text-[#07142F]">Soldesk verbinden</h2>
              <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${connected ? 'bg-[#5CB800]/10 text-[#2F8A00]' : 'bg-slate-100 text-slate-600'}`}>
                {connected ? 'Vorbereitet' : 'Nicht verbunden'}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Verbinde EMA Intelligence mit dem Soldesk-Datenraum, damit Projekte später direkt synchronisiert werden können.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          Zugangsdaten werden in diesem ersten Schritt noch nicht gespeichert. Das ist Absicht: erst bauen wir die sichere Maske, danach die verschlüsselte Speicherung im Backend.
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block rounded-2xl border border-border/80 bg-white px-4 py-3 shadow-sm">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">Benutzername / E-Mail</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Soldesk Login"
              autoComplete="username"
              className="mt-2 w-full bg-transparent text-sm font-extrabold text-[#07142F] outline-none"
            />
          </label>

          <label className="block rounded-2xl border border-border/80 bg-white px-4 py-3 shadow-sm">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">Passwort</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              type="password"
              autoComplete="current-password"
              className="mt-2 w-full bg-transparent text-sm font-extrabold text-[#07142F] outline-none"
            />
          </label>
        </div>

        <label className="flex items-start gap-3 rounded-2xl border border-border/80 bg-white px-4 py-3 shadow-sm">
          <input type="checkbox" disabled className="mt-1" />
          <span>
            <span className="block text-sm font-extrabold text-[#07142F]">Zugangsdaten verschlüsselt speichern</span>
            <span className="block text-xs text-muted-foreground">Kommt im nächsten Backend-Schritt mit sicherer Speicherung.</span>
          </span>
        </label>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleConnectionCheck}
            disabled={!canConnect || status === 'checking'}
            className="btn-primary justify-center py-3 disabled:opacity-50"
          >
            {status === 'checking' ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Cable className="h-5 w-5" />}
            Verbindung vorbereiten
          </button>
          <button
            type="button"
            disabled={!connected}
            className="rounded-xl bg-[#07142F] px-4 py-3 text-sm font-extrabold text-white disabled:opacity-40"
          >
            Jetzt synchronisieren
          </button>
        </div>

        <p className="rounded-2xl bg-slate-50 p-3 text-sm font-bold text-[#07142F]">{message}</p>
      </div>

      <div className="space-y-5">
        <div className="card-padded rounded-[2rem]">
          <div className="mb-4 flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-[#5CB800]" />
            <h3 className="text-lg font-extrabold text-[#07142F]">Sync-Plan</h3>
          </div>
          <div className="space-y-3">
            {[
              ['1', 'Login-Maske in EMA', true],
              ['2', 'Verschlüsselte Speicherung', false],
              ['3', 'Soldesk Login testen', false],
              ['4', 'Projektliste abrufen', false],
              ['5', 'Datenraum-Dokumente importieren', false],
            ].map(([step, label, done]) => (
              <div key={String(step)} className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2 shadow-sm">
                {done ? <CheckCircle2 className="h-5 w-5 text-[#5CB800]" /> : <XCircle className="h-5 w-5 text-slate-300" />}
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-extrabold text-[#07142F]">{step}</span>
                <span className="text-sm font-bold text-[#07142F]">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card-padded rounded-[2rem]">
          <div className="mb-4 flex items-center gap-3">
            <Lock className="h-5 w-5 text-[#5CB800]" />
            <h3 className="text-lg font-extrabold text-[#07142F]">Sicherheit</h3>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Der nächste wichtige Schritt ist ein serverseitiger Tresor für Soldesk-Zugangsdaten. Danach kann EMA die Anmeldung ausführen, ohne dass Zugangsdaten im Browser sichtbar gespeichert werden.
          </p>
        </div>
      </div>
    </div>
  )
}
