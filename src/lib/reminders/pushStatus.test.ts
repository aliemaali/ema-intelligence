import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  EMPTY_PUSH_DIAGNOSTICS,
  isPushFullyActive,
  needsSilentRepair,
  reasonForInactivePush,
  type ReminderPushDiagnostics,
} from './pushStatus'

function fullyActive(): ReminderPushDiagnostics {
  return {
    standalone: true,
    notificationsSupported: true,
    permission: 'granted',
    serviceWorkerRegistered: true,
    serviceWorkerActive: true,
    subscriptionExists: true,
    subscriptionSavedServerSide: true,
    schedulerHealthy: true,
  }
}

describe('isPushFullyActive', () => {
  it('is true when every condition is satisfied', () => {
    assert.equal(isPushFullyActive(fullyActive()), true)
  })

  it('tolerates an unknown scheduler health (null)', () => {
    assert.equal(isPushFullyActive({ ...fullyActive(), schedulerHealthy: null }), true)
  })

  it('is false when the scheduler is known to be stale', () => {
    assert.equal(isPushFullyActive({ ...fullyActive(), schedulerHealthy: false }), false)
  })

  it('is false when permission is not granted', () => {
    assert.equal(isPushFullyActive({ ...fullyActive(), permission: 'default' }), false)
  })

  it('is false when the service worker is not active', () => {
    assert.equal(isPushFullyActive({ ...fullyActive(), serviceWorkerActive: false }), false)
  })

  it('is false when nothing is supported', () => {
    assert.equal(isPushFullyActive(EMPTY_PUSH_DIAGNOSTICS), false)
  })
})

describe('reasonForInactivePush', () => {
  it('returns empty string when fully active', () => {
    assert.equal(reasonForInactivePush(fullyActive()), '')
  })

  it('prioritizes unsupported over everything else', () => {
    const reason = reasonForInactivePush({ ...fullyActive(), notificationsSupported: false, permission: 'denied' })
    assert.match(reason, /nicht unterstützt/)
  })

  it('reports a blocked permission', () => {
    const reason = reasonForInactivePush({ ...fullyActive(), permission: 'denied' })
    assert.match(reason, /blockiert/)
  })

  it('reports a missing server-side subscription record', () => {
    const reason = reasonForInactivePush({ ...fullyActive(), subscriptionSavedServerSide: false })
    assert.match(reason, /nicht in EMA gespeichert/)
  })

  it('reports a stale scheduler last', () => {
    const reason = reasonForInactivePush({ ...fullyActive(), schedulerHealthy: false })
    assert.match(reason, /Versand/)
  })
})

describe('needsSilentRepair', () => {
  it('is false when everything already works', () => {
    assert.equal(needsSilentRepair(fullyActive()), false)
  })

  it('is true when permission is granted and the worker is active but the subscription is missing', () => {
    assert.equal(needsSilentRepair({ ...fullyActive(), subscriptionExists: false }), true)
  })

  it('is true when the subscription exists locally but was never saved server-side', () => {
    assert.equal(needsSilentRepair({ ...fullyActive(), subscriptionSavedServerSide: false }), true)
  })

  it('never attempts repair without granted permission (would need a user gesture)', () => {
    assert.equal(needsSilentRepair({ ...fullyActive(), permission: 'default', subscriptionExists: false }), false)
  })

  it('never attempts repair when the service worker is not active yet', () => {
    assert.equal(needsSilentRepair({ ...fullyActive(), serviceWorkerActive: false, subscriptionExists: false }), false)
  })
})
