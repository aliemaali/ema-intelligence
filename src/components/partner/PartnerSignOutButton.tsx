'use client'

import { LogOut } from 'lucide-react'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function PartnerSignOutButton() {
  const [loading, setLoading] = useState(false)

  async function handleSignOut() {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={loading}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-[#1F2A44] shadow-sm transition hover:border-[#5CB800]/40 hover:text-[#2F8A00] disabled:cursor-wait disabled:opacity-60"
    >
      <LogOut className="h-4 w-4" />
      {loading ? 'Abmelden …' : 'Abmelden'}
    </button>
  )
}
