import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ProjectImportClient } from '@/components/project-import/ProjectImportClient'

export const metadata = { title: 'Projekt-Import' }

const steps = [
  { number: '01', title: 'Upload' },
  { number: '02', title: 'Analyse' },
  { number: '03', title: 'Prüfen' },
  { number: '04', title: 'Erstellen' },
]

export default function ProjectImportPage() {
  return (
    <div className="page-container space-y-4 pt-14 md:space-y-8 md:pt-8">
      <section className="relative overflow-hidden rounded-[2rem] bg-white/80 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] md:rounded-[2.2rem] md:p-8">
        <div className="absolute right-0 top-0 h-40 w-40 translate-x-16 -translate-y-16 rounded-full bg-[#5CB800]/10 md:h-52 md:w-52" />
        <div className="absolute bottom-0 right-16 h-24 w-24 rounded-full bg-[#132060]/5 md:h-32 md:w-32" />

        <div className="relative max-w-3xl">
          <Link href="/dashboard" className="mb-6 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-extrabold text-[#07142F] shadow-sm ring-1 ring-border/80">
            <ArrowLeft className="h-4 w-4" /> Zurück zum Dashboard
          </Link>

          <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.24em] text-[#5CB800] md:mb-3 md:tracking-[0.28em]">Projekt-Import</p>
          <h1 className="text-3xl font-extrabold leading-[1] tracking-[-0.055em] text-[#07142F] sm:text-5xl md:text-6xl">
            Exposé hochladen.<br />
            <span className="text-[#2F8A00]">Projekt automatisch anlegen.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:mt-5 md:text-lg">
            PDF, Word, Excel, Foto oder Screenshot hochladen. EMA Intelligence erkennt daraus die wichtigsten Projektdaten.
          </p>
        </div>
      </section>

      <div className="grid grid-cols-4 gap-2 md:gap-4">
        {steps.map((step) => (
          <div key={step.number} className="rounded-2xl border border-border/80 bg-white/80 p-3 text-center shadow-sm md:rounded-[1.5rem] md:p-4 md:text-left">
            <p className="text-xs font-extrabold text-[#5CB800]">{step.number}</p>
            <p className="mt-1 text-xs font-extrabold text-[#07142F] md:mt-2 md:text-base">{step.title}</p>
          </div>
        ))}
      </div>

      <ProjectImportClient />
    </div>
  )
}
