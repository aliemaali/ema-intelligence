export const EMA_ASSISTANT_TOOL_NAMES = new Set([
  'ema_remember', 'ema_recall', 'ema_forget', 'ema_create_reminder', 'ema_list_reminders',
  'ema_mail_previews', 'ema_calendar', 'ema_contacts',
])

export async function dispatchEmaAssistantTool(name: string, args: Record<string, unknown>) {
  if (!EMA_ASSISTANT_TOOL_NAMES.has(name)) return null

  let endpoint = '/api/ema/assistant'
  let body: Record<string, unknown> = { tool: name.replace(/^ema_/, ''), args }

  if (name === 'ema_mail_previews') {
    endpoint = '/api/ema/assistant/microsoft'
    body = { tool: 'mail_previews', args }
  } else if (name === 'ema_calendar') {
    endpoint = '/api/ema/assistant/microsoft'
    body = { tool: 'calendar', args }
  } else if (name === 'ema_contacts') {
    endpoint = '/api/ema/assistant/microsoft'
    body = { tool: 'contacts', args }
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const payload = await response.json().catch(() => null) as { ok?: boolean; result?: unknown; error?: string } | null
    return response.ok && payload?.ok
      ? { success: true, data: payload.result }
      : { success: false, error: payload?.error ?? 'EMA konnte die persönliche Assistenzfunktion nicht ausführen.' }
  } catch {
    return { success: false, error: 'EMA konnte die persönliche Assistenzfunktion gerade nicht erreichen.' }
  }
}
