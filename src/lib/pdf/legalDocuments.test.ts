import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { buildBilingualCommissionPdf, buildBilingualNdaPdf, DEFAULT_NDA_PURPOSE, NDA_CUSTOMER_PROTECTION } from './legalDocuments'

const legalDocumentAssets = {
  logoDataUrl: `data:image/png;base64,${readFileSync('public/brand/ema-logo.png').toString('base64')}`,
  regularFontBase64: readFileSync('public/fonts/inter/inter-latin-ext-400.ttf').toString('base64'),
  semiBoldFontBase64: readFileSync('public/fonts/inter/inter-latin-ext-600.ttf').toString('base64'),
  boldFontBase64: readFileSync('public/fonts/inter/inter-latin-ext-700.ttf').toString('base64'),
}

test('standard NDA purpose explicitly covers PV, BESS and wind energy', () => {
  assert.match(DEFAULT_NDA_PURPOSE.de, /Photovoltaik/)
  assert.match(DEFAULT_NDA_PURPOSE.de, /BESS/)
  assert.match(DEFAULT_NDA_PURPOSE.de, /Windenergie/)
  assert.match(DEFAULT_NDA_PURPOSE.en, /photovoltaic/)
  assert.match(DEFAULT_NDA_PURPOSE.en, /battery energy storage system \(BESS\)/)
  assert.match(DEFAULT_NDA_PURPOSE.en, /wind energy/)
})

test('NDA customer protection prohibits circumvention for 24 months in both languages', () => {
  assert.match(NDA_CUSTOMER_PROTECTION.de, /Vertragspartner/)
  assert.match(NDA_CUSTOMER_PROTECTION.de, /Umgehung der EMA Enterprise GmbH/)
  assert.match(NDA_CUSTOMER_PROTECTION.de, /24 Monate/)
  assert.match(NDA_CUSTOMER_PROTECTION.de, /schuldhaften Verstoß/)
  assert.match(NDA_CUSTOMER_PROTECTION.de, /billigem Ermessen/)
  assert.match(NDA_CUSTOMER_PROTECTION.de, /zuständige Gericht/)
  assert.match(NDA_CUSTOMER_PROTECTION.de, /Schadensersatzanspruch angerechnet/)
  assert.match(NDA_CUSTOMER_PROTECTION.en, /Contracting Party/)
  assert.match(NDA_CUSTOMER_PROTECTION.en, /circumventing EMA Enterprise GmbH/)
  assert.match(NDA_CUSTOMER_PROTECTION.en, /24 months/)
  assert.match(NDA_CUSTOMER_PROTECTION.en, /culpable breach/)
  assert.match(NDA_CUSTOMER_PROTECTION.en, /reasonable discretion/)
  assert.match(NDA_CUSTOMER_PROTECTION.en, /competent court/)
  assert.match(NDA_CUSTOMER_PROTECTION.en, /credited against any claim for damages/)
})

test('NDA contains complete German and English sections in one PDF', () => {
  const document = buildBilingualNdaPdf({
    company: 'PİXİS CAPİTAL DANIŞMANLIK A.Ş.',
    contactPerson: 'Burak Özcan',
    email: 'burak@pixiscapital.com',
    phone: '+49 30 123456',
    street: 'Musterstraße 1',
    postalCode: '10115',
    city: 'Berlin',
    country: 'Deutschland',
    representedBy: 'Burak Özcan',
    signatory: 'Burak Özcan',
    agreementDate: '2026-08-14',
    purposeDe: 'Prüfung eines BESS-Portfolios.',
    purposeEn: 'Evaluation of a BESS portfolio.',
    duration: 3,
  }, legalDocumentAssets)

  assert.ok(document.getNumberOfPages() >= 4)
  assert.ok(document.output('arraybuffer').byteLength > 100_000)
})

test('NDA can be created without representative and signatory names', () => {
  const document = buildBilingualNdaPdf({
    company: 'Investor Test GmbH',
    contactPerson: '',
    email: 'office@example.com',
    phone: '',
    street: 'Musterstraße 1',
    postalCode: '10115',
    city: 'Berlin',
    country: 'Deutschland',
    representedBy: '',
    signatory: '',
    agreementDate: '2026-08-14',
    purposeDe: '',
    purposeEn: '',
    duration: 3,
  }, legalDocumentAssets)

  assert.ok(document.getNumberOfPages() >= 4)
  assert.ok(document.output('arraybuffer').byteLength > 100_000)
})

test('commission agreement contains German and English pages in one PDF', () => {
  const document = buildBilingualCommissionPdf({
    company: 'Investor Test GmbH',
    contact: 'Erika Beispiel',
    email: 'erika@example.com',
    phone: '+49 30 123456',
    address: 'Musterstraße 1, 10115 Berlin, Deutschland',
    project: 'BESS Portfolio',
    projectNumber: 'EMA-2026-001',
    date: '2026-08-14',
    model: 'percent',
    rate: '2,5',
    size: '',
    purchasePrice: '10000000',
    paymentTerm: 'closing',
    total: 250000,
  })

  assert.equal(document.getNumberOfPages(), 2)
  assert.ok(document.output('arraybuffer').byteLength > 5_000)
})
