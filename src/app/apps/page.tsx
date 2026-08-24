import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Atom, Building2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

const officeUrl =
  process.env.NEXT_PUBLIC_EMA_OFFICE_URL ??
  'https://ema-office-git-feat-sprint13-16-operati-67ab21-ema-intelligence.vercel.app'

export default async function AppsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?redirectTo=/apps')

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#020b1b] px-4 py-8 sm:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_52%,rgba(92,184,0,.22),transparent_28%),radial-gradient(circle_at_88%_55%,rgba(39,94,255,.28),transparent_31%),linear-gradient(135deg,#020918_0%,#07162b_52%,#06112a_100%)]" />

      <div className="pointer-events-none absolute -left-[18%] top-[40%] h-24 w-[68%] -rotate-6 rounded-[100%] bg-gradient-to-r from-transparent via-[#70d51f]/55 to-transparent blur-2xl sm:h-32" />
      <div className="pointer-events-none absolute -right-[22%] top-[48%] h-28 w-[72%] rotate-6 rounded-[100%] bg-gradient-to-r from-transparent via-[#2b5cff]/55 to-transparent blur-3xl sm:h-36" />

      <div className="pointer-events-none absolute -bottom-[48%] left-[-15%] h-[66%] w-[130%] -rotate-3 rounded-[50%] border-[28px] border-[#102b55]/45 shadow-[0_-24px_70px_rgba(45,91,205,.20)] sm:-bottom-[52%] sm:border-[44px]" />
      <div className="pointer-events-none absolute -bottom-[56%] left-[-8%] h-[70%] w-[116%] rotate-2 rounded-[50%] border-[16px] border-[#5cb800]/10 shadow-[0_-12px_70px_rgba(92,184,0,.14)] sm:border-[24px]" />

      <section
        aria-label="EMA Anwendungen"
        className="relative z-10 flex w-full max-w-[58rem] flex-col items-center"
      >
        <Image
          src="/brand/ema-mark-white.png"
          alt="EMA"
          width={506}
          height={247}
          priority
          className="mb-10 h-auto w-20 object-contain drop-shadow-[0_0_24px_rgba(92,184,0,.22)] sm:mb-14 sm:w-24"
        />

        <div className="grid w-full grid-cols-2 gap-3 sm:gap-7">
          <Link
            href="/dashboard"
            aria-label="EMA Intelligence öffnen"
            className="group relative overflow-hidden rounded-[1.65rem] bg-gradient-to-br from-[#8bf32e]/80 via-white/35 to-[#4d78ff]/70 p-px shadow-[0_26px_70px_rgba(0,0,0,.34),0_0_46px_rgba(92,184,0,.12)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_34px_90px_rgba(0,0,0,.42),0_0_64px_rgba(92,184,0,.26)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#79dc24] focus-visible:ring-offset-4 focus-visible:ring-offset-[#020b1b]"
          >
            <div className="relative flex min-h-[16rem] flex-col items-center justify-center overflow-hidden rounded-[calc(1.65rem-1px)] bg-[#10233a]/88 px-3 py-7 backdrop-blur-2xl sm:min-h-[25rem] sm:px-8 sm:py-10">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(92,184,0,.16),transparent_38%),linear-gradient(145deg,rgba(255,255,255,.09),transparent_42%)]" />
              <div className="pointer-events-none absolute -left-16 -top-20 h-48 w-48 rounded-full border border-[#8bf32e]/15" />

              <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-[#8bf32e]/25 bg-[#08182b]/58 shadow-[inset_0_0_28px_rgba(92,184,0,.14),0_0_38px_rgba(92,184,0,.22)] sm:h-40 sm:w-40">
                <div className="absolute inset-3 rounded-full border border-[#8bf32e]/20 sm:inset-5" />
                <Atom className="h-14 w-14 text-[#8bf32e] drop-shadow-[0_0_14px_rgba(139,243,46,.65)] sm:h-24 sm:w-24" strokeWidth={1.25} />
              </div>

              <h1 className="relative mt-8 text-center text-base font-semibold tracking-[-.025em] text-white sm:mt-10 sm:text-3xl">
                EMA Intelligence
              </h1>
            </div>
          </Link>

          <a
            href={officeUrl}
            aria-label="EMA Office öffnen"
            className="group relative overflow-hidden rounded-[1.65rem] bg-gradient-to-br from-[#4b79ff]/85 via-white/40 to-[#76dd21]/55 p-px shadow-[0_26px_70px_rgba(0,0,0,.34),0_0_46px_rgba(48,91,255,.14)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_34px_90px_rgba(0,0,0,.42),0_0_64px_rgba(48,91,255,.27)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5d83ff] focus-visible:ring-offset-4 focus-visible:ring-offset-[#020b1b]"
          >
            <div className="relative flex min-h-[16rem] flex-col items-center justify-center overflow-hidden rounded-[calc(1.65rem-1px)] bg-[#10233a]/88 px-3 py-7 backdrop-blur-2xl sm:min-h-[25rem] sm:px-8 sm:py-10">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(54,103,255,.22),transparent_40%),linear-gradient(145deg,rgba(255,255,255,.09),transparent_42%)]" />
              <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full border border-[#5d83ff]/15" />

              <div className="relative flex h-24 w-24 items-center justify-center rounded-[1.8rem] border border-[#5d83ff]/25 bg-[#08182b]/58 shadow-[inset_0_0_28px_rgba(54,103,255,.16),0_0_38px_rgba(54,103,255,.24)] sm:h-40 sm:w-40 sm:rounded-[2.5rem]">
                <div className="absolute inset-3 rounded-[1.25rem] border border-[#5d83ff]/18 sm:inset-5 sm:rounded-[1.75rem]" />
                <Building2 className="h-14 w-14 text-[#76a2ff] drop-shadow-[0_0_14px_rgba(93,131,255,.72)] sm:h-24 sm:w-24" strokeWidth={1.15} />
              </div>

              <h2 className="relative mt-8 text-center text-base font-semibold tracking-[-.025em] text-white sm:mt-10 sm:text-3xl">
                EMA Office
              </h2>
            </div>
          </a>
        </div>
      </section>
    </main>
  )
}
