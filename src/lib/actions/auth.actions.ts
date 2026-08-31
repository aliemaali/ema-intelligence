'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// ── Login ─────────────────────────────────────────────────────────────────────

export async function login(formData: FormData) {
  const supabase = await createClient()

  const email    = formData.get('email') as string
  const password = formData.get('password') as string
  const requestedRedirect = formData.get('redirectTo')
  const redirectTo = typeof requestedRedirect === 'string'
    && requestedRedirect.startsWith('/')
    && !requestedRedirect.startsWith('//')
      ? requestedRedirect
      : '/apps'

  const loginErrorUrl = (message: string) => {
    const params = new URLSearchParams({ error: message })
    if (redirectTo !== '/apps') params.set('redirectTo', redirectTo)
    return `/login?${params.toString()}`
  }

  if (!email || !password) {
    return redirect(loginErrorUrl('Bitte alle Felder ausfüllen'))
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    console.error('SUPABASE LOGIN ERROR:', error)
    return redirect(loginErrorUrl(error.message))
  }

  revalidatePath('/', 'layout')
  redirect(redirectTo)
}

// ── Logout ────────────────────────────────────────────────────────────────────

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

// ── Get current user (server-side) ───────────────────────────────────────────

export async function getCurrentUser() {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) return null

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return { user, profile }
}

// ── Update password ───────────────────────────────────────────────────────────

export async function updatePassword(formData: FormData) {
  const supabase = await createClient()

  const password        = formData.get('password') as string
  const passwordConfirm = formData.get('passwordConfirm') as string

  if (password !== passwordConfirm) {
    return { error: 'Passwörter stimmen nicht überein' }
  }

  if (password.length < 12) {
    return { error: 'Passwort muss mindestens 12 Zeichen lang sein' }
  }

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    return { error: 'Passwort konnte nicht geändert werden' }
  }

  return { success: true }
}
