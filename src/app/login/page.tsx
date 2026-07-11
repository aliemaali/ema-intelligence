import { login } from '@/lib/actions/auth.actions'

interface LoginPageProps {
  searchParams: { error?: string; redirectTo?: string }
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  const error = searchParams.error

  return (
    <div className="min-h-screen bg-white px-4 flex flex-col items-center justify-center">
      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-10">
          <img
            src="/ema-logo.jpeg"
            alt="EMA Enterprise GmbH"
            className="mx-auto mb-5 h-24 w-auto object-contain sm:h-28"
          />
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">
            EMA Intelligence
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            EMA Enterprise GmbH
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
            <p className="text-sm text-destructive">{decodeURIComponent(error)}</p>
          </div>
        )}

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
              placeholder="ali@ema-enterprise.de"
              className="form-input"
            />
          </div>

          <div>
            <label htmlFor="password" className="form-label">
              Passwort
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              className="form-input"
            />
          </div>

          <button
            type="submit"
            className="btn-primary w-full mt-2 h-11 font-semibold text-base rounded-lg"
          >
            Anmelden
          </button>
        </form>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} EMA Enterprise GmbH
        </p>
      </div>
    </div>
  )
}
