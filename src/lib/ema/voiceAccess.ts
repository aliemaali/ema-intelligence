const EMA_VOICE_USERS: Readonly<Record<string, string>> = {
  'unluer@ema-enterprise.de': 'Ali',
  'tuba.unluer@ema-enterprise.de': 'Tuba',
}

export function getEmaVoiceUserName(email: string | null | undefined) {
  if (!email) return null
  return EMA_VOICE_USERS[email.trim().toLocaleLowerCase('de-DE')] ?? null
}
