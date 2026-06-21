import { createBrowserClient } from '@supabase/ssr'

/**
 * Supabase client for use in Client Components ('use client').
 * Creates a new client instance per call (safe – SSR package handles this).
 */
export function createClient() {
  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      '❌ Supabase-Konfiguration fehlt.\n\n' +
      'NEXT_PUBLIC_SUPABASE_URL und/oder NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
      'sind nicht gesetzt.\n\n' +
      'Prüfe:\n' +
      '1. Existiert die Datei .env.local im Projekt-Root (gleiche Ebene wie package.json)?\n' +
      '2. Sind beide Werte darin eingetragen (ohne Anführungszeichen)?\n' +
      '3. Wurde der Dev-Server nach dem Anlegen/Ändern neu gestartet (npm run dev)?\n\n' +
      'Siehe ENV_SETUP_WINDOWS.md für eine Schritt-für-Schritt-Anleitung.'
    )
  }

  return createBrowserClient<any>(url, anonKey)
}
