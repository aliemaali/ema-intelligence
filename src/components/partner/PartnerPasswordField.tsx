'use client'

import { useState } from 'react'
import { Eye, EyeOff, KeyRound } from 'lucide-react'

const controlClassName = 'mt-2 w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[#07142F] [color-scheme:light] placeholder:text-slate-400'

export function PartnerPasswordField() {
  const [visible, setVisible] = useState(false)

  return (
    <label>
      <span className="text-sm font-bold">Passwort *</span>
      <div className="relative">
        <KeyRound className="pointer-events-none absolute left-4 top-1/2 mt-1 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          name="password"
          type={visible ? 'text' : 'password'}
          required
          minLength={6}
          autoComplete="new-password"
          className={`${controlClassName} pl-11 pr-12`}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute right-3 top-1/2 mt-1 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
          aria-label={visible ? 'Passwort ausblenden' : 'Passwort anzeigen'}
        >
          {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
      <span className="mt-1 block text-xs text-slate-500">Mindestens 6 Zeichen</span>
    </label>
  )
}
