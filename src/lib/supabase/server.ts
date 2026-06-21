import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Supabase client for use in:
 * - Server Components
 * - Server Actions
 * - Route Handlers (GET requests)
 *
 * Reads session from HTTP-only cookies (secure).
 */
export async function createClient() {
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

  const cookieStore = cookies()

  return createServerClient<any>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // setAll called from a Server Component – safe to ignore.
          // Middleware will handle session refresh.
        }
      },
    },
  })
}
