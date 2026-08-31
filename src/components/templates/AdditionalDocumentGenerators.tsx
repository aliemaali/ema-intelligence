import Link from 'next/link'
import { FileText } from 'lucide-react'

const generators = [
  {
    href: '/dms/checklist/new',
    title: 'Projekt-Checkliste',
    description: 'Leere, ausfüllbare PV- oder BESS-Checkliste als PDF zum Versenden.',
  },
  {
    href: '/dms/commission/new',
    title: 'Provisionsvereinbarung',
    description: 'Investor auswählen, automatisch berechnen und als gemeinsame DE/EN-PDF speichern.',
  },
  {
    href: '/dms/investor-profile/new',
    title: 'Investoren-Suchprofil',
    description: 'Zweisprachiges Suchprofil für neue Investoren, direkt als PDF speicherbar.',
  },
]

export function AdditionalDocumentGenerators() {
  return (
    <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {generators.map((generator) => (
        <section key={generator.href} className="dms-generator-card rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#5CB800]/12 text-[#8eee51]">
              <FileText className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-extrabold text-white">{generator.title}</h2>
              <p className="mt-1 text-sm leading-5 text-slate-300">{generator.description}</p>
              <Link href={generator.href} target="_blank" rel="noopener noreferrer" className="btn-primary mt-4">
                Erstellen
              </Link>
            </div>
          </div>
        </section>
      ))}
    </div>
  )
}
