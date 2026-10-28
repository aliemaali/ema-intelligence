import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Grid2X2 } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Exposé | EMA Intelligence',
  description: 'Institutionelles Exposé für Energieprojekte',
}

export default function ExposeLayout({ children }: { children: React.ReactNode }) {
  return <>
    <header className="sticky top-0 z-40 border-b border-blue-200/15 bg-[#06152f]/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl print:hidden">
      <nav aria-label="EMA Exposé Navigation" className="mx-auto flex min-h-20 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/apps" aria-label="EMA Hauptseite öffnen" className="flex items-center gap-3 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8bf04a]">
          <Image src="/brand/ema-mark-white.png" alt="EMA" width={506} height={247} priority className="h-auto w-12 sm:w-16" />
          <span className="text-sm font-extrabold text-white sm:text-lg">EMA Exposé</span>
        </Link>
        <Link href="/apps" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-blue-200/20 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8bf04a]">
          <Grid2X2 className="h-4 w-4" aria-hidden="true" /> Hauptseite
        </Link>
      </nav>
    </header>
    {children}
  </>
}
