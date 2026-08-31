import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, FileText } from 'lucide-react'

type Props = {
  title: string
  description: string
  children: ReactNode
}

export function DocumentGeneratorPage({ title, description, children }: Props) {
  return (
    <main className="dms-premium min-h-screen px-3 pb-10 pt-[calc(env(safe-area-inset-top)+1rem)] md:px-7 md:py-7">
      <div className="mx-auto max-w-4xl">
        <header className="dms-hero mb-5 rounded-[2rem] p-5 md:p-7">
          <div className="flex items-center justify-between gap-4">
            <Link href="/dms" className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-extrabold text-white">
              <ArrowLeft className="h-4 w-4" /> DMS
            </Link>
            <Link href="/apps" aria-label="EMA Startzentrale">
              <Image src="/brand/ema-mark-white.png" alt="EMA" width={506} height={247} className="h-auto w-24" />
            </Link>
          </div>
          <div className="mt-6 flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#5CB800]/15 text-[#8eee51]">
              <FileText className="h-7 w-7" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#8eee51]">EMA DMS · Dokument erstellen</p>
              <h1 className="mt-1 text-3xl font-extrabold text-white md:text-4xl">{title}</h1>
              <p className="mt-1 text-sm text-slate-300">{description}</p>
            </div>
          </div>
        </header>
        {children}
      </div>
    </main>
  )
}
