'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, Clock3, FileText, FolderOpen, Info, Lock, RefreshCw, ShieldCheck, Sun, User, XCircle } from 'lucide-react'
import { syncSoldeskProjects, testSoldeskConnection } from '@/lib/actions/soldesk.actions'

type ConnectionState = 'not_connected' | 'checking' | 'reachable' | 'syncing' | 'blocked' | 'error'

type Step = {
  label: string
  done: boolean
}

const STATUS_LABELS: Record<ConnectionState, string> = {
  not_connected: 'Nicht verbunden',
  checking: 'Wird geprüft',
  reachable: 'Erreichbar',
  syncing: 'Synchronisiert',
  blocked: 'Vorbereitet',
  error: 'Fehler',
}

function StatusBadge({ status }: { status: ConnectionState }) {
  const className = status === 'reachable' || status === 'syncing'
    ? 'bg-[#5CB800]/10 text-[#2F8A00]'
    : status === 'checking'
      ? 'bg-amber-50 text-amber-700'
      : status === 'error'
        ? 'bg-red-50 text-red-600'
        : 'bg-slate-100 text-slate-600'

  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-extrabold ${className}`}>
      <span className="h-2 w-2 rounded-full bg-current opacity-60" />
      {STATUS_LABELS[status]}
    </span>
  )
}

function SyncStep({ step, index }: { step: Step; index: number }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2 shadow-sm">
      {step.done ? <CheckCircle2 className="h-5 w-5 text-[#5CB800]" /> : <XCircle className="h-5 w-5 text-slate-300" />}
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-extrabold text-[#07142F]">{index + 1}</span>
      <span className="text-sm font-bold text-[#07142F]">{step.label}</span>
    </div>
  )
}

function Metric({ icon: Icon, label, value, tone = 'green' }: { icon: any; label: string; value: string; tone?: 'green' | 'blue' | 'amber' }) {
  const toneClass = tone === 'blue' ? 'bg-blue-50 text-blue-600' : tone === 'amber' ? 'bg-amber-50 text-amber-600' : 'bg-[#5CB800]/10 text-[#2F8A00]'
  return (
    <div className="text-center">
      <div className={`mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl ${toneClass}`}>
        <Icon className="h-6 w-6" />
      </div>
      <p className="text-2xl font-black text-[#07142F]">{value}</p>
      <p className="mt-1 text-xs font-semibold leading-tight text-muted-foreground">{label}</p>
    </div>
  )
}

export function SoldeskConnectionPanel() {
  const [status, setStatus] = useState<ConnectionState>('not_connected')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('Gib deine Soldesk-Daten ein und prüfe zuerst die Verbindung.')
  const [lastChecked, setLastChecked] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const canConnect = username.trim().length > 0 && password.trim().length > 0
  const reachable = status === 'reachable' || status === 'syncing'

  const steps: Step[] = [
    { label: 'Login-Maske in EMA', done: true },
    { label: 'Soldesk erreichbar prüfen', done: reachable || status === 'blocked' },
    { label: 'Login-Parser entwickeln', done: false },
    { label: 'Projektliste abrufen', done: false },
    { label: 'Datenraum-Dokumente importieren', done: false },
  ]

  const handleConnectionCheck = () => {
    if (!canConnect) {
      setStatus('not_connected')
      setMessage('Bitte Benutzername und Passwort eingeben.')
      return
    }

    const formData = new FormData()
    formData.set('username', username)
    formData.set('password', password)

    startTransition(async () => {
      setStatus('checking')
      setMessage('Soldesk wird serverseitig geprüft ...')

      const result = await testSoldeskConnection(formData)
      setStatus(result.status === 'reachable' ? 'reachable' : result.status === 'error' ? 'error' : 'not_connected')
      setMessage(result.message)
      setLastChecked(new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }))
    })
  }

  const handleSync = () => {
    startTransition(async () => {
      setStatus('syncing')
      setMessage('Synchronisierung wird vorbereitet ...')

      const result = await syncSoldeskProjects()
      setStatus(result.status === 'blocked' ? 'blocked' : result.status === 'error' ? 'error' : 'syncing')
      setMessage(result.message)
    })
  }

  return (
    <div className="space-y-5">
      <div className="card-padded rounded-[2rem]">
        <div className="mb-5 flex items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#5CB800]/10 text-[#2F8A00]">
            <Sun className="h-8 w-8" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-3xl font-black tracking-[-0.04em] text-[#07142F]">Soldesk</h2>
              <StatusBadge status={status} />
            </div>
            <p className="mt-2 text-base leading-snug text-muted-foreground">
              Datenraum verbinden, Projekte erkennen und später automatisch importieren.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <label className="relative block rounded-2xl border border-border/80 bg-white px-4 py-4 shadow-sm">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">Benutzername / E-Mail</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Soldesk Login"
              autoComplete="username"
              className="mt-2 w-full bg-transparent pr-9 text-base font-extrabold text-[#07142F] outline-none"
            />
            <User className="absolute bottom-5 right-4 h-5 w-5 text-slate-400" />
          </label>

          <label className="relative block rounded-2xl border border-border/80 bg-white px-4 py-4 shadow-sm">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">Passwort</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              type="password"
              autoComplete="current-password"
              className="mt-2 w-full bg-transparent pr-9 text-base font-extrabold text-[#07142F] outline-none"
            />
            <Lock className="absolute bottom-5 right-4 h-5 w-5 text-slate-400" />
          </label>
        </div>

        <p className="mt-4 flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-4 text-sm font-bold leading-relaxed text-muted-foreground">
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-[#5CB800]" />
          Zugangsdaten werden aktuell nur zur Verbindungsprüfung benutzt und noch nicht dauerhaft gespeichert.
        </p>

        <button
          type="button"
          onClick={reachable ? handleSync : handleConnectionCheck}
          disabled={pending || (!reachable && !canConnect)}
          className="btn-primary mt-4 w-full justify-center py-4 text-base disabled:opacity-50"
        >
          {pending ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Sun className="h-5 w-5" />}
          {reachable ? 'Jetzt synchronisieren' : 'Soldesk verbinden'}
        </button>

        <div className="mt-4 rounded-2xl border border-border/70 bg-slate-50 p-4">
          <div className="flex gap-3">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" />
            <div className="min-w-0 flex-1">
              <p className="text-base font-black text-[#07142F]">{message}</p>
              {lastChecked && <p className="mt-2 text-sm font-bold text-muted-foreground">Zuletzt geprüft: {lastChecked}</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="card-padded rounded-[2rem]">
        <div className="mb-5 flex items-center gap-3">
          <ShieldCheck className="h-7 w-7 text-[#5CB800]" />
          <h3 className="text-2xl font-black tracking-[-0.04em] text-[#07142F]">Sync-Status</h3>
        </div>

        <div className="mb-6 grid grid-cols-4 gap-3">
          <Metric icon={FileText} label="Neue Projekte" value="0" />
          <Metric icon={FolderOpen} label="Dokumente bereit" value="0" tone="blue" />
          <Metric icon={Clock3} label="Letzte Sync" value="–" tone="amber" />
          <Metric icon={CheckCircle2} label="Verbindung" value={reachable ? 'OK' : '–'} />
        </div>

        <div className="space-y-3">
          {steps.map((step, index) => <SyncStep key={step.label} step={step} index={index} />)}
        </div>
      </div>
    </div>
  )
}
