import assert from 'node:assert/strict'
import test from 'node:test'
import { buildBilingualCommissionPdf, buildBilingualNdaPdf, DEFAULT_NDA_PURPOSE } from './legalDocuments'

test('standard NDA purpose explicitly covers PV, BESS and wind energy', () => {
  assert.match(DEFAULT_NDA_PURPOSE.de, /Photovoltaik/)
  assert.match(DEFAULT_NDA_PURPOSE.de, /BESS/)
  assert.match(DEFAULT_NDA_PURPOSE.de, /Windenergie/)
  assert.match(DEFAULT_NDA_PURPOSE.en, /photovoltaic/)
  assert.match(DEFAULT_NDA_PURPOSE.en, /battery energy storage system \(BESS\)/)
  assert.match(DEFAULT_NDA_PURPOSE.en, /wind energy/)
})

test('NDA contains complete German and English sections in one PDF', () => {
  const document = buildBilingualNdaPdf({
    company: 'Investor Test GmbH',
    contactPerson: 'Erika Beispiel',
    email: 'erika@example.com',
    phone: '+49 30 123456',
    street: 'Musterstraße 1',
    postalCode: '10115',
    city: 'Berlin',
    country: 'Deutschland',
    representedBy: 'Erika Beispiel',
    signatory: 'Erika Beispiel',
    agreementDate: '2026-08-14',
    purposeDe: 'Prüfung eines BESS-Portfolios.',
    purposeEn: 'Evaluation of a BESS portfolio.',
    duration: 3,
  })

  assert.ok(document.getNumberOfPages() >= 4)
  assert.ok(document.output('arraybuffer').byteLength > 10_000)
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
