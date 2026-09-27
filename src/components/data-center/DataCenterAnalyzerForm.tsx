'use client'

import Link from 'next/link'
import { FormEvent, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  FileText,
  HardDrive,
  MapPin,
  Network,
  Save,
  ServerCog,
  ShieldAlert,
  Upload,
  UserRound,
  WalletCards,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { createDataCenterAnalyzerProject } from '@/lib/actions/data-center-analyzer.actions'
import { createDocumentRecord } from '@/lib/actions/document.actions'
import { createClient } from '@/lib/supabase/client'
import type { DocumentType } from '@/lib/types/database.types'
import { DataCenterLocationMap } from './DataCenterLocationMap'

type AddressSuggestion = {
  label: string
  address: string
  street: string
  houseNumber: string
  postalCode: string
  city: string
  municipality: string
  district: string
  state: string
  country: string
  latitude: number
  longitude: number
}

type LocationState = Omit<AddressSuggestion, 'label'>

const emptyLocation: LocationState = {
  address: '', street: '', houseNumber: '', postalCode: '', city: '', municipality: '',
  district: '', state: '', country: 'Deutschland', latitude: 0, longitude: 0,
}

const fieldClass = 'mt-2 min-h-12 w-full min-w-0 max-w-full rounded-xl border border-[#31517c]/80 bg-[#061a38] px-3 py-2.5 text-sm text-white shadow-inner outline-none transition placeholder:text-slate-500 focus:border-[#73d72d] focus:ring-2 focus:ring-[#73d72d]/15'
const labelClass = 'block text-xs font-bold uppercase tracking-[0.08em] text-slate-300'

const years = Array.from({ length: 12 }, (_, index) => String(new Date().getFullYear() + index))

const riskOptions = [
  ['grey', 'Keine ausreichenden Daten / No sufficient data'],
  ['green', 'Kein relevantes Problem identifiziert / Green'],
  ['orange', 'Weitere Prüfung notwendig / Orange'],
  ['red', 'Kritisches Risiko identifiziert / Red'],
] as const

const projectModelInfo: Record<string, string> = {
  greenfield: 'Neuentwicklung auf einem unbebauten oder neu zu entwickelnden Grundstück.',
  existing_building: 'Vorhandenes Gebäude ohne bestätigten vollständigen Data-Center-Ausbau.',
  brownfield_conversion: 'Umnutzung eines bestehenden Industrie- oder Gewerbestandorts.',
  shell: 'Gebäudehülle ohne vollständige technische Rechenzentrumsinfrastruktur.',
  powered_shell: 'Gebäudehülle mit Stromerschließung; technischer Ausbau bleibt beim Betreiber.',
  turnkey: 'Schlüsselfertige beziehungsweise betriebsfähige Colocation-Anlage.',
}

function FormCard({
  icon: Icon,
  title,
  subtitle,
  children,
  open = false,
}: {
  icon: typeof MapPin
  title: string
  subtitle: string
  children: React.ReactNode
  open?: boolean
}) {
  return (
    <details open={open} className="group min-w-0 max-w-full overflow-hidden rounded-[1.35rem] border border-[#31517c]/55 bg-gradient-to-br from-[#0a244b]/95 to-[#04142f]/95 shadow-[inset_0_1px_0_rgba(255,255,255,.04),0_18px_46px_rgba(0,0,0,.22)]">
      <summary className="flex min-h-[78px] cursor-pointer list-none items-center gap-3 px-4 py-3.5 md:px-5">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-[#42699d]/60 bg-gradient-to-br from-[#153a70] to-[#071a39] text-[#83e637] shadow-[0_0_24px_rgba(57,123,226,.12)]">
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block text-sm font-extrabold text-white md:text-base">{title}</strong>
          <small className="mt-0.5 block truncate text-[11px] text-slate-400 md:text-xs">{subtitle}</small>
        </span>
        <ChevronDown className="h-5 w-5 text-slate-400 transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-[#31517c]/35 px-4 pb-5 pt-4 md:px-5 md:pb-6">{children}</div>
    </details>
  )
}

function Field({ label, origin = 'EINGABE', children, wide = false }: { label: string; origin?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={wide ? 'block min-w-0 max-w-full md:col-span-2' : 'block min-w-0 max-w-full'}>
      <span className={labelClass}>{label}<span className="ml-2 rounded-full bg-[#12365f] px-2 py-0.5 text-[8px] tracking-[0.12em] text-slate-400">{origin}</span></span>
      {children}
    </label>
  )
}

function SelectField({ name, label, defaultValue, children, onChange }: { name: string; label: string; defaultValue?: string; children: React.ReactNode; onChange?: (value: string) => void }) {
  return (
    <Field label={label}>
      <select name={name} defaultValue={defaultValue} onChange={onChange ? (event) => onChange(event.target.value) : undefined} className={fieldClass}>{children}</select>
    </Field>
  )
}

function AddressSearch({ value, onChange, onSelect }: { value: string; onChange: (value: string) => void; onSelect: (value: AddressSuggestion) => void }) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [busy, setBusy] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = (query: string) => {
    onChange(query)
    if (timer.current) clearTimeout(timer.current)
    if (query.trim().length < 2) {
      setSuggestions([])
      return
    }
    timer.current = setTimeout(async () => {
      setBusy(true)
      try {
        const response = await fetch(`/api/data-center/address?q=${encodeURIComponent(query)}`)
        const result = await response.json() as { suggestions?: AddressSuggestion[] }
        setSuggestions(result.suggestions ?? [])
      } catch {
        setSuggestions([])
      } finally {
        setBusy(false)
      }
    }, 320)
  }

  return (
    <div className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#83e637]" />
        <input name="address" value={value} onChange={(event) => search(event.target.value)} autoComplete="off" className={`${fieldClass} pl-10 pr-16`} placeholder="PLZ, Ort oder Straße eingeben …" />
        {busy && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase text-slate-500">suche</span>}
      </div>
      {suggestions.length > 0 && (
        <div className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-[#3b6091] bg-[#061832] p-1.5 shadow-2xl">
          {suggestions.map((suggestion) => (
            <button key={`${suggestion.latitude}-${suggestion.longitude}`} type="button" onClick={() => { onSelect(suggestion); setSuggestions([]) }} className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left text-sm text-white transition hover:bg-[#12315c]">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#83e637]" />
              <span className="line-clamp-2">{suggestion.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function formatMw(value: number | null) {
  return value === null ? '—' : `${value.toLocaleString('de-DE', { maximumFractionDigits: 2 })} MW`
}

function formatEur(value: number | null) {
  return value === null ? '—' : value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

function documentTypeFor(value: string): DocumentType {
  const mapping: Record<string, DocumentType> = {
    site_plan: 'lageplan', expose: 'expose', grid_request: 'netzanschluss', grid_confirmation: 'netzanschluss', grid_agreement: 'netzanschluss',
    development_plan: 'genehmigung', preliminary_permit: 'genehmigung', building_permit: 'genehmigung', offtaker_nda: 'nda', offtaker_loi: 'loi', hot: 'loi', offtaker_agreement: 'spa',
  }
  return mapping[value] ?? 'sonstiges'
}

export function DataCenterAnalyzerForm() {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [pending, startTransition] = useTransition()
  const [location, setLocation] = useState<LocationState>(emptyLocation)
  const [gridMw, setGridMw] = useState<number | null>(null)
  const [gridStatus, setGridStatus] = useState('indicated')
  const [pue, setPue] = useState(1.25)
  const [projectModel, setProjectModel] = useState('greenfield')
  const [purchaseMode, setPurchaseMode] = useState('total')
  const [totalPrice, setTotalPrice] = useState<number | null>(null)
  const [pricePerMw, setPricePerMw] = useState<number | null>(null)
  const [referenceCapacity, setReferenceCapacity] = useState('')
  const [planningStatus, setPlanningStatus] = useState('')
  const [dataCenterUseStatus, setDataCenterUseStatus] = useState('unknown')
  const [routeDiversityStatus, setRouteDiversityStatus] = useState('unknown')
  const [offtakerStatus, setOfftakerStatus] = useState('none')
  const [riskValues, setRiskValues] = useState<Record<string, string>>({})

  const itCapacity = gridMw && pue > 0 ? gridMw / pue : null
  const purchasePrice = useMemo(() => {
    if (purchaseMode === 'total') return totalPrice
    if (!pricePerMw || !referenceCapacity) return null
    const capacity = referenceCapacity === 'grid' ? gridMw : itCapacity
    return capacity ? pricePerMw * capacity : null
  }, [gridMw, itCapacity, pricePerMw, purchaseMode, referenceCapacity, totalPrice])

  const criticalCount = (
    (!gridMw || !['confirmed_in_writing', 'contractually_secured'].includes(gridStatus) ? 1 : 0) +
    (planningStatus === 'planning_conflict' ? 1 : 0) +
    Object.values(riskValues).filter((value) => value === 'red').length
  )
  const verifyCount = (
    (dataCenterUseStatus !== 'confirmed' ? 1 : 0) +
    (routeDiversityStatus !== 'confirmed' ? 1 : 0) +
    (offtakerStatus !== 'binding_contract' ? 1 : 0) +
    Object.values(riskValues).filter((value) => value === 'orange' || value === 'grey').length
  )

  const updateRisk = (key: string, value: string) => setRiskValues((current) => ({ ...current, [key]: value }))

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = formRef.current
    if (!form) return
    const completeData = new FormData(form)
    const files = completeData.getAll('documents').filter((value): value is File => value instanceof File && value.size > 0)
    const documentSubtype = String(completeData.get('documentSubtype') ?? 'other')
    completeData.delete('documents')
    completeData.delete('documentSubtype')

    startTransition(async () => {
      try {
        const result = await createDataCenterAnalyzerProject(completeData)
        if (result?.error || !result?.projectId) {
          toast.error(result?.error ?? 'Projekt konnte nicht gespeichert werden.')
          return
        }

        let uploadFailed = false
        if (files.length > 0) {
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) uploadFailed = true
          else {
            for (const file of files) {
              if (file.size > 20 * 1024 * 1024) { uploadFailed = true; continue }
              const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
              const storagePath = `${user.id}/${result.projectId}/${crypto.randomUUID()}-${safeName}`
              const { error } = await supabase.storage.from('project-documents').upload(storagePath, file, { contentType: file.type, upsert: false })
              if (error) { uploadFailed = true; continue }
              const record = await createDocumentRecord({
                projectId: result.projectId,
                displayName: file.name,
                fileName: file.name,
                filePath: storagePath,
                fileSizeBytes: file.size,
                mimeType: file.type || 'application/octet-stream',
                documentType: documentTypeFor(documentSubtype),
              })
              if (record?.error) uploadFailed = true
            }
          }
        }

        toast.success(uploadFailed ? 'Projekt gespeichert; einzelne Unterlagen konnten nicht hochgeladen werden.' : 'Data-Center-Projekt gespeichert.')
        router.push(`/projects/${result.projectId}/overview`)
      } catch (error) {
        const current = error as Error
        if (!current.message?.includes('NEXT_REDIRECT')) toast.error('Projekt konnte nicht gespeichert werden.')
      }
    })
  }

  return (
    <div className="w-full max-w-full touch-pan-y overflow-x-hidden pb-8">
      <section className="relative min-h-[280px] overflow-hidden border-b border-[#31517c]/55 bg-[#04142d] md:min-h-[335px]">
        <div className="absolute inset-0 bg-[url('/hero-datacenter.webp')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#020d21]/95 via-[#03152f]/78 to-[#03152f]/20" />
        <div className="relative mx-auto flex min-h-[280px] max-w-[1480px] flex-col justify-end px-5 pb-8 pt-7 md:min-h-[335px] md:px-8 md:pb-10">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-[#83e637]">EMA Intelligence</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-black tracking-[-0.045em] text-white md:text-5xl">EMA DATA CENTER ANALYZER</h1>
          <p className="mt-2 text-sm font-medium text-slate-300 md:text-base">Data Center Site &amp; Project Intelligence</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/projects?view=all&type=rechenzentrum" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 bg-[#071a38]/80 px-4 text-xs font-extrabold text-white backdrop-blur transition hover:border-[#83e637]/60">
              <HardDrive className="h-4 w-4 text-[#83e637]" /> PROJEKTE
            </Link>
          </div>
        </div>
      </section>

      <form ref={formRef} onSubmit={submit} className="page-container w-full min-w-0 max-w-full overflow-x-hidden !pt-5">
        <div className="mb-5 grid grid-cols-2 gap-2 md:grid-cols-4">
          <div className="rounded-2xl border border-[#31517c]/55 bg-[#071a38]/88 p-3"><span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Grid</span><strong className="mt-1 block text-lg text-white">{formatMw(gridMw)}</strong></div>
          <div className="rounded-2xl border border-[#31517c]/55 bg-[#071a38]/88 p-3"><span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">IT · PUE {pue.toFixed(2)}</span><strong className="mt-1 block text-lg text-white">{formatMw(itCapacity)}</strong></div>
          <div className="rounded-2xl border border-[#31517c]/55 bg-[#071a38]/88 p-3"><span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Kritisch</span><strong className={`mt-1 block text-lg ${criticalCount ? 'text-rose-400' : 'text-[#83e637]'}`}>{criticalCount}</strong></div>
          <div className="rounded-2xl border border-[#31517c]/55 bg-[#071a38]/88 p-3"><span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Zu prüfen</span><strong className="mt-1 block text-lg text-amber-300">{verifyCount}</strong></div>
        </div>

        <div className="grid min-w-0 max-w-full items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 max-w-full space-y-3">
            <FormCard icon={MapPin} title="LOCATION / STANDORT" subtitle="Adresse, Grundstück und exakte Projektposition" open>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Projektname / Project name" wide><input name="projectName" required className={fieldClass} placeholder="z. B. Data Center Chemnitz" /></Field>
                <Field label="Adresse / Address" wide>
                  <AddressSearch value={location.address} onChange={(address) => setLocation((current) => ({ ...current, address }))} onSelect={(suggestion) => setLocation({ ...suggestion })} />
                </Field>
                <Field label="Grundstücksgröße / Site area"><input name="siteAreaSqm" type="number" min="0" step="1" className={fieldClass} placeholder="m²" /></Field>
                <Field label="Flurstück / Parcel"><input name="parcel" className={fieldClass} /></Field>
                <Field label="Eigentümer / Owner"><input name="owner" className={fieldClass} /></Field>
                <Field label="Land / Country"><select name="country" value={location.country} onChange={(event) => setLocation((current) => ({ ...current, country: event.target.value }))} className={fieldClass}><option>Deutschland</option></select></Field>
              </div>
              {(['street', 'houseNumber', 'postalCode', 'city', 'municipality', 'district', 'state'] as const).map((key) => <input key={key} type="hidden" name={key} value={location[key]} />)}
              <input type="hidden" name="latitude" value={location.latitude || ''} />
              <input type="hidden" name="longitude" value={location.longitude || ''} />
              <div className="mt-4 min-w-0 max-w-full overflow-hidden rounded-2xl">
                <DataCenterLocationMap latitude={location.latitude || null} longitude={location.longitude || null} label={location.address} />
              </div>
            </FormCard>

            <FormCard icon={Zap} title="GRID CONNECTION / NETZANSCHLUSS" subtitle="Leistung, Netzebene, Übergabepunkt und belastbarer Status" open>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Netzanschlussleistung / Grid capacity"><div className="relative"><input name="gridCapacityMw" type="number" min="0" step="0.01" value={gridMw ?? ''} onChange={(event) => setGridMw(event.target.value ? Number(event.target.value) : null)} className={`${fieldClass} pr-14`} /><span className="absolute right-3 top-[27px] text-xs text-slate-400">MW</span></div></Field>
                <SelectField name="gridStatus" label="Netzstatus / Grid status" defaultValue="indicated" onChange={setGridStatus}>
                  <option value="indicated">nur angegeben / indicated</option><option value="requested">angefragt / requested</option><option value="grid_study_ongoing">Netzprüfung läuft / grid study ongoing</option><option value="generally_feasible">grundsätzlich möglich / generally feasible</option><option value="confirmed_in_writing">schriftlich bestätigt / confirmed in writing</option><option value="contractually_secured">vertraglich gesichert / contractually secured</option>
                </SelectField>
                <Field label="Netzbetreiber / Grid operator"><input name="gridOperator" className={fieldClass} /></Field>
                <SelectField name="voltageLevel" label="Netzebene / Voltage level" defaultValue=""><option value="">Nicht bekannt / Unknown</option><option value="10_kv">10 kV</option><option value="20_kv">20 kV</option><option value="30_kv">30 kV</option><option value="110_kv">110 kV</option><option value="220_kv">220 kV</option><option value="380_kv">380 kV</option></SelectField>
                <Field label="Übergabepunkt / Point of connection"><input name="pointOfConnection" className={fieldClass} /></Field>
                <SelectField name="availableFrom" label="Verfügbar ab / Available from" defaultValue=""><option value="">Nicht bekannt / Unknown</option><option value="immediate">Sofort / Immediate</option>{years.map((year) => <option key={year}>{year}</option>)}</SelectField>
              </div>
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" /><span>Eine Statusauswahl ersetzt keinen geprüften Nachweis. Die Netzleistung bleibt bis zur Dokumentenprüfung <strong>NICHT BESTÄTIGT</strong>.</span></div>
            </FormCard>

            <FormCard icon={ServerCog} title="ESTIMATED IT CAPACITY" subtitle="Screening-Schätzung auf Basis von Grid Capacity und PUE">
              <div className="grid gap-4 md:grid-cols-[1fr_180px]">
                <div className="rounded-2xl border border-[#3971a8]/55 bg-[#071b3c] p-4"><span className="text-[10px] font-bold uppercase tracking-widest text-[#7fd632]">Geschätzte IT-Leistung</span><strong className="mt-2 block text-3xl text-white">{formatMw(itCapacity)}</strong><small className="mt-2 block text-slate-400">Screening estimate – not technical design.</small></div>
                <SelectField name="pue" label="PUE-Annahme" defaultValue="1.25" onChange={(value) => setPue(Number(value))}><option value="1.2">1.20</option><option value="1.25">1.25</option><option value="1.3">1.30</option></SelectField>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">{[1.2, 1.25, 1.3].map((value) => <div key={value} className="rounded-xl border border-[#31517c]/45 bg-[#061832] p-3 text-center"><small className="text-slate-500">PUE {value.toFixed(2)}</small><strong className="mt-1 block text-sm text-white">{formatMw(gridMw ? gridMw / value : null)}</strong></div>)}</div>
            </FormCard>

            <FormCard icon={Building2} title="PLANNING / BAURECHT" subtitle="Planungsstand und konkrete Data-Center-Nutzung">
              <div className="grid gap-4 md:grid-cols-2">
                <SelectField name="planningStatus" label="Baurechtsstatus / Planning status" defaultValue="" onChange={setPlanningStatus}><option value="">Noch nicht geprüft / Not assessed</option><option value="development_plan_review">B-Plan wird geprüft</option><option value="commercial_area_indicated">Gewerbegebiet angegeben</option><option value="industrial_area_indicated">Industriegebiet angegeben</option><option value="section_34">§34 BauGB angegeben</option><option value="section_35">§35 BauGB angegeben</option><option value="preliminary_permit_requested">Bauvorbescheid beantragt</option><option value="preliminary_permit_issued">Bauvorbescheid erteilt</option><option value="building_permit_requested">Baugenehmigung beantragt</option><option value="building_permit_issued">Baugenehmigung erteilt</option><option value="planning_conflict">Baurechtlicher Konflikt erkannt</option></SelectField>
                <SelectField name="dataCenterUseStatus" label="Data-Center-Nutzung / Use" defaultValue="unknown" onChange={setDataCenterUseStatus}><option value="unknown">Nicht geprüft / Unknown</option><option value="indicated">Nur angegeben / Indicated</option><option value="partially_verified">Teilweise bestätigt / Partially verified</option><option value="confirmed">Schriftlich bestätigt / Confirmed</option><option value="not_permitted">Nicht zulässig / Not permitted</option></SelectField>
              </div>
              {['commercial_area_indicated', 'industrial_area_indicated'].includes(planningStatus) && <p className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/10 p-3 text-xs text-amber-100">Gewerbe- oder Industriegebiet bedeutet nicht automatisch, dass ein Rechenzentrum genehmigt ist.</p>}
            </FormCard>

            <FormCard icon={Network} title="CONNECTIVITY / GLASFASER" subtitle="Carrier, Verfügbarkeit und physische Trassenredundanz">
              <div className="grid gap-4 md:grid-cols-2">
                <SelectField name="connectivityStatus" label="Glasfaserstatus / Fiber status" defaultValue="unknown"><option value="unknown">Nicht geprüft / Unknown</option><option value="indicated">Verfügbarkeit angegeben / Indicated</option><option value="available">Am Standort verfügbar / Available</option><option value="planned">In Planung / Planned</option><option value="not_available">Nicht verfügbar / Not available</option></SelectField>
                <SelectField name="routeDiversityStatus" label="Trassenredundanz / Route diversity" defaultValue="unknown" onChange={setRouteDiversityStatus}><option value="unknown">Nicht geprüft / Unknown</option><option value="indicated">Nur angegeben / Indicated</option><option value="under_review">In Prüfung / Under review</option><option value="confirmed">Dokumentiert / Confirmed</option><option value="not_available">Nicht verfügbar / Not available</option></SelectField>
                <Field label="Bekannte Carrier / Known carriers" wide><input name="carriers" className={fieldClass} placeholder="Carrier durch Komma trennen" /></Field>
              </div>
            </FormCard>

            <FormCard icon={ShieldAlert} title="SITE RISKS / STANDORTRISIKEN" subtitle="Keine Daten werden als kein Risiko interpretiert">
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  ['riskFlood', 'Hochwasser / Flood'], ['riskHeavyRain', 'Starkregen / Heavy rain'], ['riskWaterProtection', 'Wasserschutz / Water protection'], ['riskNatureProtection', 'Naturschutz / Nature protection'], ['riskResidentialNoise', 'Wohnbebauung & Lärm'], ['riskContamination', 'Altlasten / Contamination'], ['riskAccess', 'Zufahrt / Access'], ['riskAirport', 'Flughafen / Flight corridors'], ['riskExpansion', 'Erweiterung / Expansion'],
                ].map(([name, label]) => <SelectField key={name} name={name} label={label} defaultValue="grey" onChange={(value) => updateRisk(name, value)}>{riskOptions.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</SelectField>)}
                <Field label="Hinweise / Notes" wide><textarea name="riskNotes" rows={3} className={`${fieldClass} resize-y`} /></Field>
              </div>
            </FormCard>

            <FormCard icon={UserRound} title="OFFTAKER" subtitle="Prozessstand, Kapazität und Vertragsstatus">
              <div className="grid gap-4 md:grid-cols-2">
                <SelectField name="offtakerStatus" label="Offtaker-Status" defaultValue="none" onChange={setOfftakerStatus}><option value="none">keiner / None</option><option value="searching">wird gesucht / Searching</option><option value="initial_contact">Erstkontakt / Initial contact</option><option value="nda">NDA</option><option value="interest">Interesse / Interest</option><option value="loi">LOI</option><option value="hot">HoT / Term sheet</option><option value="binding_contract">verbindlicher Vertrag / Binding contract</option></SelectField>
                <Field label="Offtaker Name"><input name="offtakerName" className={fieldClass} /></Field>
                <Field label="Angefragte Leistung / Requested capacity"><div className="relative"><input name="requestedCapacityMw" type="number" min="0" step="0.01" className={`${fieldClass} pr-14`} /><span className="absolute right-3 top-[27px] text-xs text-slate-400">MW</span></div></Field>
                <SelectField name="contractTerm" label="Vertragslaufzeit / Contract term" defaultValue=""><option value="">Nicht festgelegt</option><option value="12_months">12 Monate</option><option value="24_months">24 Monate</option><option value="36_months">36 Monate</option><option value="60_months">5 Jahre</option><option value="120_months">10 Jahre</option><option value="180_months">15 Jahre</option><option value="240_months">20 Jahre</option></SelectField>
                <SelectField name="plannedStart" label="Geplanter Start / Planned start" defaultValue=""><option value="">Nicht bekannt</option>{years.map((year) => <option key={year}>{year}</option>)}</SelectField>
              </div>
              {['loi', 'hot'].includes(offtakerStatus) && <p className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/10 p-3 text-xs text-amber-100">LOI und HoT sind kein verbindlicher Offtake-Vertrag.</p>}
            </FormCard>

            <FormCard icon={HardDrive} title="PROJECT MODEL / PROJEKTMODELL" subtitle="Angebotenes Entwicklungs- und Übergabemodell">
              <SelectField name="projectModel" label="Projektmodell / Project model" defaultValue="greenfield" onChange={setProjectModel}><option value="greenfield">Greenfield</option><option value="existing_building">Bestandsgebäude / Existing building</option><option value="brownfield_conversion">Brownfield conversion</option><option value="shell">Shell</option><option value="powered_shell">Powered shell</option><option value="turnkey">Turnkey / Colocation facility</option></SelectField>
              <p className="mt-3 rounded-xl border border-[#31517c]/45 bg-[#061832] p-3 text-xs leading-5 text-slate-300">{projectModelInfo[projectModel]}</p>
            </FormCard>

            <FormCard icon={WalletCards} title="PROJECT PURCHASE PRICE / PROJEKTKAUFPREIS" subtitle="Projektpreis – ausdrücklich kein CAPEX">
              <div className="grid gap-4 md:grid-cols-2">
                <SelectField name="purchasePriceMode" label="Preisart / Price mode" defaultValue="total" onChange={setPurchaseMode}><option value="total">Gesamtkaufpreis / Total purchase price</option><option value="per_mw">Preis pro MW / Price per MW</option></SelectField>
                {purchaseMode === 'total' ? <Field label="Gesamtkaufpreis / Total"><div className="relative"><input name="totalPurchasePrice" type="number" min="0" step="1" value={totalPrice ?? ''} onChange={(event) => setTotalPrice(event.target.value ? Number(event.target.value) : null)} className={`${fieldClass} pr-14`} /><span className="absolute right-3 top-[27px] text-xs text-slate-400">EUR</span></div></Field> : <>
                  <Field label="Preis pro MW / Price per MW"><div className="relative"><input name="pricePerMw" type="number" min="0" step="1" value={pricePerMw ?? ''} onChange={(event) => setPricePerMw(event.target.value ? Number(event.target.value) : null)} className={`${fieldClass} pr-20`} /><span className="absolute right-3 top-[27px] text-xs text-slate-400">EUR/MW</span></div></Field>
                  <SelectField name="referenceCapacity" label="Bezugsgröße / Reference capacity" defaultValue="" onChange={setReferenceCapacity}><option value="">Zwingend auswählen / Required</option><option value="grid">GRID MW / Netzanschlussleistung</option><option value="it">IT MW / geschätzte IT-Leistung</option></SelectField>
                </>}
              </div>
              <div className="mt-4 rounded-2xl border border-[#69c91e]/35 bg-gradient-to-br from-[#163820]/65 to-[#07251e]/75 p-4"><span className="text-[10px] font-extrabold uppercase tracking-widest text-[#83e637]">Project purchase price</span><strong className="mt-2 block text-2xl text-white">{formatEur(purchasePrice)}</strong><small className="mt-2 block text-slate-300">{purchaseMode === 'per_mw' ? `Bezugsgröße: ${referenceCapacity === 'grid' ? formatMw(gridMw) + ' GRID' : referenceCapacity === 'it' ? formatMw(itCapacity) + ' IT · ESTIMATED' : 'nicht gewählt'}` : 'Gesamtpreis / Total price'} · Kein CAPEX</small></div>
            </FormCard>

            <FormCard icon={FileText} title="DOCUMENTS / DOKUMENTE" subtitle="Optionale Unterlagen dem neuen Projekt zuordnen">
              <div className="grid gap-4 md:grid-cols-2">
                <SelectField name="documentSubtype" label="Dokumenttyp / Document type" defaultValue="other"><option value="site_plan">Lageplan / Site plan</option><option value="land_register">Grundbuch / Land register</option><option value="expose">Exposé</option><option value="grid_request">Netzanschlussanfrage</option><option value="grid_confirmation">Netzanschlussbestätigung</option><option value="grid_agreement">Netzanschlussvertrag</option><option value="development_plan">B-Plan / Development plan</option><option value="preliminary_permit">Bauvorbescheid</option><option value="building_permit">Baugenehmigung</option><option value="fiber_information">Fiber-/Carrier-Unterlagen</option><option value="offtaker_nda">Offtaker NDA</option><option value="offtaker_loi">Offtaker LOI</option><option value="hot">HoT / Term sheet</option><option value="offtaker_agreement">Offtaker agreement</option><option value="other">Sonstige / Other</option></SelectField>
                <Field label="Dateien / Files"><label className="mt-2 flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#4b73a5] bg-[#061a38] px-3 text-sm font-bold text-slate-200 transition hover:border-[#83e637]"><Upload className="h-4 w-4 text-[#83e637]" /> Unterlagen auswählen<input name="documents" type="file" multiple className="hidden" /></label></Field>
                <Field label="Zusätzliche Hinweise / Notes" wide><textarea name="notes" rows={4} className={`${fieldClass} resize-y`} /></Field>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-400">Hochgeladene Unterlagen werden nicht automatisch als bestätigt behandelt. Maximal 20 MB pro Datei.</p>
            </FormCard>
          </div>

          <aside className="space-y-3 xl:sticky xl:top-5">
            <div className="rounded-[1.35rem] border border-[#31517c]/60 bg-gradient-to-br from-[#0a244b] to-[#04142f] p-5 shadow-2xl">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#83e637]">EMA Project Assessment</p>
              <h2 className="mt-2 text-2xl font-black text-white">{criticalCount ? 'CRITICAL' : gridMw && location.address ? 'DEVELOPMENT' : 'EARLY STAGE'}</h2>
              <div className="mt-5 space-y-2">
                <div className="flex items-center justify-between rounded-xl border border-[#31517c]/45 bg-[#061832] p-3"><span className="text-xs text-slate-400">Grid Capacity</span><strong className="text-sm text-white">{formatMw(gridMw)}</strong></div>
                <div className="flex items-center justify-between rounded-xl border border-[#31517c]/45 bg-[#061832] p-3"><span className="text-xs text-slate-400">Estimated IT</span><strong className="text-sm text-white">{formatMw(itCapacity)}</strong></div>
                <div className="flex items-center justify-between rounded-xl border border-[#31517c]/45 bg-[#061832] p-3"><span className="text-xs text-slate-400">Purchase Price</span><strong className="text-sm text-white">{formatEur(purchasePrice)}</strong></div>
              </div>
              <div className="mt-5 space-y-2 text-xs">
                <div className="flex items-start gap-2 rounded-xl border border-rose-400/25 bg-rose-500/10 p-3 text-rose-100"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" /><span><strong className="block">{criticalCount} KRITISCH</strong>{!gridMw ? 'Netzanschlussleistung fehlt.' : !['confirmed_in_writing', 'contractually_secured'].includes(gridStatus) ? 'Netzleistung ist nicht bestätigt.' : 'Kritische Punkte aus Eingaben prüfen.'}</span></div>
                <div className="flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-500/10 p-3 text-amber-100"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" /><span><strong className="block">{verifyCount} ZU PRÜFEN</strong>Offene Punkte bleiben bis zum belastbaren Nachweis ungeprüft.</span></div>
                <div className="flex items-start gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-3 text-emerald-100"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#83e637]" /><span><strong className="block">STATUSLOGIK AKTIV</strong>Keine Eingabe wird ohne Nachweis als verifiziert gespeichert.</span></div>
              </div>
              <button type="submit" disabled={pending} className="mt-5 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#62c700] to-[#7dde22] px-5 py-3.5 text-sm font-black text-[#06142d] shadow-[0_12px_32px_rgba(102,204,25,.25)] transition hover:brightness-105 disabled:cursor-wait disabled:opacity-60">
                <Save className="h-4 w-4" /> {pending ? 'PROJEKT WIRD GESPEICHERT …' : 'SAVE PROJECT / PROJEKT SPEICHERN'}
              </button>
            </div>
          </aside>
        </div>
      </form>
    </div>
  )
}
