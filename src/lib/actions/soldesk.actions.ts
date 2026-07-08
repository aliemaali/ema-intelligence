'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const SOLDESK_DATENRAUM_URL = 'https://sonnenexpert.soldesk-portal.de/datenraum/'

type SoldeskStatus = 'not_connected' | 'reachable' | 'blocked' | 'error'

type SoldeskActionResult = {
  success: boolean
  status: SoldeskStatus
  message: string
  details?: {
    portalUrl?: string
    httpStatus?: number
    nextStep?: string
    loginAction?: string
    loginMethod?: string
    loginFields?: string[]
    projectCount?: number
    documentCount?: number
    sampleProjects?: string[]
  }
}

type LoginForm = {
  action: string
  method: 'GET' | 'POST'
  inputs: Array<{ name: string; type: string; value: string }>
  usernameField: string | null
  passwordField: string | null
}

type LoginResult = {
  ok: boolean
  html: string
  cookies: string
  status: number
  message: string
  form?: LoginForm | null
}

async function requireUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  return { supabase, userId: user.id }
}

function getString(formData: FormData | undefined, key: string) {
  const value = formData?.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function absolutizeUrl(base: string, value: string) {
  try {
    return new URL(value || base, base).toString()
  } catch {
    return base
  }
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function attr(tag: string, name: string) {
  const pattern = new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i')
  return decodeHtml(tag.match(pattern)?.[1] ?? '')
}

function parseCookies(headers: Headers) {
  const raw = headers.get('set-cookie')
  if (!raw) return ''

  return raw
    .split(/,(?=[^;,]+=)/g)
    .map((cookie) => cookie.split(';')[0]?.trim())
    .filter(Boolean)
    .join('; ')
}

function mergeCookies(...cookieHeaders: string[]) {
  const jar = new Map<string, string>()

  cookieHeaders
    .filter(Boolean)
    .join('; ')
    .split(';')
    .map((piece) => piece.trim())
    .filter(Boolean)
    .forEach((cookie) => {
      const index = cookie.indexOf('=')
      if (index <= 0) return
      jar.set(cookie.slice(0, index), cookie.slice(index + 1))
    })

  return Array.from(jar.entries()).map(([key, value]) => `${key}=${value}`).join('; ')
}

function detectLoginForm(html: string, pageUrl: string): LoginForm | null {
  const formMatches = Array.from(html.matchAll(/<form\b[\s\S]*?<\/form>/gi)).map((match) => match[0])
  const forms = formMatches.length ? formMatches : [html]

  for (const form of forms) {
    const inputs = Array.from(form.matchAll(/<input\b[^>]*>/gi)).map((match) => {
      const tag = match[0]
      return {
        name: attr(tag, 'name'),
        type: (attr(tag, 'type') || 'text').toLowerCase(),
        value: attr(tag, 'value'),
      }
    }).filter((input) => input.name)

    const passwordField = inputs.find((input) => input.type === 'password')?.name ?? null
    const usernameField = inputs.find((input) => {
      const raw = `${input.name} ${input.type}`.toLowerCase()
      return input.type === 'email' || raw.includes('email') || raw.includes('mail') || raw.includes('user') || raw.includes('login') || raw.includes('benutzer')
    })?.name ?? inputs.find((input) => input.type === 'text')?.name ?? null

    if (!passwordField && !usernameField) continue

    const action = absolutizeUrl(pageUrl, attr(form, 'action') || pageUrl)
    const method = ((attr(form, 'method') || 'POST').toUpperCase() === 'GET' ? 'GET' : 'POST') as 'GET' | 'POST'

    return { action, method, inputs, usernameField, passwordField }
  }

  return null
}

function looksLoggedIn(html: string) {
  const text = html.toLowerCase()
  const hasLoginWords = /passwort|password|einloggen|anmelden|login/.test(text)
  const hasDataRoomWords = /datenraum|projekt|expos[eé]|dokument|download/.test(text)
  return hasDataRoomWords && !hasLoginWords
}

function extractProjectCandidates(html: string) {
  const links = Array.from(html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi))
    .map((match) => ({
      href: decodeHtml(match[1] ?? ''),
      label: decodeHtml((match[2] ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()),
    }))
    .filter((link) => link.label || link.href)

  const projectLinks = links.filter((link) => /projekt|pva|pv|kwp|mwp|expos[eé]|datenraum|download/i.test(`${link.label} ${link.href}`))
  const documentLinks = links.filter((link) => /\.pdf|\.docx?|\.xlsx?|download|datei|dokument|expos[eé]/i.test(`${link.label} ${link.href}`))

  return {
    projectCount: projectLinks.length,
    documentCount: documentLinks.length,
    sampleProjects: projectLinks.slice(0, 5).map((link) => link.label || link.href),
  }
}

async function fetchSoldeskPage(url = SOLDESK_DATENRAUM_URL, cookies = '') {
  const response = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
    redirect: 'manual',
    headers: {
      'User-Agent': 'EMA-Intelligence-Soldesk-Connector/1.0',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      ...(cookies ? { Cookie: cookies } : {}),
    },
  })

  const html = await response.text().catch(() => '')
  return { response, html, cookies: parseCookies(response.headers) }
}

async function attemptSoldeskLogin(username: string, password: string): Promise<LoginResult> {
  const initial = await fetchSoldeskPage()
  const initialCookies = initial.cookies
  const form = detectLoginForm(initial.html, SOLDESK_DATENRAUM_URL)

  if (!form) {
    const ok = looksLoggedIn(initial.html)
    return {
      ok,
      html: initial.html,
      cookies: initialCookies,
      status: initial.response.status,
      message: ok
        ? 'Soldesk-Datenraum ist ohne Loginformular erreichbar.'
        : 'Soldesk ist erreichbar, aber EMA konnte kein Loginformular erkennen.',
      form: null,
    }
  }

  if (!form.usernameField || !form.passwordField) {
    return {
      ok: false,
      html: initial.html,
      cookies: initialCookies,
      status: initial.response.status,
      message: 'Loginformular erkannt, aber Benutzername- oder Passwortfeld fehlt.',
      form,
    }
  }

  const body = new URLSearchParams()
  for (const input of form.inputs) {
    if (input.type === 'submit' || input.type === 'button' || input.type === 'image') continue
    body.set(input.name, input.value ?? '')
  }
  body.set(form.usernameField, username)
  body.set(form.passwordField, password)

  const loginUrl = form.method === 'GET' ? `${form.action}?${body.toString()}` : form.action
  const loginResponse = await fetch(loginUrl, {
    method: form.method,
    cache: 'no-store',
    redirect: 'manual',
    headers: {
      'User-Agent': 'EMA-Intelligence-Soldesk-Connector/1.0',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: initialCookies,
      Referer: SOLDESK_DATENRAUM_URL,
    },
    body: form.method === 'POST' ? body.toString() : undefined,
  })

  const loginCookies = mergeCookies(initialCookies, parseCookies(loginResponse.headers))
  const location = loginResponse.headers.get('location')
  const followUrl = location ? absolutizeUrl(form.action, location) : SOLDESK_DATENRAUM_URL

  const final = await fetchSoldeskPage(followUrl, loginCookies)
  const finalCookies = mergeCookies(loginCookies, final.cookies)
  const ok = looksLoggedIn(final.html) || /30[12378]/.test(String(loginResponse.status))

  return {
    ok,
    html: final.html,
    cookies: finalCookies,
    status: final.response.status,
    message: ok
      ? 'Soldesk Login wurde serverseitig ausgeführt. Projektliste kann als Nächstes ausgewertet werden.'
      : 'Login wurde ausgeführt, aber EMA erkennt noch keine eingeloggte Datenraum-Seite.',
    form,
  }
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
    const login = await attemptSoldeskLogin(username, password)
    const candidates = extractProjectCandidates(login.html)

    return {
      success: login.ok,
      status: login.ok ? 'reachable' : 'blocked',
      message: login.message,
      details: {
        portalUrl: SOLDESK_DATENRAUM_URL,
        httpStatus: login.status,
        loginAction: login.form?.action,
        loginMethod: login.form?.method,
        loginFields: login.form?.inputs.map((input) => input.name).slice(0, 12),
        projectCount: candidates.projectCount,
        documentCount: candidates.documentCount,
        sampleProjects: candidates.sampleProjects,
        nextStep: login.ok
          ? 'Projektliste strukturieren und echte Projektkarten daraus erzeugen.'
          : 'Loginformular manuell prüfen und Feldnamen anpassen.',
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

export async function syncSoldeskProjects(formData?: FormData): Promise<SoldeskActionResult> {
  await requireUser()

  const username = getString(formData, 'username')
  const password = getString(formData, 'password')

  if (!username || !password) {
    return {
      success: false,
      status: 'not_connected',
      message: 'Bitte zuerst Soldesk-Zugangsdaten eingeben.',
      details: { portalUrl: SOLDESK_DATENRAUM_URL },
    }
  }

  try {
    const login = await attemptSoldeskLogin(username, password)
    const candidates = extractProjectCandidates(login.html)

    if (!login.ok) {
      return {
        success: false,
        status: 'blocked',
        message: 'EMA konnte sich noch nicht sicher in Soldesk anmelden. Login-Parser muss weiter angepasst werden.',
        details: {
          portalUrl: SOLDESK_DATENRAUM_URL,
          httpStatus: login.status,
          loginAction: login.form?.action,
          loginMethod: login.form?.method,
          nextStep: 'Soldesk HTML/Loginstruktur prüfen.',
        },
      }
    }

    return {
      success: true,
      status: 'reachable',
      message: `Soldesk Login erfolgreich. ${candidates.projectCount} mögliche Projekt-/Datenraum-Links und ${candidates.documentCount} Dokument-Links erkannt.`,
      details: {
        portalUrl: SOLDESK_DATENRAUM_URL,
        httpStatus: login.status,
        projectCount: candidates.projectCount,
        documentCount: candidates.documentCount,
        sampleProjects: candidates.sampleProjects,
        nextStep: 'Erkannte Links als Import-Vorschau anzeigen und Dublettenprüfung bauen.',
      },
    }
  } catch (error) {
    return {
      success: false,
      status: 'error',
      message: error instanceof Error ? error.message : 'Synchronisierung konnte nicht ausgeführt werden.',
      details: { portalUrl: SOLDESK_DATENRAUM_URL },
    }
  }
}
