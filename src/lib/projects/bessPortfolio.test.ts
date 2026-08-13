import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateBessPortfolioTotals, extractBessPortfolioFromText } from './bessPortfolio'

const pdfParseText = `
BESS-Portfolio
Deutschland
4 Standorte · ca. 21,14 MW · ca. 48,8 MWh

Projektprofil: Bopfingen
3M GMBH · BESS-PORTFOLIO · VERTRAULICH
2
MW
4
MWh
2h
Speicherdauer
Standort
Baden-Württ emberg
Netzstatus
Netzanschlussvertrag liegt vor

Projektprofil: Brand-Erbisdorf Nord
3M GMBH · BESS-PORTFOLIO · VERTRAULICH
6,86
MW
16,29
MWh
2,4h
Speicherdauer
Standort
Sachsen
Netzstatus
VOG 426623, kein Netzausbau

Projektprofil: Könnern
3M GMBH · BESS-PORTFOLIO · VERTRAULICH
4,78
MW
12,22
MWh
2,6h
Speicherdauer
Standort
Sachsen-Anhalt
Netzstatus
VOG 384232, kein Netzausbau

Projektprofil: Kölsa
3M GMBH · BESS-PORTFOLIO · VERTRAULICH
7,5
MW
16,29
MWh
2,2h
Speicherdauer
Standort
Branden burg
Netzstatus
VOG 413510, kein Netzausbau

Netzanschlussstatus
Bopfingen
Netzan schlusszusage + Vertrag 15.10.2025 Netze ODR
Brand-Erbisdorf
VOG 42 6623 03.12.2025 MITNETZ
Könnern
VOG 38 4232 03.12.2025 MITNETZ
Kölsa
VOG 41 3510 03.12.2025 MITNETZ

Grundstück & Flächensicherung
Bopfingen
Unterzeichneter Flächenmi etvertrag
Brand-Erbisdorf
Flächenmietvertrag mit Narva Lichtquellen
Könnern
Notarieller Grundstückskaufvertragsentwurf
Kölsa
Flächenmietvertrag mit Elektrotechnik Kühler
`

test('erkennt ein pdf-parse BESS-Deck als ein Portfolio mit vier Standorten', () => {
  const portfolio = extractBessPortfolioFromText(pdfParseText)
  assert.ok(portfolio)
  assert.equal(portfolio.sites.length, 4)
  assert.deepEqual(portfolio.sites.map((site) => site.name), [
    'Bopfingen',
    'Brand-Erbisdorf Nord',
    'Könnern',
    'Kölsa',
  ])
  assert.deepEqual(portfolio.sites.map((site) => site.state), [
    'Baden-Württemberg',
    'Sachsen',
    'Sachsen-Anhalt',
    'Brandenburg',
  ])

  assert.deepEqual(calculateBessPortfolioTotals(portfolio), {
    siteCount: 4,
    mw: 21.14,
    mwh: 48.8,
    durationH: 2.31,
  })
  assert.equal(portfolio.sites[0].gridStatus, 'Netzanschlussvertrag vorhanden')
  assert.equal(portfolio.sites[1].gridStatus, 'VOG 426623 · Reservierung/Vertrag offen')
})
