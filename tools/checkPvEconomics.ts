import assert from 'node:assert/strict'
import { mergeProjectEconomicSources, resolvePvEconomics } from '../src/lib/projects/pv-units'

function close(actual: number | null, expected: number, tolerance = 0.01) {
  assert.notEqual(actual, null)
  assert.ok(Math.abs((actual as number) - expected) <= tolerance, `${actual} ≠ ${expected}`)
}

const polssen = mergeProjectEconomicSources(
  {
    pv_mwp: 327.85,
    specific_yield_kwh_kwp: 973.23,
    annual_yield_kwh: 319_073.4555,
    feed_in_tariff_ct_kwh: 0.112,
    ai_score_details: { ema_ai: { purchase_price: 318_877 } },
  },
  { purchase_price: 35_822_858.10, purchase_price_type: 'per_kwp' },
)
const polssenResult = resolvePvEconomics(polssen)
close(polssenResult.purchasePrice, 318_877)
close(polssenResult.specificYieldKwhPerKwp, 973.23)
close(polssenResult.annualRevenue, 35_736.23)
close(polssenResult.amortisationYears, 8.9231)

const muenzenberg = resolvePvEconomics({
  pv_mwp: 359.91,
  specific_yield_kwh_kwp: 942.29,
  annual_yield_kwh: 339_139.5939,
  feed_in_tariff_ct_kwh: 9.59,
  purchase_price: 37_994_259.06,
  purchase_price_type: 'per_kwp',
})
close(muenzenberg.purchasePrice, 379_942.5906)
close(muenzenberg.amortisationYears, 11.6836)

const legacyMw = resolvePvEconomics({
  pv_mwp: 1.25,
  specific_yield_kwh_kwp: 1_050,
  annual_yield_kwh: 1_312_500,
})
close(legacyMw.pvKwp, 1_250)
close(legacyMw.specificYieldKwhPerKwp, 1_050)

console.log('PV economics regression checks passed')
