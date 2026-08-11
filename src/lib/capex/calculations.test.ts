import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { calcAll } from './calculations'
import { defaultCapexProject, type CapexProject } from '@/lib/types/capex.types'

function münzenberg(): CapexProject {
  const project = defaultCapexProject({
    id: 'muenzenberg',
    name: 'Münzenberg',
    pv_mwp: 359.91,
    specific_yield: 942.29,
    tariff_eur_kwh: 0.0959,
    purchase_price: 359_910,
  })
  project.modulleistungWp = 500
  project.preisProModul = 100
  project.wrEinzelpreis = 10_000
  project.wrAnzahl = 2
  project.ukPreisProKwp = 50
  project.acPreisProKwp = 100
  project.dcPreisProKwp = 80
  project.projektrechteProKwp = 90
  return project
}

describe('CAPEX-Kalkulationsarten', () => {
  it('verwendet bei schlüsselfertigem Kauf ausschließlich den Anlagenkaufpreis', () => {
    const project = münzenberg()
    project.componentPricing.acquisition.mode = 'turnkey'
    project.componentPricing.acquisition.turnkeyPurchasePrice = 359_910

    const result = calcAll(project)

    assert.equal(result.totalCapex, 359_910)
    assert.ok(Math.abs(result.specificCapex - 1_000) < 0.001)
    assert.equal(result.positions.length, 1)
    assert.equal(result.positions[0].name, 'Schlüsselfertiger Anlagenkauf')
    assert.equal(result.positions[0].cost, 359_910)
  })

  it('addiert Projektrechte nur im Modell Projektrechte + EPC', () => {
    const epc = münzenberg()
    epc.componentPricing.acquisition.mode = 'epc'
    const epcResult = calcAll(epc)

    const rightsAndEpc = münzenberg()
    rightsAndEpc.componentPricing.acquisition.mode = 'project_rights_epc'
    const rightsResult = calcAll(rightsAndEpc)

    assert.ok(Math.abs((rightsResult.totalCapex - epcResult.totalCapex) - (359.91 * 90)) < 0.01)
    assert.equal(epcResult.positions.some((position) => position.name.includes('Projektrechte')), false)
    assert.equal(rightsResult.positions.some((position) => position.name.includes('Projektrechte')), true)
  })
})
