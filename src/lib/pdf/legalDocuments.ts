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

type LegalLanguage = 'de' | 'en'

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

function addPageNumbers(doc: jsPDF, label: string) {
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(120)
    doc.text(`${EMA.company} · ${label} · DE/EN · ${page}/${pages}`, 105, 290, { align: 'center' })
  }
}

export function buildBilingualNdaPdf(data: BilingualNdaData) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const agreementDate = documentDate(data.agreementDate)
  const expiryDate = addYears(agreementDate, data.duration)

  const renderLanguage = (language: LegalLanguage, firstPage: boolean) => {
    if (!firstPage) doc.addPage()
    const isDe = language === 'de'
    const margin = 20
    const width = 170
    let y = 20
    const agreementDateText = dateLabel(agreementDate, language)
    const expiryDateText = dateLabel(expiryDate, language)
    const purpose = (isDe ? data.purposeDe : data.purposeEn).trim() || (isDe
      ? 'Prüfung und Vorbereitung einer möglichen geschäftlichen Zusammenarbeit.'
      : 'Evaluation and preparation of a potential business cooperation.')
    const ensureSpace = (needed = 22) => {
      if (y + needed > 278) {
        doc.addPage()
        y = 20
      }
    }
    const heading = (text: string) => {
      ensureSpace(18)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(31, 42, 68)
      doc.text(text, margin, y)
      y += 8
    }
    const paragraph = (text: string) => {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9.5)
      doc.setTextColor(35, 43, 58)
      const lines = doc.splitTextToSize(text, width)
      ensureSpace(lines.length * 4.5 + 5)
      doc.text(lines, margin, y)
      y += lines.length * 4.5 + 5
    }
    const header = () => {
      doc.setFillColor(11, 22, 51)
      doc.rect(0, 0, 210, 34, 'F')
      doc.setFillColor(92, 184, 0)
      doc.rect(0, 34, 210, 2.5, 'F')
      doc.setTextColor(255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(18)
      doc.text(isDe ? 'GEHEIMHALTUNGSVEREINBARUNG' : 'NON-DISCLOSURE AGREEMENT', margin, 18)
      doc.setFontSize(8.5)
      doc.text(isDe ? 'DEUTSCHE FASSUNG' : 'ENGLISH VERSION', 190, 18, { align: 'right' })
      doc.setFontSize(9)
      doc.text(EMA.company, margin, 27)
      y = 48
    }

    header()
    paragraph(isDe
      ? `Diese gegenseitige Geheimhaltungsvereinbarung wird am ${agreementDateText} geschlossen zwischen:`
      : `This mutual Non-Disclosure Agreement is entered into on ${agreementDateText} by and between:`)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(EMA.company, margin, y)
    y += 5
    paragraph(`${EMA.street}, ${EMA.postalCode} ${EMA.city}, ${isDe ? EMA.countryDe : EMA.countryEn}\n${isDe ? 'vertreten durch' : 'represented by'} ${EMA.representedBy}`)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(data.company, margin, y)
    y += 5
    paragraph(`${data.street}, ${data.postalCode} ${data.city}, ${data.country}\n${isDe ? 'vertreten durch' : 'represented by'} ${data.representedBy}${data.contactPerson ? `\n${isDe ? 'Ansprechpartner' : 'Contact person'}: ${data.contactPerson}` : ''}${data.email ? ` · ${data.email}` : ''}${data.phone ? ` · ${data.phone}` : ''}`)

    heading(isDe ? '1. Zweck' : '1. Purpose')
    paragraph(isDe ? `Die Parteien beabsichtigen, vertrauliche Informationen ausschließlich zu folgendem Zweck auszutauschen: ${purpose}` : `The parties intend to exchange confidential information solely for the following purpose: ${purpose}`)
    heading(isDe ? '2. Vertrauliche Informationen' : '2. Confidential Information')
    paragraph(isDe ? 'Als vertraulich gelten alle mündlich, schriftlich, elektronisch oder in sonstiger Form offengelegten kaufmännischen, technischen, finanziellen, rechtlichen und projektbezogenen Informationen, sofern sie als vertraulich gekennzeichnet sind oder nach den Umständen als vertraulich anzusehen sind.' : 'Confidential Information means all commercial, technical, financial, legal and project-related information disclosed orally, in writing, electronically or in any other form, where such information is marked confidential or should reasonably be understood to be confidential under the circumstances.')
    heading(isDe ? '3. Pflichten der Parteien' : '3. Obligations of the Parties')
    paragraph(isDe ? 'Die empfangende Partei wird vertrauliche Informationen sorgfältig schützen, nur für den vereinbarten Zweck verwenden und ausschließlich solchen Beschäftigten, Beratern oder verbundenen Unternehmen zugänglich machen, die diese Informationen für den Zweck benötigen und zu entsprechender Vertraulichkeit verpflichtet sind.' : 'The receiving party shall protect Confidential Information with due care, use it only for the agreed purpose and disclose it only to employees, advisers or affiliated companies who need it for that purpose and are bound by appropriate confidentiality obligations.')
    heading(isDe ? '4. Ausnahmen' : '4. Exclusions')
    paragraph(isDe ? 'Die Verpflichtungen gelten nicht für Informationen, die nachweislich bereits öffentlich bekannt waren, ohne Vertragsverletzung öffentlich bekannt werden, der empfangenden Partei rechtmäßig bereits bekannt waren, rechtmäßig von Dritten erlangt wurden oder unabhängig entwickelt wurden. Gesetzlich zwingende Offenlegungen bleiben zulässig; die andere Partei ist, soweit rechtlich möglich, vorher zu informieren.' : 'The obligations do not apply to information demonstrably already public, becoming public without breach, lawfully known to the receiving party, lawfully obtained from a third party or independently developed. Disclosures required by law remain permitted; where legally possible, the other party shall be informed in advance.')
    heading(isDe ? '5. Laufzeit und Vertraulichkeitsdauer' : '5. Term and Confidentiality Period')
    paragraph(isDe ? `Diese Vereinbarung gilt ab dem ${agreementDateText}. Die Verpflichtung zur Vertraulichkeit besteht für ${data.duration} ${data.duration === 1 ? 'Jahr' : 'Jahre'} und endet am ${expiryDateText}.` : `This Agreement is effective from ${agreementDateText}. The confidentiality obligations remain in force for ${data.duration} ${data.duration === 1 ? 'year' : 'years'} and expire on ${expiryDateText}.`)
    heading(isDe ? '6. Rückgabe und Löschung' : '6. Return and Deletion')
    paragraph(isDe ? 'Auf schriftliche Aufforderung sind vertrauliche Informationen und angefertigte Kopien zurückzugeben oder zu löschen, soweit keine gesetzlichen Aufbewahrungspflichten entgegenstehen.' : 'Upon written request, Confidential Information and copies shall be returned or deleted, unless statutory retention obligations require otherwise.')
    heading(isDe ? '7. Keine Rechteübertragung' : '7. No Transfer of Rights')
    paragraph(isDe ? 'Durch diese Vereinbarung werden keine Lizenzen, Eigentumsrechte oder sonstigen Nutzungsrechte übertragen. Keine Partei ist zum Abschluss eines weiteren Geschäfts verpflichtet.' : 'This Agreement does not transfer any licence, ownership right or other right of use. Neither party is obliged to enter into any further transaction.')
    heading(isDe ? '8. Schlussbestimmungen' : '8. Final Provisions')
    paragraph(isDe ? 'Änderungen und Ergänzungen bedürfen der Textform. Sollte eine Bestimmung unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt. Es gilt deutsches Recht. Soweit gesetzlich zulässig, ist Gerichtsstand der Sitz der EMA Enterprise GmbH. Bei Widersprüchen zwischen den Sprachfassungen ist die deutsche Fassung maßgeblich.' : 'Amendments must be made in text form. If any provision is invalid, the remaining provisions remain effective. German law applies. To the extent legally permitted, the venue shall be the registered office of EMA Enterprise GmbH. In the event of inconsistencies between the language versions, the German version shall prevail.')

    ensureSpace(45)
    y += 5
    doc.setDrawColor(120)
    doc.line(margin, y + 18, 88, y + 18)
    doc.line(122, y + 18, 190, y + 18)
    doc.setFontSize(8.5)
    doc.setTextColor(50)
    doc.text(`${EMA.company}\n${EMA.representedBy}`, margin, y + 24)
    doc.text(`${data.company}\n${data.signatory}`, 122, y + 24)
  }

  renderLanguage('de', true)
  renderLanguage('en', false)
  addPageNumbers(doc, 'NDA')
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
