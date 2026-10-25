import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runPasskeyAttempt } from './passkeyAttempt'

test('a hanging operation times out and aborts the WebAuthn signal', async () => {
  const controller = new AbortController()
  await assert.rejects(runPasskeyAttempt(() => new Promise(() => {}), controller, 5), { name: 'TimeoutError' })
  assert.equal(controller.signal.aborted, true)
})
test('user cancellation ends the wait even if the provider never settles', async () => {
  const controller = new AbortController()
  const attempt = runPasskeyAttempt(() => new Promise(() => {}), controller)
  controller.abort(new DOMException('Cancelled', 'AbortError'))
  await assert.rejects(attempt, { name: 'AbortError' })
})
test('cancelled attempts never start a later native prompt', async () => {
  const controller = new AbortController()
  controller.abort()
  let started = false
  await assert.rejects(runPasskeyAttempt(async () => { started = true }, controller), { name: 'AbortError' })
  assert.equal(started, false)
})
test('successful attempts preserve the result and clear their timer', async () => {
  const controller = new AbortController()
  assert.equal(await runPasskeyAttempt(async signal => { assert.equal(signal, controller.signal); return 'verified' }, controller, 5), 'verified')
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(controller.signal.aborted, false)
})
test('provider errors propagate without changing authentication behavior', async () => {
  const controller = new AbortController()
  const error = new Error('verification rejected')
  await assert.rejects(runPasskeyAttempt(async () => { throw error }, controller), error)
  assert.equal(controller.signal.aborted, false)
})
