export interface MemorandumPdfData {
  projectName: string
  projectNumber: string
  projectType: string
  typeLabel: string
  location: string
  country: string
  countryFlag: string
  dateLabel: string
  status: string
  summary: string
  metrics: Array<{ label: string; value: string }>
  profile: Array<{ label: string; value: string }>
  highlights: string[]
  heroImage: string
  projectImage?: string
  language?: 'de' | 'en'
  showPvEconomics: boolean
  latitude?: number | null
  longitude?: number | null
  pvEconomics: {
    annualYield: number
    annualRevenue: number
    purchasePrice: number
    tariffEurKwh: number
    roi: number
    amortisation: number
  } | null
}

export type PdfGenerationStep = 'Daten prüfen' | 'PDF erzeugen' | 'PDF empfangen'

export class PdfGenerationError extends Error {
  readonly step: PdfGenerationStep
  readonly cause?: unknown

  constructor(step: PdfGenerationStep, message: string, cause?: unknown) {
    super(message)
    this.name = 'PdfGenerationError'
    this.step = step
    this.cause = cause
  }
}

export async function generateMemorandumPdf(data: MemorandumPdfData): Promise<Blob> {
  if (!data?.projectName?.trim()) throw new PdfGenerationError('Daten prüfen', 'Der Projektname fehlt.')

  let response: Response
  try {
    response = await fetch('/api/memorandum/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      cache: 'no-store',
    })
  } catch (error) {
    throw new PdfGenerationError('PDF erzeugen', 'Der PDF-Dienst konnte nicht erreicht werden.', error)
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null
    throw new PdfGenerationError('PDF erzeugen', payload?.error || 'Das Investment Memorandum konnte nicht erzeugt werden.')
  }

  try {
    return await response.blob()
  } catch (error) {
    throw new PdfGenerationError('PDF empfangen', 'Die erzeugte PDF konnte nicht geladen werden.', error)
  }
}
