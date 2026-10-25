const PASSKEY_TIMEOUT_MS = 60_000

/** Bound the UI wait as well as the native WebAuthn prompt. */
export async function runPasskeyAttempt<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  controller: AbortController,
  timeoutMs = PASSKEY_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  let onAbort: (() => void) | undefined
  try {
    const cancelled = new Promise<never>((_, reject) => {
      onAbort = () => reject(controller.signal.reason ?? new DOMException('Cancelled', 'AbortError'))
      if (controller.signal.aborted) onAbort()
      else controller.signal.addEventListener('abort', onAbort, { once: true })
      timer = setTimeout(() => controller.abort(new DOMException('Passkey timed out', 'TimeoutError')), timeoutMs)
    })
    const attempt = Promise.resolve().then(() => {
      controller.signal.throwIfAborted()
      return operation(controller.signal)
    })
    return await Promise.race([attempt, cancelled])
  } finally {
    clearTimeout(timer)
    if (onAbort) controller.signal.removeEventListener('abort', onAbort)
  }
}
