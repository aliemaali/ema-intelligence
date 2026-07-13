'use server'

import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const MAX_PAGE_BYTES = 1_000_000
const FETCH_TIMEOUT_MS = 8_000
const USER_AGENT = 'EMA-Scout/1.0 (+https://ema-enterprise.de)'

function text(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function normalizeUrl(value: string) {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`
  return new URL(withProtocol)
}

function isPrivateIpv4(address: string) {
  const parts = address.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return false
  const [a, b] = parts
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)
}

function isPrivateIpv6(address: string) {
  const normalized = address.toLowerCase()
  return normalized === '::1' || normalized === '::' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')
}

async function assertPublicUrl(url: URL) {
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Nur HTTP- und HTTPS-Adressen sind erlaubt.')
  const hostname = url.hostname.toLowerCase()
  if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) throw new Error('Interne Adressen sind nicht erlaubt.')

  if (isIP(hostname)) {
    if (isPrivateIpv4(hostname) || isPrivateIpv6(hostname)) throw new Error('Private Netzwerkadressen sind nicht erlaubt.')
    return
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true })
  if (!addresses.length) throw new Error('Die Website konnte nicht aufgelöst werden.')
  for (const entry of addresses) {
    if (isPrivateIpv4(entry.address) || isPrivateIpv6(entry.address)) throw new Error('Die Website verweist auf eine private Netzwerkadresse.')
  }
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function extractLinks(html: string, base: URL) {
  const links: URL[] = []
  const pattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  for (const match of html.matchAll(pattern)) {
    const href = match[1]
    const label = stripHtml(match[2]).toLowerCase()
    if (!/(kontakt|contact|impressum|imprint|unternehmen|about)/i.test(`${href} ${label}`)) continue
    try {
      const url = new URL(href, base)
      if (url.origin === base.origin && ['http:', 'https:'].includes(url.protocol)) links.push(url)
    } catch {
      // Ungültige Links ignorieren.
    }
  }
  return Array.from(new Map(links.map((url) => [url.href, url])).values()).slice(0, 2)
}

function extractEmails(content: string) {
  const decoded = content
    .replace(/\s*(\[at\]|\(at\)| at )\s*/gi, '@')
    .replace(/\s*(\[dot\]|\(dot\)| dot )\s*/gi, '.')
  const matches = decoded.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []
  return Array.from(new Set(matches.map((email) => email.toLowerCase())))
    .filter((email) => !/example\.|sentry\.|wixpress\.|cloudflare\./i.test(email))
}

function extractContact(textContent: string) {
  const rolePatterns = [
    /(?:geschäftsführer(?:in)?|geschäftsleitung|inhaber(?:in)?|managing director|ceo)\s*[:\-]?\s*([A-ZÄÖÜ][\p{L}'-]+(?:\s+[A-ZÄÖÜ][\p{L}'-]+){1,3})/iu,
    /([A-ZÄÖÜ][\p{L}'-]+(?:\s+[A-ZÄÖÜ][\p{L}'-]+){1,3})\s*[,\-]\s*(?:geschäftsführer(?:in)?|inhaber(?:in)?|managing director|ceo)/iu,
  ]
  for (const pattern of rolePatterns) {
    const match = textContent.match(pattern)
    if (match?.[1]) return { name: match[1].trim(), role: match[0].toLowerCase().includes('inhaber') ? 'Inhaber/in' : 'Geschäftsführung' }
  }
  return { name: null, role: null }
}

function detectIndustry(textContent: string) {
  const value = textContent.toLowerCase()
  const groups: Array<[string, string[]]> = [
    ['Logistik & Lager', ['logistik', 'spedition', 'transport', 'lagerhalle', 'fulfillment']],
    ['Industrie & Produktion', ['produktion', 'industrie', 'fertigung', 'maschinenbau', 'werkzeugbau']],
    ['Handel & Großhandel', ['großhandel', 'grosshandel', 'handel', 'distribution']],
    ['Immobilien & Bestand', ['immobilien', 'gewerbepark', 'property', 'bestandshalter']],
    ['Energie & Projektentwicklung', ['photovoltaik', 'solarpark', 'batteriespeicher', 'projektentwicklung', 'erneuerbare energien']],
  ]
  let best: { label: string; score: number } | null = null
  for (const [label, keywords] of groups) {
    const score = keywords.reduce((sum, keyword) => sum + (value.includes(keyword) ? 1 : 0), 0)
    if (score && (!best || score > best.score)) best = { label, score }
  }
  return best?.label || null
}

async function fetchHtml(url: URL) {
  await assertPublicUrl(url)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`Website antwortet mit Status ${response.status}.`)
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) throw new Error('Die Adresse liefert keine HTML-Seite.')
    const length = Number(response.headers.get('content-length') || 0)
    if (length > MAX_PAGE_BYTES) throw new Error('Die Website ist für die automatische Prüfung zu groß.')
    const html = (await response.text()).slice(0, MAX_PAGE_BYTES)
    const finalUrl = new URL(response.url || url.href)
    await assertPublicUrl(finalUrl)
    return { html, url: finalUrl }
  } finally {
    clearTimeout(timer)
  }
}

function recalculateScore(candidate: any, enriched: { email: string | null; contactName: string | null; industry: string | null }) {
  let score = Number(candidate.score || 0)
  if (!candidate.email && enriched.email) score += 20
  if (!candidate.contact_name && enriched.contactName) score += 10
  if (enriched.industry) score += 5
  return Math.min(score, 100)
}

export async function enrichResearchCandidate(formData: FormData) {
  const candidateId = text(formData, 'candidate_id')
  if (!candidateId) redirect('/acquisition/research/inbox?error=enrichment')

  const supabase = await createClient()
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: candidate } = await db
    .from('acquisition_research_candidates')
    .select('*')
    .eq('id', candidateId)
    .eq('user_id', user.id)
    .eq('status', 'new')
    .single()

  if (!candidate) redirect('/acquisition/research/inbox?error=enrichment')
  if (!candidate.website) {
    await db.from('acquisition_research_candidates').update({ enrichment_status: 'skipped', enrichment_error: 'Keine Website vorhanden.' }).eq('id', candidate.id).eq('user_id', user.id)
    revalidatePath('/acquisition/research/inbox')
    redirect('/acquisition/research/inbox?error=no-website')
  }

  await db.from('acquisition_research_candidates').update({ enrichment_status: 'running', enrichment_error: null }).eq('id', candidate.id).eq('user_id', user.id)

  try {
    const startUrl = normalizeUrl(candidate.website)
    const homepage = await fetchHtml(startUrl)
    const pages = [homepage]
    for (const link of extractLinks(homepage.html, homepage.url)) {
      try {
        pages.push(await fetchHtml(link))
      } catch {
        // Einzelne Kontakt- oder Impressumsseiten dürfen scheitern.
      }
    }

    const combinedHtml = pages.map((page) => page.html).join('\n')
    const combinedText = stripHtml(combinedHtml).slice(0, 250_000)
    const emails = extractEmails(combinedHtml)
    const contact = extractContact(combinedText)
    const industry = detectIndustry(combinedText)
    const contactPage = pages.find((page) => /(kontakt|contact|impressum|imprint)/i.test(page.url.pathname))?.url.href || null
    const email = candidate.email || emails[0] || null
    const contactName = candidate.contact_name || contact.name
    const contactRole = candidate.contact_role || contact.role
    const score = recalculateScore(candidate, { email, contactName, industry })
    const sources = pages.map((page) => ({ url: page.url.href, scanned_at: new Date().toISOString() }))

    await db.from('acquisition_research_candidates').update({
      website: homepage.url.origin,
      email,
      contact_name: contactName,
      contact_role: contactRole,
      industry,
      contact_url: contactPage,
      score,
      enrichment_status: 'completed',
      enrichment_error: null,
      enrichment_sources: sources,
      enriched_at: new Date().toISOString(),
    }).eq('id', candidate.id).eq('user_id', user.id)

    revalidatePath('/acquisition/research/inbox')
    redirect(`/acquisition/research/inbox?enriched=1&score=${score}`)
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : 'Website-Prüfung fehlgeschlagen.'
    await db.from('acquisition_research_candidates').update({
      enrichment_status: 'failed',
      enrichment_error: message,
      enriched_at: new Date().toISOString(),
    }).eq('id', candidate.id).eq('user_id', user.id)

    revalidatePath('/acquisition/research/inbox')
    redirect('/acquisition/research/inbox?error=enrichment')
  }
}
