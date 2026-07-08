'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const SOLDESK_DATENRAUM_URL = 'https://sonnenexpert.soldesk-portal.de/datenraum/'

type SoldeskActionResult = {
  success: boolean
  status: 'not_connected' | 'reachable' | 'blocked' | 'error'
  message: string
  details?: {
    portalUrl?: string
    httpStatus?: number
    nextStep?: string
  }
}

async function requireUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  return { supabase, userId: user.id }
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

export async function testSoldeskConnection(formData: FormData): Promise<SoldeskActionResult> {
  await requireUser()

  const username = getString(formData, 'username')
  const password = getString(formData, 'password')

  if (!username || !password) {
    return {
      success: false,
      status: 'not_connected',
      message: 'Bitte Soldesk-Benutzername und Passwort eingeben.',
      details: { portalUrl: SOLDESK_DATENRAUM_URL },
    }
  }

  try {
    const response = await fetch(SOLDESK_DATENRAUM_URL, {
      method: 'GET',
      cache: 'no-store',
      redirect: 'manual',
      headers: {
        'User-Agent': 'EMA-Intelligence-Soldesk-Connector/1.0',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })

    const reachable = response.status >= 200 && response.status < 500

    if (!reachable) {
      return {
        success: false,
        status: 'error',
        message: 'Soldesk ist aktuell nicht erreichbar. Bitte später erneut prüfen.',
        details: { portalUrl: SOLDESK_DATENRAUM_URL, httpStatus: response.status },
      }
    }

    return {
      success: true,
      status: 'reachable',
      message: 'Soldesk-Datenraum ist erreichbar. Der nächste Schritt ist der echte Login-Parser.',
      details: {
        portalUrl: SOLDESK_DATENRAUM_URL,
        httpStatus: response.status,
        nextStep: 'Login-Formular und Projekttabelle aus Soldesk auslesen.',
      },
    }
  } catch (error) {
    return {
      success: false,
      status: 'error',
      message: error instanceof Error ? error.message : 'Soldesk-Verbindung konnte nicht geprüft werden.',
      details: { portalUrl: SOLDESK_DATENRAUM_URL },
    }
  }
}

export async function syncSoldeskProjects(): Promise<SoldeskActionResult> {
  await requireUser()

  return {
    success: false,
    status: 'blocked',
    message: 'Synchronisierung ist vorbereitet. Für den echten Import fehlt noch der Soldesk Login-Parser.',
    details: {
      portalUrl: SOLDESK_DATENRAUM_URL,
      nextStep: 'Automatisierten Login, Projektliste und Dokument-Download implementieren.',
    },
  }
}
