'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const SOLDESK_DATENRAUM_URL = 'https://sonnenexpert.soldesk-portal.de/datenraum/'
const SOLDESK_ORIGIN = 'https://sonnenexpert.soldesk-portal.de'

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
    detectedMode?: string
    discoveredUrls?: string[]
    apiEndpoint?: string
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
  mode: 'html-form' | 'spa' | 'api' | 'unknown'
  apiEndpoint?: string
  discoveredUrls: string[]
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

function sameOrigin(url: string) {
  try {
    return new URL(url).origin === SOLDESK_ORIGIN
  } catch {
    return false
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

function discoverClientUrls(html: string, pageUrl: string) {
  const urls = new Set<string>()
  const patterns = [
    /<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["']/gi,
    /["']([^"']*(?:api|auth|login|datenraum|projects?|documents?|expose|download)[^"']*)["']/gi,
  ]

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const raw = decodeHtml(match[1] ?? '').trim()
      if (!raw || raw.startsWith('data:') || raw.startsWith('mailto:')) continue
      const absolute = absolutizeUrl(pageUrl, raw)
      if (sameOrigin(absolute)) urls.add(absolute)
    }
  }

  return Array.from(urls).slice(0, 30)
}

function detectSpaMode(html: string) {
  const text = html.toLowerCase()
  return text.includes('__next') || text.includes('vite') || text.includes('webpack') || text.includes('react') || text.includes('app-root') || text.includes('root')
}

async function fetchSoldeskPage(url = SOLDESK_DATENRAUM_URL, cookies = '') {
  const response = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
    redirect: 'manual',
    headers: {
      'User-Agent': 'EMA-Intelligence-Soldesk-Connector/1.1',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      ...(cookies ? { Cookie: cookies } : {}),
    },
  })

  const html = await response.text().catch(() => '')
  return { response, html, cookies: parseCookies(response.headers), url }
}

async function findLoginSurface(initialHtml: string, initialCookies: string) {
  const loginCandidates = [
    SOLDESK_DATENRAUM_URL,
    `${SOLDESK_ORIGIN}/login`,
    `${SOLDESK_ORIGIN}/auth/login`,
    `${SOLDESK_ORIGIN}/signin`,
    `${SOLDESK_ORIGIN}/anmelden`,
    `${SOLDESK_ORIGIN}/`,
  ]

  const discovered = new Set<string>(discoverClientUrls(initialHtml, SOLDESK_DATENRAUM_URL))
  for (const url of loginCandidates) discovered.add(url)

  for (const url of Array.from(discovered).filter((candidate) => /login|signin|anmelden|datenraum|auth|portal/i.test(candidate))) {
    try {
      const page = url === SOLDESK_DATENRAUM_URL
        ? { html: initialHtml, response: { status: 200 } as Response, cookies: initialCookies, url }
        : await fetchSoldeskPage(url, initialCookies)
      const form = detectLoginForm(page.html, url)
      if (form) return { pageUrl: url, html: page.html, form, cookies: mergeCookies(initialCookies, page.cookies), discoveredUrls: Array.from(discovered) }
      discoverClientUrls(page.html, url).forEach((found) => discovered.add(found))
    } catch {
      // Keep probing other known candidates.
    }
  }

  return { pageUrl: SOLDESK_DATENRAUM_URL, html: initialHtml, form: null, cookies: initialCookies, discoveredUrls: Array.from(discovered) }
}

async function tryKnownApiLogin(username: string, password: string, cookies: string, discoveredUrls: string[]) {
  const endpoints = new Set<string>([
    `${SOLDESK_ORIGIN}/api/login`,
    `${SOLDESK_ORIGIN}/api/auth/login`,
    `${SOLDESK_ORIGIN}/api/authenticate`,
    `${SOLDESK_ORIGIN}/api/v1/login`,
    `${SOLDESK_ORIGIN}/api/v1/auth/login`,
    `${SOLDESK_ORIGIN}/login`,
    `${SOLDESK_ORIGIN}/auth/login`,
  ])

  discoveredUrls
    .filter((url) => /api|auth|login|authenticate/i.test(url))
    .forEach((url) => endpoints.add(url))

  const payloads = [
    { email: username, password },
    { username, password },
    { login: username, password },
  ]

  for (const endpoint of endpoints) {
    for (const payload of payloads) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          cache: 'no-store',
          redirect: 'manual',
          headers: {
            'User-Agent': 'EMA-Intelligence-Soldesk-Connector/1.1',
            Accept: 'application/json,text/plain,*/*',
            'Content-Type': 'application/json',
            Cookie: cookies,
            Referer: SOLDESK_DATENRAUM_URL,
          },
          body: JSON.stringify(payload),
        })

        const text = await response.text().catch(() => '')
        const responseCookies = mergeCookies(cookies, parseCookies(response.headers))
        const ok = response.status >= 200 && response.status < 300 && !/invalid|error|fehler|unauthorized|forbidden/i.test(text)

        if (ok || response.status === 302 || response.status === 303) {
          const dataRoom = await fetchSoldeskPage(SOLDESK_DATENRAUM_URL, responseCookies)
          return { ok: true, endpoint, cookies: responseCookies, html: dataRoom.html, status: dataRoom.response.status }
        }
      } catch {
        // Try next endpoint/payload combination.
      }
    }
  }

  return null
}

async function attemptSoldeskLogin(username: string, password: string): Promise<LoginResult> {
  const initial = await fetchSoldeskPage()
  const initialCookies = initial.cookies
  const surface = await findLoginSurface(initial.html, initialCookies)
  const discoveredUrls = surface.discoveredUrls.slice(0, 30)

  if (!surface.form) {
    const apiLogin = await tryKnownApiLogin(username, password, surface.cookies, discoveredUrls)
    if (apiLogin) {
      return {
        ok: true,
        html: apiLogin.html,
        cookies: apiLogin.cookies,
        status: apiLogin.status,
        message: 'Soldesk API-Login wurde ausgeführt. Projektliste kann als Nächstes ausgewertet werden.',
        form: null,
        mode: 'api',
        apiEndpoint: apiLogin.endpoint,
        discoveredUrls,
      }
    }

    const ok = looksLoggedIn(initial.html)
    const isSpa = detectSpaMode(initial.html)
    return {
      ok,
      html: initial.html,
      cookies: initialCookies,
      status: initial.response.status,
      message: ok
        ? 'Soldesk-Datenraum ist ohne klassisches Loginformular erreichbar.'
        : isSpa
          ? 'Soldesk ist erreichbar, aber als JavaScript-App geladen. EMA hat noch keinen passenden API-Login gefunden.'
          : 'Soldesk ist erreichbar, aber EMA konnte kein Loginformular erkennen.',
      form: null,
      mode: isSpa ? 'spa' : 'unknown',
      discoveredUrls,
    }
  }

  const form = surface.form
  if (!form.usernameField || !form.passwordField) {
    return {
      ok: false,
      html: surface.html,
      cookies: surface.cookies,
      status: initial.response.status,
      message: 'Loginformular erkannt, aber Benutzername- oder Passwortfeld fehlt.',
      form,
      mode: 'html-form',
      discoveredUrls,
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
      'User-Agent': 'EMA-Intelligence-Soldesk-Connector/1.1',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: surface.cookies,
      Referer: surface.pageUrl,
    },
    body: form.method === 'POST' ? body.toString() : undefined,
  })

  const loginCookies = mergeCookies(surface.cookies, parseCookies(loginResponse.headers))
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
    mode: 'html-form',
    discoveredUrls,
  }
}

function buildDetails(login: LoginResult, candidates: ReturnType<typeof extractProjectCandidates>, nextStep: string) {
  return {
    portalUrl: SOLDESK_DATENRAUM_URL,
    httpStatus: login.status,
    loginAction: login.form?.action,
    loginMethod: login.form?.method,
    loginFields: login.form?.inputs.map((input) => input.name).slice(0, 12),
    projectCount: candidates.projectCount,
    documentCount: candidates.documentCount,
    sampleProjects: candidates.sampleProjects,
    detectedMode: login.mode,
    apiEndpoint: login.apiEndpoint,
    discoveredUrls: login.discoveredUrls.slice(0, 8),
    nextStep,
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
      details: buildDetails(login, candidates, login.ok
        ? 'Projektliste strukturieren und echte Projektkarten daraus erzeugen.'
        : 'JS-App/API-Endpunkte auswerten und Login-Mapping anpassen.'),
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
        message: 'EMA konnte sich noch nicht sicher in Soldesk anmelden. Die Login-Art wurde analysiert und muss final gemappt werden.',
        details: buildDetails(login, candidates, 'Konkreten API-Endpunkt oder JS-Login-Flow fest verdrahten.'),
      }
    }

    return {
      success: true,
      status: 'reachable',
      message: `Soldesk Login erfolgreich. ${candidates.projectCount} mögliche Projekt-/Datenraum-Links und ${candidates.documentCount} Dokument-Links erkannt.`,
      details: buildDetails(login, candidates, 'Erkannte Links als Import-Vorschau anzeigen und Dublettenprüfung bauen.'),
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
