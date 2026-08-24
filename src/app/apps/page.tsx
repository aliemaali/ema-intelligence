import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  FolderKanban,
  LogOut,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/lib/actions/auth.actions'

const officeUrl =
  process.env.NEXT_PUBLIC_EMA_OFFICE_URL ??
  'https://ema-office-git-feat-sprint13-16-operati-67ab21-ema-intelligence.vercel.app'

function displayName(fullName: string | null | undefined, email: string | undefined) {
  const value = fullName?.trim() || email?.split('@')[0] || 'Team'
  return value.split(/\s+/)[0]
}

export default async function AppsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?redirectTo=/apps')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .maybeSingle()

  const firstName = displayName(profile?.full_name, user.email)

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f4f7fb] text-[#07142f]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-40 h-[34rem] w-[34rem] rounded-full bg-[#5cb800]/10 blur-3xl" />
        <div className="absolute -right-40 top-24 h-[38rem] w-[38rem] rounded-full bg-[#132060]/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.42)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.42)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:linear-gradient(to_bottom,black,transparent_78%)]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-5 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between rounded-[1.5rem] border border-white/80 bg-white/70 px-4 py-3 shadow-[0_16px_48px_rgba(15,23,42,.07)] backdrop-blur-2xl sm:px-5">
          <Image
            src="/brand/ema-logo.png"
            alt="EMA Enterprise"
            width={696}
            height={323}
            priority
            className="h-12 w-auto object-contain sm:h-14"
          />

          <div className="flex items-center gap-2">
            <div className="hidden rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 text-right sm:block">
              <p className="text-xs font-bold text-[#07142f]">{profile?.full_name || user.email}</p>
              <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-400">
                EMA Enterprise
              </p>
            </div>
            <form action={logout}>
              <button
                type="submit"
                title="Abmelden"
                aria-label="Abmelden"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200/80 bg-white/85 text-slate-500 shadow-sm transition hover:-translate-y-0.5 hover:text-[#07142f]"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </header>

        <section className="flex flex-1 flex-col justify-center py-12 sm:py-16 lg:py-20">
          <div className="mb-9 max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#5cb800]/15 bg-white/75 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[.18em] text-[#4e9f00] shadow-sm backdrop-blur-xl">
              <Sparkles className="h-3.5 w-3.5" />
              EMA Workspace
            </div>
            <h1 className="text-balance text-4xl font-extrabold tracking-[-.055em] text-[#07142f] sm:text-5xl lg:text-6xl">
              Willkommen, {firstName}.
              <span className="block text-slate-400">Womit möchtest du arbeiten?</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-500 sm:text-lg">
              Deine zentrale Startseite für Projektentwicklung und Unternehmensorganisation.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Link
              href="/dashboard"
              className="group relative min-h-[25rem] overflow-hidden rounded-[2rem] border border-white/15 bg-[linear-gradient(145deg,#07142f_0%,#132060_58%,#20379a_100%)] p-6 text-white shadow-[0_30px_80px_rgba(7,20,47,.24)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_36px_90px_rgba(7,20,47,.30)] sm:p-8"
            >
              <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full border border-white/10 bg-white/5 blur-sm" />
              <div className="pointer-events-none absolute bottom-0 left-0 h-44 w-full bg-[radial-gradient(circle_at_bottom_left,rgba(92,184,0,.25),transparent_65%)]" />

              <div className="relative flex h-full flex-col">
                <div className="flex items-start justify-between">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-inner backdrop-blur-xl">
                    <BarChart3 className="h-7 w-7 text-[#83df25]" />
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-white/80 backdrop-blur-xl">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#83df25]" />
                    Betriebsbereit
                  </span>
                </div>

                <div className="mt-auto">
                  <p className="mb-2 text-xs font-extrabold uppercase tracking-[.22em] text-[#83df25]">
                    Projektplattform
                  </p>
                  <h2 className="text-3xl font-extrabold tracking-[-.04em] sm:text-4xl">
                    EMA Intelligence
                  </h2>
                  <p className="mt-3 max-w-md text-sm leading-6 text-white/68 sm:text-base">
                    Projekte, Investoren, Transaktionen und Analysen für erneuerbare Energien.
                  </p>

                  <div className="mt-7 flex items-center justify-between border-t border-white/12 pt-5">
                    <div className="flex items-center gap-4 text-xs font-semibold text-white/55">
                      <span className="inline-flex items-center gap-1.5">
                        <FolderKanban className="h-4 w-4" />
                        Projekte
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <ShieldCheck className="h-4 w-4" />
                        Geschützt
                      </span>
                    </div>
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#132060] shadow-lg transition group-hover:translate-x-1">
                      <ArrowRight className="h-5 w-5" />
                    </span>
                  </div>
                </div>
              </div>
            </Link>

            <a
              href={officeUrl}
              className="group relative min-h-[25rem] overflow-hidden rounded-[2rem] border border-white/90 bg-white/82 p-6 shadow-[0_30px_80px_rgba(15,23,42,.12)] backdrop-blur-2xl transition duration-300 hover:-translate-y-1 hover:border-[#5cb800]/25 hover:shadow-[0_36px_90px_rgba(15,23,42,.16)] sm:p-8"
            >
              <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#5cb800]/10 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-[#132060]/8 blur-3xl" />

              <div className="relative flex h-full flex-col">
                <div className="flex items-start justify-between">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#f1f7eb,#ffffff)] text-[#4e9f00] shadow-[inset_0_0_0_1px_rgba(92,184,0,.12),0_12px_32px_rgba(92,184,0,.10)]">
                    <Building2 className="h-7 w-7" />
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#5cb800]/15 bg-[#5cb800]/8 px-3 py-1.5 text-xs font-bold text-[#4e9f00]">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Preview bereit
                  </span>
                </div>

                <div className="mt-auto">
                  <p className="mb-2 text-xs font-extrabold uppercase tracking-[.22em] text-[#4e9f00]">
                    Unternehmenszentrale
                  </p>
                  <h2 className="text-3xl font-extrabold tracking-[-.04em] text-[#07142f] sm:text-4xl">
                    EMA Office
                  </h2>
                  <p className="mt-3 max-w-md text-sm leading-6 text-slate-500 sm:text-base">
                    Aufgaben, Termine, Kontakte, Dokumente, Rechnungen und interne Abläufe.
                  </p>

                  <div className="mt-7 flex items-center justify-between border-t border-slate-200/80 pt-5">
                    <div className="flex items-center gap-4 text-xs font-semibold text-slate-400">
                      <span className="inline-flex items-center gap-1.5">
                        <Building2 className="h-4 w-4" />
                        Office
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <ShieldCheck className="h-4 w-4" />
                        Geschützt
                      </span>
                    </div>
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#07142f] text-white shadow-lg transition group-hover:translate-x-1">
                      <ArrowRight className="h-5 w-5" />
                    </span>
                  </div>
                </div>
              </div>
            </a>
          </div>

          <p className="mt-7 flex items-center justify-center gap-2 text-center text-xs font-medium text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            Der Zugriff richtet sich weiterhin nach deinem persönlichen Benutzerkonto.
          </p>
        </section>
      </div>
    </main>
  )
}
