import { addYears, format } from 'date-fns'
import { de, enUS } from 'date-fns/locale'
import { jsPDF } from 'jspdf'

const EMA = {
  company: 'EMA Enterprise GmbH',
  street: 'Gabriel-von-Seidl-Str. 57',
  postalCode: '67550',
  city: 'Worms',
  countryDe: 'Deutschland',
  countryEn: 'Germany',
  representedBy: 'Ali Ünlüer',
}

export const DEFAULT_NDA_PURPOSE = {
  de: 'Prüfung, Bewertung, Strukturierung und Vorbereitung einer möglichen geschäftlichen Zusammenarbeit, Investition, Vermittlung oder Akquisition im Zusammenhang mit Photovoltaik-, Batteriespeicher- (BESS) und Windenergieprojekten sowie den dazugehörigen Unternehmen, Vermögenswerten und Projektrechten.',
  en: 'Review, evaluation, structuring and preparation of a potential business cooperation, investment, brokerage or acquisition relating to photovoltaic, battery energy storage system (BESS) and wind energy projects, including the associated companies, assets and project rights.',
} as const

export const NDA_CUSTOMER_PROTECTION = {
  de: 'Der Vertragspartner verpflichtet sich, die ihm durch die EMA Enterprise GmbH im Zusammenhang mit dem Vertragszweck vermittelten oder offengelegten Kontakte - insbesondere Kunden, Projektentwickler, Grundstückseigentümer, Geschäftspartner und sonstige Netzwerkpartner - ohne vorherige schriftliche Zustimmung der EMA Enterprise GmbH weder direkt noch indirekt geschäftlich zu kontaktieren, mit ihnen Verhandlungen aufzunehmen oder Geschäfte unter Ausschluss beziehungsweise Umgehung der EMA Enterprise GmbH anzubahnen oder abzuschließen. Diese Verpflichtung gilt für die Dauer der Zusammenarbeit sowie für 24 Monate nach deren Beendigung.\n\nFür jeden schuldhaften Verstoß gegen die vorstehenden Verpflichtungen hat der Vertragspartner eine angemessene Vertragsstrafe zu zahlen. Die Höhe wird von der EMA Enterprise GmbH im Einzelfall nach billigem Ermessen festgesetzt und ist im Streitfall durch das zuständige Gericht auf ihre Angemessenheit überprüfbar. Die Geltendmachung eines weitergehenden Schadens bleibt unberührt; eine gezahlte Vertragsstrafe wird auf einen etwaigen Schadensersatzanspruch angerechnet.',
  en: 'The Contracting Party undertakes not to contact, directly or indirectly and for business purposes, any contacts introduced or disclosed to it by EMA Enterprise GmbH in connection with the Purpose - including in particular customers, project developers, landowners, business partners and other network partners - nor to initiate negotiations or enter into transactions with them by excluding or circumventing EMA Enterprise GmbH, without the prior written consent of EMA Enterprise GmbH. This obligation applies throughout the cooperation and for 24 months following its termination.\n\nFor each culpable breach of the foregoing obligations, the Contracting Party shall pay an appropriate contractual penalty. The amount shall be determined by EMA Enterprise GmbH in each individual case at its reasonable discretion and shall, in the event of a dispute, be subject to review by the competent court as to its reasonableness. The right to claim further damages remains unaffected; any contractual penalty paid shall be credited against any claim for damages.',
} as const

type LegalLanguage = 'de' | 'en'

export type LegalDocumentAssets = {
  logoDataUrl?: string
  regularFontBase64?: string
  semiBoldFontBase64?: string
  boldFontBase64?: string
}

export type BilingualNdaData = {
  company: string
  contactPerson: string
  email: string
  phone: string
  street: string
  postalCode: string
  city: string
  country: string
  representedBy: string
  signatory: string
  agreementDate: string
  purposeDe: string
  purposeEn: string
  duration: 1 | 2 | 3
}

export type BilingualCommissionData = {
  company: string
  contact: string
  email: string
  phone: string
  address: string
  project: string
  projectNumber: string
  date: string
  model: string
  rate: string
  size: string
  purchasePrice: string
  paymentTerm: string
  total: number
}

function documentDate(value: string) {
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? new Date() : date
}

function dateLabel(value: Date, language: LegalLanguage) {
  return language === 'de'
    ? format(value, 'dd.MM.yyyy', { locale: de })
    : format(value, 'MMMM d, yyyy', { locale: enUS })
}

function money(value: number, language: LegalLanguage) {
  return new Intl.NumberFormat(language === 'de' ? 'de-DE' : 'en-GB', {
    style: 'currency',
    currency: 'EUR',
  }).format(value || 0)
}

function configureDocumentFonts(doc: jsPDF, assets?: LegalDocumentAssets) {
  if (!assets?.regularFontBase64 || !assets.semiBoldFontBase64 || !assets.boldFontBase64) return 'helvetica'

  doc.addFileToVFS('Inter-Regular.ttf', assets.regularFontBase64)
  doc.addFileToVFS('Inter-SemiBold.ttf', assets.semiBoldFontBase64)
  doc.addFileToVFS('Inter-Bold.ttf', assets.boldFontBase64)
  doc.addFont('Inter-Regular.ttf', 'Inter', 'normal')
  doc.addFont('Inter-SemiBold.ttf', 'Inter', 'bold')
  doc.addFont('Inter-Bold.ttf', 'Inter', 'bolditalic')
  return 'Inter'
}

function addPageNumbers(doc: jsPDF, label: string, fontFamily = 'helvetica') {
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page)
    doc.setDrawColor(226, 231, 238)
    doc.setLineWidth(0.25)
    doc.line(18, 281.5, 192, 281.5)
    doc.setFont(fontFamily, 'normal')
    doc.setFontSize(7)
    doc.setTextColor(112, 121, 137)
    doc.text(`${EMA.company} · ${label} · DE/EN`, 18, 288)
    doc.text(`${page} / ${pages}`, 192, 288, { align: 'right' })
  }
}

export function buildBilingualNdaPdf(data: BilingualNdaData, assets?: LegalDocumentAssets) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const fontFamily = configureDocumentFonts(doc, assets)
  const agreementDate = documentDate(data.agreementDate)
  const expiryDate = addYears(agreementDate, data.duration)

  const navy: [number, number, number] = [31, 42, 68]
  const deepNavy: [number, number, number] = [11, 22, 51]
  const green: [number, number, number] = [92, 184, 0]
  const body: [number, number, number] = [46, 55, 72]
  const muted: [number, number, number] = [105, 116, 133]
  const border: [number, number, number] = [222, 228, 236]
  const panel: [number, number, number] = [247, 249, 252]

  const renderLanguage = (language: LegalLanguage, firstPage: boolean) => {
    if (!firstPage) doc.addPage()
    const isDe = language === 'de'
    const margin = 18
    const width = 174
    let y = 0
    const agreementDateText = dateLabel(agreementDate, language)
    const expiryDateText = dateLabel(expiryDate, language)
    const purpose = (isDe ? data.purposeDe : data.purposeEn).trim() || DEFAULT_NDA_PURPOSE[language]

    const addLogo = (x: number, yPosition: number, logoWidth: number) => {
      if (assets?.logoDataUrl) {
        doc.addImage(assets.logoDataUrl, 'PNG', x, yPosition, logoWidth, logoWidth / 2.1548, 'EMA_LEGAL_LOGO', 'FAST')
        return
      }
      doc.setFont(fontFamily, 'bold')
      doc.setFontSize(14)
      doc.setTextColor(...navy)
      doc.text('EMA', x, yPosition + 6)
      doc.setFontSize(6.5)
      doc.setTextColor(...muted)
      doc.text('ENTERPRISE GmbH', x, yPosition + 11)
    }

    const continuationHeader = () => {
      addLogo(margin, 8.5, 33)
      doc.setFont(fontFamily, 'bold')
      doc.setFontSize(7.1)
      doc.setTextColor(...navy)
      doc.text(isDe ? 'GEHEIMHALTUNGSVEREINBARUNG' : 'NON-DISCLOSURE AGREEMENT', 192, 14, { align: 'right' })
      doc.setFont(fontFamily, 'normal')
      doc.setTextColor(...muted)
      doc.text(isDe ? 'DEUTSCHE FASSUNG · FORTSETZUNG' : 'ENGLISH VERSION · CONTINUED', 192, 20, { align: 'right' })
      doc.setDrawColor(...border)
      doc.setLineWidth(0.35)
      doc.line(margin, 29.5, 192, 29.5)
      doc.setDrawColor(...green)
      doc.setLineWidth(1.1)
      doc.line(margin, 29.5, 48, 29.5)
      y = 40
    }

    const ensureSpace = (needed = 22) => {
      if (y + needed > 274) {
        doc.addPage()
        continuationHeader()
      }
    }

    const section = (heading: string, text: string) => {
      doc.setFont(fontFamily, 'normal')
      doc.setFontSize(9)
      const lines = doc.splitTextToSize(text, width - 11) as string[]
      const requiredHeight = 11 + lines.length * 4.35 + 5
      ensureSpace(requiredHeight)

      const match = heading.match(/^(\d+)\.\s*(.*)$/)
      const number = match?.[1] ?? ''
      const title = match?.[2] ?? heading
      doc.setFillColor(...navy)
      doc.roundedRect(margin, y - 5.1, 7.4, 7.4, 2, 2, 'F')
      doc.setFont(fontFamily, 'bold')
      doc.setFontSize(7.3)
      doc.setTextColor(255, 255, 255)
      doc.text(number, margin + 3.7, y - 0.25, { align: 'center' })
      doc.setFontSize(10.4)
      doc.setTextColor(...navy)
      doc.text(title, margin + 11, y)
      y += 8
      doc.setFont(fontFamily, 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...body)
      doc.text(lines, margin + 11, y, { lineHeightFactor: 1.38 })
      y += lines.length * 4.35 + 7
    }

    addLogo(margin, 9, 43)
    doc.setFillColor(239, 248, 231)
    doc.roundedRect(157, 9.5, 35, 8, 4, 4, 'F')
    doc.setFont(fontFamily, 'bold')
    doc.setFontSize(6.6)
    doc.setTextColor(67, 131, 10)
    doc.text(isDe ? 'VERTRAULICH' : 'CONFIDENTIAL', 174.5, 14.6, { align: 'center' })
    doc.setFont(fontFamily, 'normal')
    doc.setFontSize(7.1)
    doc.setTextColor(...muted)
    doc.text(isDe ? 'DEUTSCHE FASSUNG' : 'ENGLISH VERSION', 192, 24, { align: 'right' })
    doc.text(`NDA · ${agreementDateText}`, 192, 30, { align: 'right' })
    doc.setFont(fontFamily, 'bold')
    doc.setFontSize(7.2)
    doc.setTextColor(...green)
    doc.text(isDe ? 'LEGAL DOCUMENTS · GEGENSEITIGE VEREINBARUNG' : 'LEGAL DOCUMENTS · MUTUAL AGREEMENT', margin, 41)
    doc.setFontSize(isDe ? 20 : 19)
    doc.setTextColor(...deepNavy)
    doc.text(isDe ? 'Geheimhaltungsvereinbarung' : 'Non-Disclosure Agreement', margin, 53)
    doc.setFillColor(...green)
    doc.rect(margin, 60, 22, 1.3, 'F')
    doc.setDrawColor(...border)
    doc.setLineWidth(0.35)
    doc.line(43, 60.6, 192, 60.6)
    doc.setFont(fontFamily, 'normal')
    doc.setFontSize(8.6)
    doc.setTextColor(...body)
    doc.text(isDe
      ? `Geschlossen am ${agreementDateText} zwischen den folgenden Parteien.`
      : `Entered into on ${agreementDateText} by and between the following parties.`, margin, 71)

    const partyCard = (x: number, label: string, company: string, addressLines: string[]) => {
      const cardWidth = 84
      const cardHeight = 42
      doc.setFillColor(...panel)
      doc.setDrawColor(...border)
      doc.setLineWidth(0.25)
      doc.roundedRect(x, 79, cardWidth, cardHeight, 2.8, 2.8, 'FD')
      doc.setFillColor(...green)
      doc.roundedRect(x, 79, 2.2, cardHeight, 1.1, 1.1, 'F')
      doc.setFont(fontFamily, 'bold')
      doc.setFontSize(6.6)
      doc.setTextColor(...muted)
      doc.text(label.toUpperCase(), x + 7, 87)
      doc.setFontSize(9.2)
      doc.setTextColor(...navy)
      const companyLines = doc.splitTextToSize(company, cardWidth - 14) as string[]
      doc.text(companyLines.slice(0, 2), x + 7, 94, { lineHeightFactor: 1.2 })
      const detailY = 101 + Math.max(0, companyLines.slice(0, 2).length - 1) * 4
      doc.setFont(fontFamily, 'normal')
      doc.setFontSize(7.15)
      doc.setTextColor(...body)
      const details = doc.splitTextToSize(addressLines.filter(Boolean).join('\n'), cardWidth - 14) as string[]
      doc.text(details.slice(0, 4), x + 7, detailY, { lineHeightFactor: 1.32 })
    }

    partyCard(margin, isDe ? 'Partei 01 · Offenlegende Partei' : 'Party 01 · Disclosing Party', EMA.company, [
      `${EMA.street}, ${EMA.postalCode} ${EMA.city}`,
      isDe ? EMA.countryDe : EMA.countryEn,
      `${isDe ? 'Vertreten durch' : 'Represented by'} ${EMA.representedBy}`,
    ])
    partyCard(108, isDe ? 'Partei 02 · Vertragspartner' : 'Party 02 · Contracting Party', data.company, [
      `${data.street}, ${data.postalCode} ${data.city}`,
      data.country,
      `${isDe ? 'Vertreten durch' : 'Represented by'} ${data.representedBy}`,
      data.contactPerson ? `${isDe ? 'Kontakt' : 'Contact'}: ${data.contactPerson}` : '',
      data.email,
    ])
    y = 137

    section(isDe ? '1. Zweck' : '1. Purpose', isDe ? `Die Parteien beabsichtigen, vertrauliche Informationen ausschließlich zu folgendem Zweck auszutauschen: ${purpose}` : `The parties intend to exchange confidential information solely for the following purpose: ${purpose}`)
    section(isDe ? '2. Vertrauliche Informationen' : '2. Confidential Information', isDe ? 'Als vertraulich gelten alle mündlich, schriftlich, elektronisch oder in sonstiger Form offengelegten kaufmännischen, technischen, finanziellen, rechtlichen und projektbezogenen Informationen, sofern sie als vertraulich gekennzeichnet sind oder nach den Umständen als vertraulich anzusehen sind.' : 'Confidential Information means all commercial, technical, financial, legal and project-related information disclosed orally, in writing, electronically or in any other form, where such information is marked confidential or should reasonably be understood to be confidential under the circumstances.')
    section(isDe ? '3. Kundenschutz und Umgehungsverbot' : '3. Customer Protection and Non-Circumvention', NDA_CUSTOMER_PROTECTION[language])
    section(isDe ? '4. Pflichten der Parteien' : '4. Obligations of the Parties', isDe ? 'Die empfangende Partei wird vertrauliche Informationen sorgfältig schützen, nur für den vereinbarten Zweck verwenden und ausschließlich solchen Beschäftigten, Beratern oder verbundenen Unternehmen zugänglich machen, die diese Informationen für den Zweck benötigen und zu entsprechender Vertraulichkeit verpflichtet sind.' : 'The receiving party shall protect Confidential Information with due care, use it only for the agreed purpose and disclose it only to employees, advisers or affiliated companies who need it for that purpose and are bound by appropriate confidentiality obligations.')
    section(isDe ? '5. Ausnahmen' : '5. Exclusions', isDe ? 'Die Verpflichtungen gelten nicht für Informationen, die nachweislich bereits öffentlich bekannt waren, ohne Vertragsverletzung öffentlich bekannt werden, der empfangenden Partei rechtmäßig bereits bekannt waren, rechtmäßig von Dritten erlangt wurden oder unabhängig entwickelt wurden. Gesetzlich zwingende Offenlegungen bleiben zulässig; die andere Partei ist, soweit rechtlich möglich, vorher zu informieren.' : 'The obligations do not apply to information demonstrably already public, becoming public without breach, lawfully known to the receiving party, lawfully obtained from a third party or independently developed. Disclosures required by law remain permitted; where legally possible, the other party shall be informed in advance.')
    section(isDe ? '6. Laufzeit und Vertraulichkeitsdauer' : '6. Term and Confidentiality Period', isDe ? `Diese Vereinbarung gilt ab dem ${agreementDateText}. Die Verpflichtung zur Vertraulichkeit besteht für ${data.duration} ${data.duration === 1 ? 'Jahr' : 'Jahre'} und endet am ${expiryDateText}.` : `This Agreement is effective from ${agreementDateText}. The confidentiality obligations remain in force for ${data.duration} ${data.duration === 1 ? 'year' : 'years'} and expire on ${expiryDateText}.`)
    section(isDe ? '7. Schlussbestimmungen' : '7. Final Provisions', isDe ? 'Änderungen und Ergänzungen bedürfen der Textform. Sollte eine Bestimmung unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt. Es gilt deutsches Recht. Soweit gesetzlich zulässig, ist Gerichtsstand der Sitz der EMA Enterprise GmbH. Bei Widersprüchen zwischen den Sprachfassungen ist die deutsche Fassung maßgeblich.' : 'Amendments must be made in text form. If any provision is invalid, the remaining provisions remain effective. German law applies. To the extent legally permitted, the venue shall be the registered office of EMA Enterprise GmbH. In the event of inconsistencies between the language versions, the German version shall prevail.')

    ensureSpace(52)
    y += 3
    doc.setFillColor(...panel)
    doc.setDrawColor(...border)
    doc.roundedRect(margin, y, width, 43, 3, 3, 'FD')
    doc.setFont(fontFamily, 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...muted)
    doc.text(isDe ? 'UNTERSCHRIFTEN' : 'SIGNATURES', margin + 7, y + 8)
    doc.setDrawColor(159, 168, 183)
    doc.setLineWidth(0.3)
    doc.line(margin + 7, y + 25, 91, y + 25)
    doc.line(119, y + 25, 185, y + 25)
    doc.setFontSize(7.5)
    doc.setTextColor(...body)
    doc.text(`${EMA.company}\n${EMA.representedBy}`, margin + 7, y + 31, { lineHeightFactor: 1.3 })
    doc.text(`${data.company}\n${data.signatory}`, 119, y + 31, { lineHeightFactor: 1.3 })
  }

  renderLanguage('de', true)
  renderLanguage('en', false)
  addPageNumbers(doc, 'NDA', fontFamily)
  doc.setProperties({
    title: `NDA – ${data.company} – DE/EN`,
    subject: 'Mutual Non-Disclosure Agreement / Gegenseitige Geheimhaltungsvereinbarung',
    author: EMA.company,
    creator: 'EMA Intelligence',
  })
  return doc
}

const paymentTermLabels: Record<string, Record<LegalLanguage, string>> = {
  signature: { de: 'Nach Vertragsunterzeichnung', en: 'Upon signing the agreement' },
  receipt: { de: 'Nach Zahlungseingang', en: 'Upon receipt of payment' },
  closing: { de: 'Nach Closing', en: 'Upon closing' },
  grid_connection: { de: 'Nach Netzanschluss', en: 'Upon grid connection' },
  individual: { de: 'Individuell', en: 'Individual arrangement' },
}

export function buildBilingualCommissionPdf(data: BilingualCommissionData) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  const renderLanguage = (language: LegalLanguage, firstPage: boolean) => {
    if (!firstPage) doc.addPage()
    const isDe = language === 'de'
    doc.setFillColor(11, 22, 51)
    doc.rect(0, 0, 210, 34, 'F')
    doc.setFillColor(92, 184, 0)
    doc.rect(0, 34, 210, 2.5, 'F')
    doc.setTextColor(255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.text(isDe ? 'PROVISIONSVEREINBARUNG' : 'COMMISSION AGREEMENT', 20, 19)
    doc.setFontSize(8.5)
    doc.text(isDe ? 'DEUTSCHE FASSUNG' : 'ENGLISH VERSION', 190, 19, { align: 'right' })
    doc.setFontSize(9)
    doc.text(EMA.company, 20, 28)
    doc.setTextColor(31, 42, 68)
    doc.setFontSize(11)
    let y = 52
    const line = (label: string, value: string) => {
      doc.setFont('helvetica', 'bold')
      doc.text(label, 20, y)
      doc.setFont('helvetica', 'normal')
      doc.text(value || '—', 72, y)
      y += 9
    }
    line(isDe ? 'Vertragspartner' : 'Contracting party', data.company)
    line(isDe ? 'Ansprechpartner' : 'Contact person', data.contact)
    line('E-Mail', data.email)
    line(isDe ? 'Telefon' : 'Phone', data.phone)
    line(isDe ? 'Anschrift' : 'Address', data.address)
    line(isDe ? 'Projekt' : 'Project', data.project)
    line(isDe ? 'Projektnummer' : 'Project number', data.projectNumber)
    line(isDe ? 'Vertragsdatum' : 'Agreement date', dateLabel(documentDate(data.date), language))
    const modelLabel = data.model === 'flat' ? (isDe ? 'Pauschalbetrag' : 'Flat fee') : data.model === 'pv' ? '€/kWp (PV)' : data.model === 'bess' ? '€/MWh (BESS)' : (isDe ? 'Prozent' : 'Percentage')
    line(isDe ? 'Provisionsmodell' : 'Commission model', modelLabel)
    if (data.model === 'flat') line(isDe ? 'Pauschalbetrag' : 'Flat fee', money(data.total, language))
    if (data.model === 'pv') {
      line('€/kWp', data.rate)
      line(isDe ? 'Anlagengröße' : 'Plant size', `${data.size} kWp`)
    }
    if (data.model === 'bess') {
      line('€/MWh', data.rate)
      line(isDe ? 'Speichergröße' : 'Storage size', `${data.size} MWh`)
    }
    if (data.model === 'percent') {
      line(isDe ? 'Provisionssatz' : 'Commission rate', `${data.rate} %`)
      line(isDe ? 'Kaufpreis' : 'Purchase price', money(Number(data.purchasePrice.replace(',', '.')) || 0, language))
    }
    line(isDe ? 'Gesamtprovision' : 'Total commission', money(data.total, language))
    line(isDe ? 'Zahlungsbedingung' : 'Payment term', paymentTermLabels[data.paymentTerm]?.[language] ?? data.paymentTerm)
    y += 12
    doc.setFontSize(9)
    doc.setTextColor(70)
    const text = isDe
      ? 'Die Provision wird gemäß dem oben gewählten Modell berechnet und nach Eintritt der vereinbarten Zahlungsbedingung fällig. Änderungen bedürfen der Textform. Bei Widersprüchen zwischen den Sprachfassungen ist die deutsche Fassung maßgeblich.'
      : 'The commission is calculated according to the model selected above and becomes due when the agreed payment condition is met. Amendments must be made in text form. In the event of inconsistencies between the language versions, the German version shall prevail.'
    doc.text(doc.splitTextToSize(text, 170), 20, y)
    y += 35
    doc.setDrawColor(120)
    doc.line(20, y, 88, y)
    doc.line(122, y, 190, y)
    doc.setFontSize(8)
    doc.text(EMA.company, 20, y + 6)
    doc.text(data.company, 122, y + 6)
  }

  renderLanguage('de', true)
  renderLanguage('en', false)
  addPageNumbers(doc, 'Provisionsvereinbarung / Commission Agreement')
  return doc
}
