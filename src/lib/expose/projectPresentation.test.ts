import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getExposePresentation } from './projectPresentation'
import { renderMemorandumHtml } from '../pdf/projektliste/memorandumTemplate'
import type { MemorandumPdfData } from '../pdf/memorandumPdf'

const germanFormat = {
  number: (value: unknown, digits = 0) => Number(value).toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits }),
  money: (value: unknown) => Number(value).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }),
  tariff: (value: unknown) => `${Number(value).toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} €/kWh`,
}

const englishFormat = {
  number: (value: unknown, digits = 0) => Number(value).toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits }),
  money: (value: unknown) => Number(value).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }),
  tariff: (value: unknown) => `${Number(value).toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} €/kWh`,
}

const pvProject = {
  project_type: 'pv_dach',
  project_stage: 'rtb',
  purchase_price: 359_910,
  pv_kwp: 359.91,
  specific_yield: 993.26,
  feed_in_tariff: 0.0959,
  feed_in_type: 'Volleinspeisung',
  lease_term_years: 20,
  amortisation_years: 11.1,
  dev_status: { netzanschluss: true },
}

describe('getExposePresentation language variants', () => {
  it('keeps the German expose wording', () => {
    const result = getExposePresentation(pvProject, 'Münzenberg, Hessen', germanFormat, 'de')
    assert.equal(result.typeLabel, 'PV-Dachanlage')
    assert.match(result.summary, /vorhandenen technischen und wirtschaftlichen Projektdaten/)
    assert.ok(result.profile.some((row) => row.label === 'Einspeiseart' && row.value === 'Volleinspeisung'))
    assert.ok(result.highlights.some((item) => item.includes('Netzanschluss vorhanden')))
  })

  it('translates project copy, profile values and highlights to English', () => {
    const result = getExposePresentation(pvProject, 'Münzenberg, Hesse', englishFormat, 'en')
    assert.equal(result.typeLabel, 'Rooftop PV')
    assert.match(result.summary, /available technical and financial project data/)
    assert.ok(result.profile.some((row) => row.label === 'Feed-in model' && row.value === 'Full feed-in'))
    assert.ok(result.profile.some((row) => row.label === 'Grid connection' && row.value === 'Available'))
    assert.ok(result.highlights.some((item) => item.includes('Grid connection available')))
    assert.ok(result.metrics.some((metric) => metric.label === 'Payback period' && metric.value === '11,1 years'))
  })

  it('translates data-center assessment sections and unknown values', () => {
    const result = getExposePresentation({
      project_type: 'rechenzentrum',
      project_stage: 'planung',
      data_center_grid_mw: 80,
      data_center_grid_confirmed: false,
      data_center_site_check: {
        siteAreaHectares: 6.7,
        zoningPlanStatus: 'verify',
        dataCenterPermitted: 'planned',
        fiberStatus: 'no',
      },
    }, 'Borna, Saxony', englishFormat, 'en')

    assert.equal(result.typeLabel, 'Data center')
    assert.match(result.summary, /Data center site/)
    assert.ok(result.dataCenterDetails?.sections.some((section) => section.title === 'Fiber connectivity'))
    assert.ok(result.dataCenterDetails?.sections.flatMap((section) => section.rows).some((row) => row.value === 'Not available'))
  })

  it('renders English PDF labels with German-formatted financial values', () => {
    const presentation = getExposePresentation(pvProject, 'Münzenberg, Hesse', englishFormat, 'en')
    const data: MemorandumPdfData = {
      projectName: 'Münzenberg',
      projectNumber: 'PV-2026-001',
      projectType: 'pv_dach',
      typeLabel: presentation.typeLabel,
      location: 'Münzenberg, Hesse',
      country: 'Germany',
      countryFlag: '',
      dateLabel: 'August 2026',
      status: 'RTB',
      summary: presentation.summary,
      metrics: presentation.metrics,
      profile: presentation.profile,
      highlights: presentation.highlights,
      heroImage: '/pdf/hero-solarpark.jpg',
      language: 'en',
      showPvEconomics: true,
      pvEconomics: {
        annualYield: 357_495,
        annualRevenue: 34_289,
        purchasePrice: 359_910,
        tariffEurKwh: 0.0959,
        roi: 9.53,
        amortisation: 11.1,
      },
    }

    const html = renderMemorandumHtml(data, {
      germanyMap: { viewBox: '0 0 100 100', locations: [] },
      fontFaceCss: '',
      heroImage: 'data:image/png;base64,',
    })

    assert.match(html, /Project Profile/)
    assert.match(html, /Financial Metrics/)
    assert.match(html, /Annual production/)
    assert.match(html, /359\.910/)
    assert.match(html, /1\.000 <small>€\/kWp<\/small>/)
    assert.match(html, /0,096 <small>€\/kWh<\/small>/)
    assert.match(html, /11,1/)
    assert.match(html, /CONFIDENTIAL · For the intended recipient only/)
    assert.match(html, /No disclosure or reproduction without the prior written consent of EMA Enterprise GmbH/)
    assert.doesNotMatch(html, /Wirtschaftliche Kennzahlen/)
  })

  it('renders a BESS package sale as one portfolio with site-specific diligence', () => {
    const sites = [
      { name: 'Bopfingen', state: 'Baden-Württemberg', mw: 2, mwh: 4, durationH: 2, gridOperator: 'Netze ODR', gridStatus: 'Netzanschlussvertrag vorhanden', landStatus: 'Mietvertrag unterzeichnet', permitStatus: 'Nicht dokumentiert' },
      { name: 'Kölsa', state: 'Brandenburg', mw: 7.5, mwh: 16.29, durationH: 2.17, gridOperator: 'MITNETZ STROM', gridStatus: 'VOG 413510 · Vertrag offen', landStatus: 'Mietvertrag unterzeichnet', permitStatus: 'Nicht dokumentiert' },
    ]
    const presentation = getExposePresentation({
      project_type: 'bess',
      source_metadata: { bessPortfolio: { isPackageSale: true, sites } },
      dev_status: {},
    }, 'Deutschland', germanFormat, 'de')

    assert.equal(presentation.typeLabel, 'BESS-Portfolio')
    assert.equal(presentation.bessPortfolioDetails?.siteCount, 2)
    assert.equal(presentation.bessPortfolioDetails?.totalMw, 9.5)
    assert.equal(presentation.bessPortfolioDetails?.totalMwh, 20.29)

    const html = renderMemorandumHtml({
      projectName: 'BESS Portfolio Deutschland', projectNumber: 'BESS-2026-001', projectType: 'bess',
      typeLabel: presentation.typeLabel, location: 'Deutschland', country: 'Deutschland', countryFlag: '', dateLabel: 'August 2026', status: 'In Planung',
      summary: presentation.summary, metrics: presentation.metrics, profile: presentation.profile, highlights: presentation.highlights,
      bessPortfolioDetails: presentation.bessPortfolioDetails, heroImage: '/pdf/hero-solarpark.jpg', language: 'de', showPvEconomics: false, pvEconomics: null,
    }, { germanyMap: { viewBox: '0 0 100 100', locations: [] }, fontFaceCss: '', heroImage: 'data:image/png;base64,' })

    assert.match(html, /Portfolio- und Standortprüfung/)
    assert.match(html, /Bopfingen/)
    assert.match(html, /Kölsa/)
    assert.match(html, /VERTRAULICH · Nur für den vorgesehenen Empfänger/)
    assert.match(html, /Keine Weitergabe oder Vervielfältigung ohne vorherige schriftliche Zustimmung der EMA Enterprise GmbH/)
    assert.match(html, /Seite <span class="num">2<\/span> \/ 2/)
  })
})
