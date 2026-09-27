'use client'

import Link from 'next/link'
import { FormEvent, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Download,
  FileText,
  HardDrive,
  Loader2,
  MapPin,
  Save,
  ShieldAlert,
  Upload,
  WalletCards,
  X,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { createDataCenterAnalyzerProject } from '@/lib/actions/data-center-analyzer.actions'
import { prepareDataCenterImport } from '@/lib/actions/data-center-import.actions'
import { createDocumentRecord } from '@/lib/actions/document.actions'
import { uploadProjectImportFiles } from '@/lib/actions/project-import.actions'
import type { DataCenterImport } from '@/lib/ai/data-center-import'
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

const riskFields = [
  ['riskFlood', 'Hochwasser', 'Hochwasser / Flood'], ['riskHeavyRain', 'Starkregen', 'Starkregen / Heavy rain'],
  ['riskWaterProtection', 'Wasserschutz', 'Wasserschutz / Water protection'], ['riskNatureProtection', 'Naturschutz', 'Naturschutz / Nature protection'],
  ['riskResidentialNoise', 'Wohnbebauung und Lärm', 'Wohnbebauung und Lärm / Residential areas and noise'], ['riskContamination', 'Altlasten', 'Altlasten / Contamination'],
  ['riskAccess', 'Zufahrt', 'Zufahrt / Access'], ['riskAirport', 'Flughafen und Flugkorridore', 'Flughafen und Flugkorridore / Airport and flight corridors'],
  ['riskExpansion', 'Erweiterungsmöglichkeiten', 'Erweiterung / Expansion'],
] as const

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

function importValueInGerman(value: string) {
  const translations: Record<string, string> = {
    yes: 'Ja', no: 'Nein', unknown: 'Nicht bekannt', verify: 'Zu prüfen', planned: 'In Planung',
    in_preparation: 'In Vorbereitung', commercial: 'Gewerbegebiet', industrial: 'Industriegebiet',
    agricultural: 'Landwirtschaftlich', mixed: 'Mischgebiet', special: 'Sondergebiet',
    indicated: 'Nur angegeben', requested: 'Angefragt', grid_study_ongoing: 'Netzprüfung läuft',
    generally_feasible: 'Grundsätzlich möglich', confirmed_in_writing: 'Schriftlich bestätigt',
    contractually_secured: 'Vertraglich gesichert', confirmed: 'Bestätigt', not_confirmed: 'Nicht bestätigt',
    greenfield: 'Neuentwicklung', existing_building: 'Bestandsgebäude', brownfield_conversion: 'Brownfield-Umnutzung',
    powered_shell: 'Stromerschlossene Gebäudehülle', turnkey: 'Schlüsselfertig', searching: 'Wird gesucht',
    initial_contact: 'Erstkontakt', interest: 'Interesse', binding_contract: 'Verbindlicher Vertrag',
  }
  return translations[value] ?? value
}

function documentTypeForFile(fileName: string): DocumentType {
  const name = fileName.toLowerCase()
  if (name.includes('lageplan') || name.includes('site-plan')) return 'lageplan'
  if (name.includes('expose') || name.includes('exposé')) return 'expose'
  if (name.includes('netz') || name.includes('grid')) return 'netzanschluss'
  if (name.includes('b-plan') || name.includes('bebauung') || name.includes('genehm') || name.includes('permit')) return 'genehmigung'
  if (name.includes('nda')) return 'nda'
  if (name.includes('loi') || name.includes('term-sheet') || name.includes('hot')) return 'loi'
  if (name.includes('offtake') || name.includes('abnahmevertrag')) return 'spa'
  return 'sonstiges'
}

export function DataCenterAnalyzerForm() {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const completedFactSheetRef = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()
  const [pdfBusy, setPdfBusy] = useState<'fact-sheet' | 'assessment' | null>(null)
  const [importBusy, setImportBusy] = useState(false)
  const [completedFactSheet, setCompletedFactSheet] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<DataCenterImport | null>(null)
  const [location, setLocation] = useState<LocationState>(emptyLocation)
  const [gridMw, setGridMw] = useState<number | null>(null)
  const [gridStatus, setGridStatus] = useState('indicated')
  const [pue] = useState(1.25)
  const [projectModel, setProjectModel] = useState('greenfield')
  const [purchaseMode, setPurchaseMode] = useState('total')
  const [totalPrice, setTotalPrice] = useState<number | null>(null)
  const [pricePerMw, setPricePerMw] = useState<number | null>(null)
  const [referenceCapacity, setReferenceCapacity] = useState('')
  const [planningStatus, setPlanningStatus] = useState('')
  const [dataCenterUseStatus, setDataCenterUseStatus] = useState('unknown')
  const [connectivityStatus, setConnectivityStatus] = useState('unknown')
  const [carriers, setCarriers] = useState('')
  const [routeDiversityStatus, setRouteDiversityStatus] = useState('unknown')
  const [offtakerStatus, setOfftakerStatus] = useState('none')
  const [riskValues] = useState<Record<string, string>>({})
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([])

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

  const currentFormValue = (name: string) => {
    const form = formRef.current
    if (!form) return ''
    const value = new FormData(form).get(name)
    return typeof value === 'string' ? value : ''
  }

  const setNativeField = (name: string, value: string | number | null) => {
    if (value === null || value === '') return
    const field = formRef.current?.elements.namedItem(name)
    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
      field.value = String(value)
    }
  }

  const downloadFactSheet = async () => {
    setPdfBusy('fact-sheet')
    try {
      const { downloadDataCenterFactSheetPdf } = await import('@/lib/pdf/dataCenterPdfs')
      await downloadDataCenterFactSheetPdf()
      toast.success('Das bilinguale Projekt-Eckdatenblatt wurde erstellt.')
    } catch {
      toast.error('Das Projekt-Eckdatenblatt konnte nicht erstellt werden.')
    } finally {
      setPdfBusy(null)
    }
  }

  const downloadAssessment = async () => {
    setPdfBusy('assessment')
    try {
      const { downloadDataCenterAssessmentPdf } = await import('@/lib/pdf/dataCenterPdfs')
      const asNumber = (name: string) => {
        const value = currentFormValue(name)
        const number = Number(value)
        return value && Number.isFinite(number) ? number : null
      }
      await downloadDataCenterAssessmentPdf({
        projectName: currentFormValue('projectName'), address: location.address, city: location.city, state: location.state,
        latitude: location.latitude || null, longitude: location.longitude || null,
        gridCapacityMw: gridMw, gridStatus, gridOperator: currentFormValue('gridOperator'),
        voltageLevel: currentFormValue('voltageLevel'), pointOfConnection: currentFormValue('pointOfConnection'),
        availableFrom: currentFormValue('availableFrom'), pue, planningStatus,
        dataCenterUseStatus, connectivityStatus,
        carriers, routeDiversityStatus, offtakerStatus,
        offtakerName: currentFormValue('offtakerName'), projectModel, purchasePriceMode: purchaseMode,
        totalPurchasePrice: totalPrice ?? asNumber('totalPurchasePrice'), pricePerMw: pricePerMw ?? asNumber('pricePerMw'),
        referenceCapacity, risks: riskFields.map(([name, , pdfLabel]) => ({ label: pdfLabel, value: riskValues[name] ?? 'grey' })),
      })
      toast.success('Projektanalyse wurde als bilinguale PDF erstellt.')
    } catch {
      toast.error('Die Projektanalyse konnte nicht erstellt werden.')
    } finally {
      setPdfBusy(null)
    }
  }

  const readCompletedFactSheet = async (file: File, attachAsFactSheet = true) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Bitte eine PDF-Datei auswählen.')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('Die PDF darf maximal 20 MB groß sein.')
      return
    }
    setImportBusy(true)
    if (attachAsFactSheet) setCompletedFactSheet(file)
    try {
      const uploadData = new FormData()
      uploadData.append('files', file)
      const uploaded = await uploadProjectImportFiles(uploadData)
      if (uploaded.error || !uploaded.importId) throw new Error(uploaded.error ?? 'Import fehlgeschlagen.')
      const extracted = await prepareDataCenterImport(uploaded.importId)
      if (!('data' in extracted) || !extracted.data) throw new Error(extracted.error ?? 'Keine Daten erkannt.')
      setImportPreview(extracted.data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Das ausgefüllte Projekt-Eckdatenblatt konnte nicht gelesen werden.')
    } finally {
      setImportBusy(false)
    }
  }

  const applyImportPreview = () => {
    if (!importPreview) return
    const coordinates = importPreview.coordinates.match(/(-?\d+(?:[.,]\d+)?)\D+(-?\d+(?:[.,]\d+)?)/)
    const latitude = coordinates ? Number(coordinates[1].replace(',', '.')) : 0
    const longitude = coordinates ? Number(coordinates[2].replace(',', '.')) : 0
    setLocation((current) => ({
      ...current, address: importPreview.address || current.address, city: importPreview.city || current.city,
      district: importPreview.district || current.district, state: importPreview.state || current.state,
      latitude: Number.isFinite(latitude) ? latitude : current.latitude, longitude: Number.isFinite(longitude) ? longitude : current.longitude,
    }))
    if (importPreview.availablePowerMw !== null) setGridMw(importPreview.availablePowerMw)
    setNativeField('projectName', importPreview.projectName)
    setNativeField('gridOperator', importPreview.gridOperator)
    setNativeField('voltageLevel', importPreview.voltageLevel)
    setNativeField('pointOfConnection', importPreview.pointOfConnection)
    setNativeField('availableFrom', importPreview.availableFrom)
    setCarriers(importPreview.fiberProvider)
    setNativeField('siteAreaSqm', importPreview.landAreaHa === null ? null : importPreview.landAreaHa * 10_000)
    setNativeField('notes', importPreview.additionalNotes || importPreview.planningNotes)
    if (importPreview.zoningPlanStatus === 'yes') {
      setPlanningStatus('development_plan_review')
      setNativeField('planningStatus', 'development_plan_review')
    }
    if (importPreview.dataCenterPermitted === 'yes') {
      setDataCenterUseStatus('indicated')
      setNativeField('dataCenterUseStatus', 'indicated')
    }
    const connectivity = importPreview.fiberStatus === 'yes' ? 'indicated' : importPreview.fiberStatus === 'planned' ? 'planned' : 'unknown'
    setConnectivityStatus(connectivity)
    if (importPreview.gridStatus !== 'unknown') {
      setGridStatus(importPreview.gridStatus)
      setNativeField('gridStatus', importPreview.gridStatus)
    }
    if (importPreview.routeDiversity === 'confirmed') {
      setRouteDiversityStatus('confirmed')
      setNativeField('routeDiversityStatus', 'confirmed')
    }
    if (importPreview.projectModel !== 'unknown') {
      setProjectModel(importPreview.projectModel)
      setNativeField('projectModel', importPreview.projectModel)
    }
    if (importPreview.offtakerStatus !== 'unknown') {
      setOfftakerStatus(importPreview.offtakerStatus)
      setNativeField('offtakerStatus', importPreview.offtakerStatus)
    }
    setNativeField('offtakerName', importPreview.offtakerName)
    setNativeField('requestedCapacityMw', importPreview.requestedCapacityMw)
    if (importPreview.purchasePriceMode !== 'unknown') {
      setPurchaseMode(importPreview.purchasePriceMode)
      setNativeField('purchasePriceMode', importPreview.purchasePriceMode)
    }
    if (importPreview.totalPurchasePrice !== null) setTotalPrice(importPreview.totalPurchasePrice)
    if (importPreview.pricePerMw !== null) setPricePerMw(importPreview.pricePerMw)
    if (importPreview.referenceCapacity !== 'unknown') {
      setReferenceCapacity(importPreview.referenceCapacity)
      setNativeField('referenceCapacity', importPreview.referenceCapacity)
    }
    setImportPreview(null)
    toast.success('Erkannte Daten wurden als ungeprüfte Angaben übernommen.')
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = formRef.current
    if (!form) return
    const completeData = new FormData(form)
    const files = completeData.getAll('documents').filter((value): value is File => value instanceof File && value.size > 0)
    if (completedFactSheet) files.push(completedFactSheet)
    completeData.delete('documents')

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
                documentType: documentTypeForFile(file.name),
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
      <section className="relative min-h-[360px] overflow-hidden border-b border-[#31517c]/55 bg-[#04142d] md:min-h-[380px]">
        <div className="absolute inset-0 bg-[url('/hero-datacenter.webp')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#020d21]/95 via-[#03152f]/78 to-[#03152f]/20" />
        <div className="relative mx-auto flex min-h-[360px] max-w-[1480px] flex-col justify-end px-5 pb-8 md:min-h-[380px] md:px-8 md:pb-10" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 5.25rem)' }}>
          <Link href="/apps" className="absolute left-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/25 bg-[#04142d]/90 px-4 text-xs font-extrabold text-white shadow-lg backdrop-blur transition hover:border-[#83e637]/70 md:left-8" style={{ top: 'calc(env(safe-area-inset-top) + 0.75rem)' }}>
            <ArrowLeft className="h-4 w-4 text-[#83e637]" /> ZUR HAUPTSEITE
          </Link>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-[#83e637]">EMA Intelligence</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-black tracking-[-0.045em] text-white md:text-5xl">EMA RECHENZENTRUM-ANALYSE</h1>
          <p className="mt-2 text-sm font-medium text-slate-300 md:text-base">Standort- und Projektprüfung für Rechenzentren</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/projects?view=all&type=rechenzentrum" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 bg-[#071a38]/80 px-4 text-xs font-extrabold text-white backdrop-blur transition hover:border-[#83e637]/60">
              <HardDrive className="h-4 w-4 text-[#83e637]" /> PROJEKTE
            </Link>
            <button type="button" onClick={downloadFactSheet} disabled={pdfBusy !== null} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 bg-[#071a38]/80 px-4 text-xs font-extrabold text-white backdrop-blur transition hover:border-[#83e637]/60 disabled:opacity-60">
              {pdfBusy === 'fact-sheet' ? <Loader2 className="h-4 w-4 animate-spin text-[#83e637]" /> : <Download className="h-4 w-4 text-[#83e637]" />} PROJEKT-ECKDATENBLATT
            </button>
            <button type="button" onClick={() => completedFactSheetRef.current?.click()} disabled={importBusy} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 bg-[#071a38]/80 px-4 text-xs font-extrabold text-white backdrop-blur transition hover:border-[#83e637]/60 disabled:opacity-60">
              {importBusy ? <Loader2 className="h-4 w-4 animate-spin text-[#83e637]" /> : <Upload className="h-4 w-4 text-[#83e637]" />} ECKDATENBLATT HOCHLADEN
            </button>
            <button type="button" onClick={downloadAssessment} disabled={pdfBusy !== null} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#72d82c] px-4 text-xs font-black text-[#06142d] transition hover:brightness-105 disabled:opacity-60">
              {pdfBusy === 'assessment' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} ANALYSE PDF
            </button>
            <input ref={completedFactSheetRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readCompletedFactSheet(file); event.currentTarget.value = '' }} />
          </div>
        </div>
      </section>

      <form ref={formRef} onSubmit={submit} className="page-container w-full min-w-0 max-w-full overflow-x-hidden !pt-5">
        {completedFactSheet && <div className="mb-4 flex items-center gap-3 rounded-2xl border border-[#72d82c]/35 bg-[#123820]/60 p-3 text-xs text-emerald-100"><FileText className="h-4 w-4 shrink-0 text-[#83e637]" /><span className="min-w-0 flex-1 truncate">Ausgefülltes Eckdatenblatt: {completedFactSheet.name}</span><span className="rounded-full bg-[#83e637]/15 px-2 py-1 font-bold text-[#9bed61]">ANGEGEBEN</span></div>}
        <div className="mb-5 grid grid-cols-2 gap-2 md:grid-cols-4">
          <div className="rounded-2xl border border-[#31517c]/55 bg-[#071a38]/88 p-3"><span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Netzleistung</span><strong className="mt-1 block text-lg text-white">{formatMw(gridMw)}</strong></div>
          <div className="rounded-2xl border border-[#31517c]/55 bg-[#071a38]/88 p-3"><span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">IT-Leistung · PUE {pue.toFixed(2)}</span><strong className="mt-1 block text-lg text-white">{formatMw(itCapacity)}</strong></div>
          <div className="rounded-2xl border border-[#31517c]/55 bg-[#071a38]/88 p-3"><span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Kritisch</span><strong className={`mt-1 block text-lg ${criticalCount ? 'text-rose-400' : 'text-[#83e637]'}`}>{criticalCount}</strong></div>
          <div className="rounded-2xl border border-[#31517c]/55 bg-[#071a38]/88 p-3"><span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Zu prüfen</span><strong className="mt-1 block text-lg text-amber-300">{verifyCount}</strong></div>
        </div>

        <div className="grid min-w-0 max-w-full items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 max-w-full space-y-3">
            <div className="rounded-[1.35rem] border border-[#72d82c]/35 bg-gradient-to-br from-[#123820]/75 to-[#061a38] p-4 md:p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#72d82c]/15 text-[#83e637]"><Bot className="h-5 w-5" /></span>
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#83e637]">EMA KI-SCHNELLCHECK</p>
                  <h2 className="mt-1 text-lg font-black text-white">Drei Angaben genügen für den Start</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-300">Adresse wählen, Netzleistung angeben und vorhandene PDFs hochladen. EMA liest die Unterlagen, berechnet die IT-Leistung und zeigt fehlende Nachweise automatisch.</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[10px] font-bold text-slate-300">
                <span className="rounded-xl border border-white/10 bg-[#04142f]/70 px-2 py-2">1 · STANDORT</span>
                <span className="rounded-xl border border-white/10 bg-[#04142f]/70 px-2 py-2">2 · NETZ</span>
                <span className="rounded-xl border border-white/10 bg-[#04142f]/70 px-2 py-2">3 · PDF</span>
              </div>
            </div>

            <FormCard icon={MapPin} title="STANDORT" subtitle="Adresse wählen – den Rest ergänzt EMA" open>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Adresse" wide>
                  <AddressSearch value={location.address} onChange={(address) => setLocation((current) => ({ ...current, address }))} onSelect={(suggestion) => {
                    setLocation({ ...suggestion })
                    if (!currentFormValue('projectName')) setNativeField('projectName', `Rechenzentrum ${suggestion.city || suggestion.municipality}`)
                  }} />
                </Field>
                <Field label="Projektname · optional"><input name="projectName" className={fieldClass} placeholder="Wird aus dem Standort erzeugt" /></Field>
                <Field label="Grundstücksgröße · optional"><input name="siteAreaSqm" type="number" min="0" step="1" className={fieldClass} placeholder="m²" /></Field>
                <input type="hidden" name="country" value={location.country} />
              </div>
              {(['street', 'houseNumber', 'postalCode', 'city', 'municipality', 'district', 'state'] as const).map((key) => <input key={key} type="hidden" name={key} value={location[key]} />)}
              <input type="hidden" name="latitude" value={location.latitude || ''} />
              <input type="hidden" name="longitude" value={location.longitude || ''} />
              <div className="mt-4 min-w-0 max-w-full overflow-hidden rounded-2xl">
                <DataCenterLocationMap latitude={location.latitude || null} longitude={location.longitude || null} label={location.address} />
              </div>
            </FormCard>

            <FormCard icon={Zap} title="NETZANSCHLUSS" subtitle="Nur Leistung und Status sind erforderlich" open>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Netzanschlussleistung"><div className="relative"><input name="gridCapacityMw" type="number" min="0" step="0.01" value={gridMw ?? ''} onChange={(event) => setGridMw(event.target.value ? Number(event.target.value) : null)} className={`${fieldClass} pr-14`} /><span className="absolute right-3 top-[27px] text-xs text-slate-400">MW</span></div></Field>
                <SelectField name="gridStatus" label="Netzstatus" defaultValue="indicated" onChange={setGridStatus}>
                  <option value="indicated">nur angegeben</option><option value="requested">angefragt</option><option value="grid_study_ongoing">Netzprüfung läuft</option><option value="generally_feasible">grundsätzlich möglich</option><option value="confirmed_in_writing">schriftlich bestätigt</option><option value="contractually_secured">vertraglich gesichert</option>
                </SelectField>
              </div>
              <details className="mt-3 rounded-xl border border-[#31517c]/45 bg-[#061832]">
                <summary className="cursor-pointer list-none px-4 py-3 text-xs font-bold text-slate-300">Weitere Netzangaben · optional</summary>
                <div className="grid gap-4 border-t border-[#31517c]/35 p-4 md:grid-cols-2">
                  <Field label="Netzbetreiber"><input name="gridOperator" className={fieldClass} /></Field>
                  <SelectField name="voltageLevel" label="Netzebene" defaultValue=""><option value="">Nicht bekannt</option><option value="10_kv">10 kV</option><option value="20_kv">20 kV</option><option value="30_kv">30 kV</option><option value="110_kv">110 kV</option><option value="220_kv">220 kV</option><option value="380_kv">380 kV</option></SelectField>
                  <Field label="Übergabepunkt"><input name="pointOfConnection" className={fieldClass} /></Field>
                  <SelectField name="availableFrom" label="Verfügbar ab" defaultValue=""><option value="">Nicht bekannt</option><option value="immediate">Sofort</option>{years.map((year) => <option key={year}>{year}</option>)}</SelectField>
                </div>
              </details>
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" /><span>Eine Statusauswahl ersetzt keinen geprüften Nachweis. Die Netzleistung bleibt bis zur Dokumentenprüfung <strong>NICHT BESTÄTIGT</strong>.</span></div>
            </FormCard>

            <input type="hidden" name="pue" value={pue} />
            <input type="hidden" name="planningStatus" value={planningStatus} />
            <input type="hidden" name="dataCenterUseStatus" value={dataCenterUseStatus} />
            <input type="hidden" name="connectivityStatus" value={connectivityStatus} />
            <input type="hidden" name="carriers" value={carriers} />
            <input type="hidden" name="routeDiversityStatus" value={routeDiversityStatus} />
            {riskFields.map(([name]) => <input key={name} type="hidden" name={name} value={riskValues[name] ?? 'grey'} />)}

            <FormCard icon={WalletCards} title="ANGEBOT" subtitle="Projektmodell, Offtaker und Kaufpreis" open>
              <div className="grid gap-4 md:grid-cols-2">
                <SelectField name="projectModel" label="Projektmodell" defaultValue="greenfield" onChange={setProjectModel}><option value="greenfield">Greenfield / Neuentwicklung</option><option value="existing_building">Bestandsgebäude</option><option value="brownfield_conversion">Brownfield-Umnutzung</option><option value="shell">Gebäudehülle</option><option value="powered_shell">Stromerschlossene Gebäudehülle</option><option value="turnkey">Schlüsselfertige Colocation-Anlage</option></SelectField>
                <SelectField name="offtakerStatus" label="Offtaker-Status" defaultValue="none" onChange={setOfftakerStatus}><option value="none">Keiner</option><option value="searching">Wird gesucht</option><option value="initial_contact">Erstkontakt</option><option value="nda">NDA</option><option value="interest">Interesse</option><option value="loi">LOI</option><option value="hot">HoT / Eckpunktepapier</option><option value="binding_contract">Verbindlicher Vertrag</option></SelectField>
                <SelectField name="purchasePriceMode" label="Preisart" defaultValue="total" onChange={setPurchaseMode}><option value="total">Gesamtkaufpreis</option><option value="per_mw">Preis pro MW</option></SelectField>
                {purchaseMode === 'total' ? <Field label="Gesamtkaufpreis"><div className="relative"><input name="totalPurchasePrice" type="number" min="0" step="1" value={totalPrice ?? ''} onChange={(event) => setTotalPrice(event.target.value ? Number(event.target.value) : null)} className={`${fieldClass} pr-14`} /><span className="absolute right-3 top-[27px] text-xs text-slate-400">EUR</span></div></Field> : <>
                  <Field label="Preis pro MW"><div className="relative"><input name="pricePerMw" type="number" min="0" step="1" value={pricePerMw ?? ''} onChange={(event) => setPricePerMw(event.target.value ? Number(event.target.value) : null)} className={`${fieldClass} pr-20`} /><span className="absolute right-3 top-[27px] text-xs text-slate-400">EUR/MW</span></div></Field>
                  <SelectField name="referenceCapacity" label="Bezugsgröße" defaultValue="" onChange={setReferenceCapacity}><option value="">Zwingend auswählen</option><option value="grid">Netzanschlussleistung in MW</option><option value="it">Geschätzte IT-Leistung in MW</option></SelectField>
                </>}
              </div>
              <details className="mt-3 rounded-xl border border-[#31517c]/45 bg-[#061832]">
                <summary className="cursor-pointer list-none px-4 py-3 text-xs font-bold text-slate-300">Weitere Offtaker-Angaben · optional</summary>
                <div className="grid gap-4 border-t border-[#31517c]/35 p-4 md:grid-cols-2">
                  <Field label="Name des Offtakers"><input name="offtakerName" className={fieldClass} /></Field>
                  <Field label="Angefragte Leistung"><div className="relative"><input name="requestedCapacityMw" type="number" min="0" step="0.01" className={`${fieldClass} pr-14`} /><span className="absolute right-3 top-[27px] text-xs text-slate-400">MW</span></div></Field>
                </div>
              </details>
              <div className="mt-4 rounded-2xl border border-[#69c91e]/35 bg-gradient-to-br from-[#163820]/65 to-[#07251e]/75 p-4"><span className="text-[10px] font-extrabold uppercase tracking-widest text-[#83e637]">Projektkaufpreis</span><strong className="mt-2 block text-2xl text-white">{formatEur(purchasePrice)}</strong><small className="mt-2 block text-slate-300">{purchaseMode === 'per_mw' ? `Bezugsgröße: ${referenceCapacity === 'grid' ? formatMw(gridMw) + ' Netzleistung' : referenceCapacity === 'it' ? formatMw(itCapacity) + ' geschätzte IT-Leistung' : 'nicht gewählt'}` : 'Gesamtkaufpreis'} · Kein CAPEX</small></div>
              {['loi', 'hot'].includes(offtakerStatus) && <p className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/10 p-3 text-xs text-amber-100">LOI und HoT sind kein verbindlicher Offtake-Vertrag.</p>}
            </FormCard>

            <FormCard icon={FileText} title="UNTERLAGEN" subtitle="PDF hochladen – EMA KI liest automatisch" open>
              <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[#4b73a5] bg-[#061a38] px-4 text-center transition hover:border-[#83e637]">
                {importBusy ? <Loader2 className="h-6 w-6 animate-spin text-[#83e637]" /> : <Upload className="h-6 w-6 text-[#83e637]" />}
                <strong className="text-sm text-white">PDF-Unterlagen auswählen</strong>
                <span className="text-[11px] text-slate-400">EMA erkennt Projektdaten und zeigt vor der Übernahme eine Vorschau.</span>
                <input name="documents" type="file" accept="application/pdf,.pdf" multiple className="hidden" onChange={(event) => {
                  const files = Array.from(event.currentTarget.files ?? [])
                  setSelectedDocuments(files.map((file) => file.name))
                  const firstPdf = files.find((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))
                  if (firstPdf) void readCompletedFactSheet(firstPdf, false)
                }} />
              </label>
              {selectedDocuments.length > 0 && <p className="mt-3 text-xs text-emerald-200">{selectedDocuments.length} Unterlage{selectedDocuments.length === 1 ? '' : 'n'} ausgewählt</p>}
              <details className="mt-3 rounded-xl border border-[#31517c]/45 bg-[#061832]"><summary className="cursor-pointer list-none px-4 py-3 text-xs font-bold text-slate-300">Eigene Notiz · optional</summary><div className="border-t border-[#31517c]/35 p-4"><textarea name="notes" rows={3} className={`${fieldClass} resize-y`} /></div></details>
              <p className="mt-3 text-xs leading-5 text-slate-400">Erkannte Angaben bleiben „angegeben“, bis ein belastbarer Nachweis geprüft wurde. Maximal 20 MB pro Datei.</p>
            </FormCard>
          </div>

          <aside className="space-y-3 xl:sticky xl:top-5">
            <div className="rounded-[1.35rem] border border-[#31517c]/60 bg-gradient-to-br from-[#0a244b] to-[#04142f] p-5 shadow-2xl">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#83e637]">EMA Projektbewertung</p>
              <h2 className="mt-2 text-2xl font-black text-white">{criticalCount ? 'KRITISCH' : gridMw && location.address ? 'ENTWICKLUNG' : 'FRÜHPHASE'}</h2>
              <div className="mt-5 space-y-2">
                <div className="flex items-center justify-between rounded-xl border border-[#31517c]/45 bg-[#061832] p-3"><span className="text-xs text-slate-400">Netzleistung</span><strong className="text-sm text-white">{formatMw(gridMw)}</strong></div>
                <div className="flex items-center justify-between rounded-xl border border-[#31517c]/45 bg-[#061832] p-3"><span className="text-xs text-slate-400">Geschätzte IT-Leistung</span><strong className="text-sm text-white">{formatMw(itCapacity)}</strong></div>
                <div className="flex items-center justify-between rounded-xl border border-[#31517c]/45 bg-[#061832] p-3"><span className="text-xs text-slate-400">Projektkaufpreis</span><strong className="text-sm text-white">{formatEur(purchasePrice)}</strong></div>
              </div>
              <div className="mt-5 space-y-2 text-xs">
                <div className="flex items-start gap-2 rounded-xl border border-rose-400/25 bg-rose-500/10 p-3 text-rose-100"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" /><span><strong className="block">{criticalCount} KRITISCH</strong>{!gridMw ? 'Netzanschlussleistung fehlt.' : !['confirmed_in_writing', 'contractually_secured'].includes(gridStatus) ? 'Netzleistung ist nicht bestätigt.' : 'Kritische Punkte aus Eingaben prüfen.'}</span></div>
                <div className="flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-500/10 p-3 text-amber-100"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" /><span><strong className="block">{verifyCount} ZU PRÜFEN</strong>Offene Punkte bleiben bis zum belastbaren Nachweis ungeprüft.</span></div>
                <div className="flex items-start gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-3 text-emerald-100"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#83e637]" /><span><strong className="block">STATUSLOGIK AKTIV</strong>Keine Eingabe wird ohne Nachweis als verifiziert gespeichert.</span></div>
              </div>
              <button type="submit" disabled={pending} className="mt-5 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#62c700] to-[#7dde22] px-5 py-3.5 text-sm font-black text-[#06142d] shadow-[0_12px_32px_rgba(102,204,25,.25)] transition hover:brightness-105 disabled:cursor-wait disabled:opacity-60">
                <Save className="h-4 w-4" /> {pending ? 'PROJEKT WIRD GESPEICHERT …' : 'PROJEKT SPEICHERN'}
              </button>
              <p className="mt-3 text-center text-[11px] leading-4 text-slate-400">Speicherort: <strong className="text-slate-200">EMA Intelligence → Projekte → Rechenzentren</strong>. Danach öffnet sich die vollständige Projektakte.</p>
            </div>
          </aside>
        </div>
      </form>

      {importPreview && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#010817]/85 p-0 backdrop-blur-sm md:items-center md:p-6" role="dialog" aria-modal="true" aria-labelledby="fact-sheet-preview-title">
          <div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-[1.75rem] border border-[#31517c] bg-[#061832] p-5 shadow-2xl md:rounded-[1.75rem] md:p-6">
            <div className="flex items-start gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#83e637]">Vorschau · nicht bestätigt</p>
                <h2 id="fact-sheet-preview-title" className="mt-2 text-xl font-black text-white">NEUES RECHENZENTRUM-PROJEKT ANLEGEN</h2>
                <p className="mt-1 text-xs leading-5 text-slate-400">EMA übernimmt die erkannten Angaben erst nach deiner Bestätigung und markiert sie als angegeben, nicht als verifiziert.</p>
              </div>
              <button type="button" onClick={() => setImportPreview(null)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#31517c] text-slate-300" aria-label="Vorschau schließen"><X className="h-4 w-4" /></button>
            </div>
            <dl className="mt-5 grid gap-2 sm:grid-cols-2">
              {[
                ['Projekt', importPreview.projectName], ['Standort', importPreview.address || importPreview.city],
                ['Netzleistung', importPreview.availablePowerMw === null ? '' : `${importPreview.availablePowerMw} MW`],
                ['Netzstatus', importPreview.gridStatus], ['Netzbetreiber', importPreview.gridOperator], ['Baurecht', importPreview.zoningPlanStatus],
                ['Rechenzentrumsnutzung', importPreview.dataCenterPermitted], ['Glasfaser', importPreview.fiberStatus],
                ['Carrier', importPreview.fiberProvider], ['Projektmodell', importPreview.projectModel],
                ['Offtaker-Status', importPreview.offtakerStatus],
                ['Projektkaufpreis', importPreview.totalPurchasePrice === null ? importPreview.pricePerMw === null ? '' : `${importPreview.pricePerMw} EUR/MW` : `${importPreview.totalPurchasePrice} EUR`],
              ].map(([label, value]) => <div key={label} className="rounded-xl border border-[#31517c]/55 bg-[#04142f] p-3"><dt className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</dt><dd className="mt-1 text-sm font-semibold text-white">{value ? importValueInGerman(String(value)) : 'NICHT VERFÜGBAR'}</dd></div>)}
            </dl>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => setImportPreview(null)} className="min-h-12 rounded-xl border border-[#31517c] px-4 text-xs font-extrabold text-slate-200">ABBRECHEN</button>
              <button type="button" onClick={applyImportPreview} className="min-h-12 rounded-xl bg-[#72d82c] px-4 text-xs font-black text-[#06142d]">ANGABEN ÜBERNEHMEN</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
