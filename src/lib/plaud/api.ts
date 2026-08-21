import { isIP } from 'net'
import type { PlaudContentBlock, PlaudRemoteRecording, PlaudRemoteRecordingDetails } from './types'

const PLAUD_API_BASE = 'https://platform.plaud.ai/developer/api'

async function plaudRequest<T>(accessToken: string, path: string): Promise<T> {
  const response = await fetch(`${PLAUD_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    cache: 'no-store',
  })
  const text = await response.text()
  let payload: any = {}
  try { payload = text ? JSON.parse(text) : {} } catch { payload = {} }
  if (!response.ok) throw new Error(payload?.detail || payload?.message || `PLAUD-Fehler (${response.status})`)
  return payload as T
}

export async function listPlaudRecordings(accessToken: string) {
  const payload = await plaudRequest<{ data?: PlaudRemoteRecording[] }>(accessToken, '/open/third-party/files/?page=1&page_size=100')
  return Array.isArray(payload.data) ? payload.data : []
}

export function getPlaudRecording(accessToken: string, fileId: string) {
  return plaudRequest<PlaudRemoteRecordingDetails>(accessToken, `/open/third-party/files/${encodeURIComponent(fileId)}`)
}

export async function revokePlaudAccess(accessToken: string) {
  const response = await fetch(`${PLAUD_API_BASE}/open/third-party/users/current/revoke`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!response.ok && response.status !== 401) throw new Error(`PLAUD-Zugriff konnte nicht widerrufen werden (${response.status}).`)
}

function assertPublicHttpsUrl(value: string) {
  const url = new URL(value)
  const host = url.hostname.toLowerCase()
  const ipVersion = isIP(host)
  if (url.protocol !== 'https:' || host === 'localhost' || host.endsWith('.local')) throw new Error('PLAUD lieferte einen unsicheren Inhaltslink.')
  if (ipVersion === 4 && /^(10\.|127\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(host)) throw new Error('PLAUD lieferte einen privaten Inhaltslink.')
  if (ipVersion === 6 && (host === '::1' || host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd'))) throw new Error('PLAUD lieferte einen privaten Inhaltslink.')
  return url
}

function contentToText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(contentToText).filter(Boolean).join('\n')
  if (typeof value !== 'object') return ''
  const row = value as Record<string, unknown>
  const text = contentToText(row.text ?? row.content ?? row.transcript ?? row.data)
  const speaker = contentToText(row.speaker ?? row.speaker_label ?? row.speaker_name)
  const time = contentToText(row.timestamp ?? row.start_time ?? row.start)
  if (text) return `${time ? `[${time}] ` : ''}${speaker ? `${speaker}: ` : ''}${text}`
  return Object.entries(row)
    .filter(([key]) => !['id', 'type', 'data_link'].includes(key))
    .map(([, item]) => contentToText(item))
    .filter(Boolean)
    .join('\n')
}

async function resolveBlock(block: PlaudContentBlock) {
  const inline = contentToText(block.data_content)
  if (inline) return inline
  if (!block.data_link) return ''
  const url = assertPublicHttpsUrl(block.data_link)
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error('Ein PLAUD-Inhalt konnte nicht geladen werden.')
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('json')) return contentToText(await response.json())
  return contentToText(await response.text())
}

export async function resolvePlaudBlocks(blocks: PlaudContentBlock[] | null | undefined) {
  if (!Array.isArray(blocks) || !blocks.length) return ''
  const resolved = await Promise.all(blocks.map(resolveBlock))
  return resolved.filter(Boolean).join('\n\n').trim()
}
