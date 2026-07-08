import {
  ArrowRight,
  BadgeEuro,
  Building2,
  CheckCircle2,
  CloudUpload,
  FileSpreadsheet,
  FileText,
  Image,
  MapPin,
  ScanSearch,
  Sparkles,
  Zap,
} from 'lucide-react'

export const metadata = { title: 'Projekt-Import' }

const steps = [
  { number: '01', title: 'Upload', text: 'Exposé, Foto oder Screenshot hochladen.' },
  { number: '02', title: 'KI analysiert', text: 'EMA erkennt Projektdaten automatisch.' },
  { number: '03', title: 'Prüfen', text: 'Du kontrollierst die erkannten Werte.' },
  { number: '04', title: 'Erstellen', text: 'Projekt wird mit EMA-Nummer angelegt.' },
]

const detectedItems = [
  'Projektname',
  'Partner-Projektnummer',
  'Standort',
  'PV-Leistung',
  'BESS-Leistung',
  'Einspeiseart',
  'EK-Preis',
]

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/80 bg-white/80 px-4 py-3 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-extrabold text-[#07142F]">{value}</p>
    </div>
  )
}

function SectionTitle({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#5CB800]/10 text-[#2F8A00]">
        {icon}
      </div>
      <div>
        <h2 className="text-lg font-extrabold text-[#07142F]">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  )
}

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

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="card-padded rounded-[2rem]">
          <SectionTitle
            icon={<CloudUpload className="h-5 w-5" />}
            title="Datei hochladen"
            text="Antippen oder Datei hier ablegen. Auf dem iPhone kannst du direkt Fotos, Screenshots oder Dateien auswählen."
          />

          <label className="group flex min-h-[320px] cursor-pointer flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-[#5CB800]/35 bg-gradient-to-br from-[#5CB800]/8 via-white to-blue-50/70 p-6 text-center transition-all hover:border-[#5CB800]/60 hover:shadow-[0_22px_70px_rgba(15,23,42,0.08)]">
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.heic,image/*,application/pdf"
              className="hidden"
            />
            <div className="flex h-20 w-20 items-center justify-center rounded-[1.8rem] bg-white text-[#2F8A00] shadow-lg ring-1 ring-black/5 transition-transform group-hover:scale-105">
              <CloudUpload className="h-9 w-9" />
            </div>
            <h2 className="mt-6 text-2xl font-extrabold text-[#07142F]">Projekt hier ablegen</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              PDF, Word, Excel, JPG, PNG, HEIC, Foto oder Screenshot hochladen.
            </p>

            <div className="mt-7 grid grid-cols-2 gap-3 text-xs font-bold text-[#132060] sm:grid-cols-4">
              <span className="rounded-full bg-white/90 px-3 py-2 shadow-sm"><FileText className="mr-1 inline h-4 w-4" /> PDF</span>
              <span className="rounded-full bg-white/90 px-3 py-2 shadow-sm"><FileSpreadsheet className="mr-1 inline h-4 w-4" /> Excel</span>
              <span className="rounded-full bg-white/90 px-3 py-2 shadow-sm"><FileText className="mr-1 inline h-4 w-4" /> Word</span>
              <span className="rounded-full bg-white/90 px-3 py-2 shadow-sm"><Image className="mr-1 inline h-4 w-4" /> Bild</span>
            </div>
          </label>

          <div className="mt-5 rounded-[1.5rem] bg-[#07142F] p-4 text-white shadow-[0_18px_50px_rgba(7,20,47,0.16)]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
                <ScanSearch className="h-5 w-5 text-[#5CB800]" />
              </div>
              <div>
                <p className="text-sm font-extrabold">KI-Analyse vorbereitet</p>
                <p className="text-xs text-white/65">Im nächsten Schritt verbinden wir OCR und Datenextraktion.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="card-padded rounded-[2rem]">
            <SectionTitle
              icon={<Sparkles className="h-5 w-5" />}
              title="Erkannte Daten"
              text="Diese Felder soll EMA aus Exposés, Fotos und Screenshots übernehmen."
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {detectedItems.map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-sm font-bold text-[#132060]">
                  <CheckCircle2 className="h-4 w-4 text-[#5CB800]" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="card-padded rounded-[2rem]">
            <SectionTitle
              icon={<Building2 className="h-5 w-5" />}
              title="Projekt-Vorschau"
              text="Die EMA-Projektnummer bleibt intern und wird automatisch vergeben."
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <PreviewField label="EMA-Projektnummer" value="Automatisch" />
              <PreviewField label="Partner-Projektnummer" value="Aus Exposé" />
              <PreviewField label="Partner" value="Auswahl / Erkennung" />
              <PreviewField label="Projektname" value="Aus Exposé" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-1">
            <div className="card-padded rounded-[2rem]">
              <SectionTitle
                icon={<MapPin className="h-5 w-5" />}
                title="Standort"
                text="Adresse, Ort, Bundesland und GPS werden vorbereitet."
              />
              <div className="grid grid-cols-2 gap-3">
                <PreviewField label="Adresse" value="–" />
                <PreviewField label="Ort" value="–" />
                <PreviewField label="Bundesland" value="–" />
                <PreviewField label="GPS" value="–" />
              </div>
            </div>

            <div className="card-padded rounded-[2rem]">
              <SectionTitle
                icon={<Zap className="h-5 w-5" />}
                title="Technische Daten"
                text="Nur die wichtigsten Felder für deinen Workflow."
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-3">
                <PreviewField label="PV-Leistung" value="–" />
                <PreviewField label="BESS-Leistung" value="–" />
                <PreviewField label="Einspeiseart" value="Voll / PPA" />
              </div>
            </div>
          </div>

          <div className="card-padded rounded-[2rem]">
            <SectionTitle
              icon={<BadgeEuro className="h-5 w-5" />}
              title="Wirtschaftlich"
              text="Der EK-Preis ist dein Einkaufspreis vom Partner."
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <PreviewField label="EK-Preis" value="–" />
              <button className="btn-primary h-full min-h-[58px] justify-between px-5" type="button">
                Projekt erstellen <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
