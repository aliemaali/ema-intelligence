'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export function PasswordInput() {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <input
        id="password"
        name="password"
        type={visible ? 'text' : 'password'}
        autoComplete="current-password"
        required
        placeholder="••••••••"
        className="form-input pr-12"
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-500 transition hover:text-[#1F2A44]"
        aria-label={visible ? 'Passwort ausblenden' : 'Passwort anzeigen'}
        aria-pressed={visible}
      >
        {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
    </div>
  )
}
