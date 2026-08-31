import Image from 'next/image'
import { login } from '@/lib/actions/auth.actions'
import { PasswordInput } from '@/components/auth/PasswordInput'
import { PasskeyLoginButton } from '@/components/auth/PasskeyLoginButton'
import { AppInstallButtons } from '@/components/pwa/AppInstallButtons'

export const dynamic = 'force-dynamic'

interface LoginPageProps {
  searchParams: Promise<{ error?: string; redirectTo?: string }>
}

export default async function LoginPage(props: LoginPageProps) {
  const searchParams = await props.searchParams;
  const error = searchParams.error

  return (
    <div className="premium-page flex min-h-screen items-center justify-center px-4 py-8">
      <div className="premium-surface relative z-10 w-full max-w-md rounded-[2rem] border p-6 sm:p-9" style={{ '--premium-rgb': '117, 238, 53' } as React.CSSProperties}>
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
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-.04em] text-white">
            EMA Intelligence
          </h1>
          <p className="premium-muted mt-1 text-sm">
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
          <span className="premium-muted text-xs font-medium uppercase tracking-wide">
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

        <p className="premium-muted mt-10 text-center text-xs">
          © {new Date().getFullYear()} EMA Enterprise GmbH
        </p>
      </div>
    </div>
  )
}
