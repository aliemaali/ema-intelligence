import Image from 'next/image'
import { login } from '@/lib/actions/auth.actions'
import { PasswordInput } from '@/components/auth/PasswordInput'
import { PasskeyLoginButton } from '@/components/auth/PasskeyLoginButton'
import { AppInstallButtons } from '@/components/pwa/AppInstallButtons'

interface LoginPageProps {
  searchParams: { error?: string; redirectTo?: string }
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  const error = searchParams.error

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(92,184,0,.12),transparent_34rem),radial-gradient(circle_at_bottom_right,rgba(19,32,96,.10),transparent_38rem),#f8fafc] px-4 py-8">
      <div className="relative z-10 w-full max-w-md rounded-[2rem] border border-white/80 bg-white/95 p-6 shadow-[0_28px_90px_rgba(7,20,47,.13)] backdrop-blur-xl sm:p-9">
        <div className="mb-8 text-center">
          <Image
            src="/brand/ema-logo.png"
            alt="EMA Enterprise GmbH"
            width={696}
            height={323}
            priority
            className="mx-auto mb-4 h-24 w-auto object-contain sm:h-28"
          />
          <p className="text-[11px] font-extrabold uppercase tracking-[.22em] text-[#5CB800]">EMA Enterprise</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-.04em] text-[#07142F]">
            EMA Intelligence
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            EMA Enterprise GmbH
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
            <p className="break-words text-sm leading-5 text-destructive">
              {decodeURIComponent(error)}
            </p>
          </div>
        )}

        <PasskeyLoginButton redirectTo={searchParams.redirectTo} />

        <div className="my-5 flex items-center gap-3" aria-hidden="true">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            oder mit Passwort
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form action={login} className="space-y-4">
          {searchParams.redirectTo && (
            <input type="hidden" name="redirectTo" value={searchParams.redirectTo} />
          )}

          <div>
            <label htmlFor="email" className="form-label">
              E-Mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              autoFocus
              required
              className="form-input"
            />
          </div>

          <div>
            <label htmlFor="password" className="form-label">
              Passwort
            </label>
            <PasswordInput />
          </div>

          <button
            type="submit"
            className="btn-primary w-full mt-2 h-11 font-semibold text-base rounded-lg"
          >
            Anmelden
          </button>
        </form>

        <AppInstallButtons />

        <p className="mt-10 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} EMA Enterprise GmbH
        </p>
      </div>
    </div>
  )
}
