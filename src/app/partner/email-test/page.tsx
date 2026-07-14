'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Loader2, MailCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Submission = {
  id: string
  project_name: string
}

export default function PartnerEmailTestPage() {
  const supabase = useMemo(() => createClient(), [])
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadLatestSubmission() {
      const { data, error: loadError } = await supabase
        .from('project_submissions')
        .select('id, project_name')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!active) return
      if (loadError) setError(loadError.message)
      else setSubmission(data)
      setLoading(false)
    }

    void loadLatestSubmission()
    return () => {
      active = false
    }
  }, [supabase])

  async function sendTest() {
    if (!submission) return
    setSending(true)
    setError(null)
    setMessage(null)

    try {
      const response = await fetch('/api/partner-submission-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: submission.id,
          event: 'updated',
          addedDocumentCount: 0,
        }),
      })

      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result.sent) {
        throw new Error(result.error || result.reason || 'Die Testmail konnte nicht gesendet werden.')
      }

      setMessage('Testmail wurde über Outlook versendet. Bitte das Postfach unluer@ema-enterprise.de prüfen.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Die Testmail konnte nicht gesendet werden.')
    } finally {
      setSending(false)
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl bg-white px-5 py-8 text-[#1F2A44] sm:px-8">
      <Link href="/partner" className="text-sm font-bold text-[#2F8A00]">← Zurück zum Partner-Dashboard</Link>
      <section className="mt-6 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-start gap-3">
          <MailCheck className="mt-1 h-7 w-7 text-[#2F8A00]" />
          <div>
            <h1 className="text-2xl font-extrabold">Outlook-Benachrichtigung testen</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">Die Seite löst eine echte Benachrichtigung für das zuletzt bearbeitete Partnerprojekt aus.</p>
          </div>
        </div>

        {loading ? (
          <div className="mt-8 flex items-center gap-2 text-sm font-semibold text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Projekt wird geladen …</div>
        ) : submission ? (
          <div className="mt-8">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Testprojekt</p>
              <p className="mt-1 text-lg font-extrabold">{submission.project_name}</p>
            </div>
            <button type="button" onClick={sendTest} disabled={sending} className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#5CB800] px-5 py-4 font-extrabold text-white disabled:opacity-60">
              {sending ? <><Loader2 className="h-5 w-5 animate-spin" /> Testmail wird gesendet …</> : 'Testmail jetzt senden'}
            </button>
          </div>
        ) : (
          <p className="mt-8 rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-800">Kein Partnerprojekt zum Testen gefunden.</p>
        )}

        {message && <p className="mt-5 rounded-2xl border border-[#5CB800]/25 bg-[#5CB800]/10 p-4 text-sm font-semibold text-[#2F8A00]">{message}</p>}
        {error && <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>}
      </section>
    </main>
  )
}
