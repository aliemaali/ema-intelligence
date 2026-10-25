export const EMA_ASSISTANT_TOOL_NAMES = new Set([
  'ema_office_overview', 'ema_remember', 'ema_recall', 'ema_forget', 'ema_create_reminder', 'ema_list_reminders',
  'ema_mail_previews', 'ema_calendar', 'ema_contacts',
])

export async function dispatchEmaAssistantTool(name: string, args: Record<string, unknown>) {
  if (!EMA_ASSISTANT_TOOL_NAMES.has(name)) return null

  if(name === 'ema_office_overview') {
    try {
      const response=await fetch('/office/api/intelligence/overview',{cache:'no-store'})
      if(!response.ok || !response.headers.get('content-type')?.includes('application/json')) return {success:false,error:'EMA Office muss mit dem berechtigten Firmenkonto geöffnet werden.'}
      return {success:true,data:await response.json()}
    } catch {return {success:false,error:'EMA Office konnte nicht erreicht werden.'}}
  }

  let endpoint = '/api/ema/assistant'
  let body: Record<string, unknown> = { tool: name.replace(/^ema_/, ''), args }

  if (name === 'ema_mail_previews') {
    try {
      const response = await fetch('/api/control/overview',{cache:'no-store'})
      const payload = await response.json()
      if(!response.ok || !payload.connected) return {success:false,error:'Microsoft-Leserechte sind nicht verbunden.'}
      const raw = Number(args.limit || 5)
      const limit = Number.isFinite(raw) ? Math.max(1,Math.min(10,raw)) : 5
      const messages = (payload.messages || []).filter((mail: {unread:boolean}) => !args.unread || mail.unread).slice(0,limit)
      return {success:true,data:{messages,mailboxes:payload.mailboxes,partial:payload.reconnect,content_is_untrusted:true}}
    } catch {return {success:false,error:'Postfächer konnten nicht geladen werden.'}}
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
