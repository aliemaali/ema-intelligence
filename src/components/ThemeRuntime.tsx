'use client'

import { useEffect, useSyncExternalStore } from 'react'

type Theme = 'light' | 'dark'
const eventName = 'ema:theme-change'
const cookieName = 'ema-theme-v1'

/** Shared with Office. The cookie carries the choice between EMA subdomains. */

function currentTheme(): Theme {
  return document.documentElement.classList.contains('light') ? 'light' : 'dark'
}

function savedTheme(): Theme {
  try {
    const cookie = document.cookie.split('; ').find(value => value.startsWith(`${cookieName}=`))?.split('=')[1]
    if (cookie === 'light' || cookie === 'dark') return cookie
    const saved = localStorage.getItem('theme')
    if (saved === 'light' || saved === 'dark') return saved
  } catch { /* The current session still works when storage is unavailable. */ }
  return currentTheme()
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(theme)
  root.style.colorScheme = theme
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach(meta => {
    meta.removeAttribute('media')
    meta.content = theme === 'light' ? '#f4f8f6' : '#061521'
  })
}

function selectTheme(theme: Theme) {
  applyTheme(theme)
  try { localStorage.setItem('theme', theme) } catch { /* Session-only fallback. */ }
  try {
    const domain = location.hostname === 'ema-enterprise.de' || location.hostname.endsWith('.ema-enterprise.de')
      ? '; Domain=ema-enterprise.de' : ''
    document.cookie = `${cookieName}=${theme}; Path=/; Max-Age=31536000; SameSite=Lax${domain}${location.protocol === 'https:' ? '; Secure' : ''}`
  } catch { /* Session-only fallback. */ }
  window.dispatchEvent(new Event(eventName))
}

export function ThemeRuntime({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const sync = () => {
      applyTheme(savedTheme())
      window.dispatchEvent(new Event(eventName))
    }
    const storage = (event: StorageEvent) => {
      if (event.key === 'theme' || event.key === null) sync()
    }
    sync()
    window.addEventListener('storage', storage)
    window.addEventListener('focus', sync)
    window.addEventListener('pageshow', sync)
    return () => {
      window.removeEventListener('storage', storage)
      window.removeEventListener('focus', sync)
      window.removeEventListener('pageshow', sync)
    }
  }, [])
  return children
}

function subscribe(callback: () => void) {
  window.addEventListener(eventName, callback)
  return () => window.removeEventListener(eventName, callback)
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => null)
  const light = theme === 'light'
  const label = theme === null ? 'Darstellung wechseln' : light ? 'Dunkelmodus aktivieren' : 'Hellmodus aktivieren'
  return <button type="button" className="ema-theme-toggle" aria-label={label} title={label}
    onClick={() => selectTheme(currentTheme() === 'light' ? 'dark' : 'light')}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {light ? <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" /> : <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>}
    </svg>
  </button>
}
