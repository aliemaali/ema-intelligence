import { ProjectImportUploaderV2 } from '@/components/project-import/ProjectImportUploaderV2'

export const metadata = { title: 'Projekt-Import' }

const steps = [
  { number: '01', title: 'Upload', text: 'Exposé, Foto oder Screenshot hochladen.' },
  { number: '02', title: 'KI analysiert', text: 'EMA erkennt Projektdaten automatisch.' },
  { number: '03', title: 'Prüfen', text: 'Du kontrollierst die erkannten Werte.' },
  { number: '04', title: 'Erstellen', text: 'Projekt wird mit EMA-Nummer angelegt.' },
]

export default function ProjectImportPage() {
  return (
    <div className="page-container space-y-6 md:space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] bg-white/80 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] md:rounded-[2.2rem] md:p-8">
        <div className="absolute right-0 top-0 h-52 w-52 translate-x-16 -translate-y-16 rounded-full bg-[#5CB800]/10" />
        <div className="absolute bottom-0 right-16 h-32 w-32 rounded-full bg-[#132060]/5" />

        <div className="relative max-w-3xl">
          <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.28em] text-[#5CB800]">Projekt-Import</p>
          <h1 className="text-4xl font-extrabold leading-[0.98] tracking-[-0.055em] text-[#07142F] sm:text-5xl md:text-6xl">
            Exposé hochladen.<br />
            <span className="text-[#2F8A00]">Projekt automatisch anlegen.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
            Lade ein PDF, Word, Excel, Foto oder Screenshot hoch. EMA Intelligence erkennt daraus die wichtigsten Projektdaten und bereitet ein neues Projekt vor.
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {steps.map((step) => (
          <div key={step.number} className="rounded-[1.5rem] border border-border/80 bg-white/80 p-4 shadow-sm">
            <p className="text-xs font-extrabold text-[#5CB800]">{step.number}</p>
            <p className="mt-2 font-extrabold text-[#07142F]">{step.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{step.text}</p>
          </div>
        ))}
      </div>

      <ProjectImportUploaderV2 />
    </div>
  )
}
