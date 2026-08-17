'use client'

import { BellRing, CheckCircle2, ChevronDown, XCircle } from 'lucide-react'
import { useState } from 'react'
import { useReminderPushStatus } from '@/hooks/useReminderPushStatus'

function DiagnosticRow({ label, ok }: { label: string; ok: boolean | null }) {
  const text = ok === null ? 'unbekannt' : ok ? 'ja' : 'nein'
  const color = ok === null ? 'text-slate-400' : ok ? 'text-emerald-600' : 'text-red-600'
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-1.5 text-sm last:border-0">
      <span className="text-slate-600">{label}</span>
      <span className={`font-semibold ${color}`}>{text}</span>
    </div>
  )
}

function PermissionRow({ permission }: { permission: NotificationPermission | 'unsupported' }) {
  const color = permission === 'granted' ? 'text-emerald-600' : permission === 'denied' ? 'text-red-600' : 'text-slate-400'
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-1.5 text-sm last:border-0">
      <span className="text-slate-600">Berechtigung</span>
      <span className={`font-semibold ${color}`}>{permission}</span>
    </div>
  )
}

export function ReminderPushStatus() {
  const { status, diagnostics, message, busy, reason, enable, disable } = useReminderPushStatus()
  const [showDiagnostics, setShowDiagnostics] = useState(false)

  return (
    <section className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <BellRing className="h-5 w-5" />
        <h2 className="text-xl font-semibold">iPhone-Erinnerungen</h2>
      </div>

      {status === 'checking' && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
          Status wird geprüft …
        </div>
      )}

      {status === 'active' && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl bg-emerald-50 px-4 py-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div>
            <p className="font-bold text-emerald-700">Erinnerungen aktiv</p>
            <p className="mt-0.5 text-sm text-emerald-700/80">EMA kann dich auch bei geschlossener App erinnern.</p>
          </div>
        </div>
      )}

      {status === 'inactive' && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl bg-red-50 px-4 py-3">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <p className="font-bold text-red-700">Erinnerungen nicht aktiv</p>
            {reason && <p className="mt-0.5 text-sm text-red-700/80">{reason}</p>}
          </div>
        </div>
      )}

      {status !== 'checking' && (
        <button
          onClick={status === 'active' ? disable : enable}
          disabled={busy}
          className="mt-4 rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white disabled:cursor-wait disabled:opacity-60"
        >
          {busy ? 'Wird verarbeitet …' : status === 'active' ? 'Erinnerungen deaktivieren' : 'Erinnerungen aktivieren'}
        </button>
      )}

      {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}

      <button
        type="button"
        onClick={() => setShowDiagnostics(v => !v)}
        className="mt-4 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400"
      >
        Diagnose
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showDiagnostics ? 'rotate-180' : ''}`} />
      </button>

      {showDiagnostics && (
        <div className="mt-2 rounded-2xl bg-slate-50 px-4 py-2">
          <DiagnosticRow label="PWA / Standalone" ok={diagnostics.standalone} />
          <DiagnosticRow label="Notifications unterstützt" ok={diagnostics.notificationsSupported} />
          <PermissionRow permission={diagnostics.permission} />
          <DiagnosticRow label="Service Worker registriert" ok={diagnostics.serviceWorkerRegistered} />
          <DiagnosticRow label="Service Worker aktiv" ok={diagnostics.serviceWorkerActive} />
          <DiagnosticRow label="Push-Subscription vorhanden" ok={diagnostics.subscriptionExists} />
          <DiagnosticRow label="Subscription serverseitig gespeichert" ok={diagnostics.subscriptionSavedServerSide} />
          <DiagnosticRow label="Erinnerungs-Scheduler funktionsfähig" ok={diagnostics.schedulerHealthy} />
        </div>
      )}
    </section>
  )
}
