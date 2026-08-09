const DOCUMENT_VIEWER_RETURN_KEY = 'ema-intelligence:intro:document-return'
const DOCUMENT_VIEWER_RETURN_TTL_MS = 24 * 60 * 60 * 1000

export function markDocumentViewerOpen() {
  try {
    window.sessionStorage.setItem(DOCUMENT_VIEWER_RETURN_KEY, String(Date.now()))
  } catch {
    // Session storage can be unavailable in hardened/private browser modes.
  }
}

export function clearDocumentViewerMarker() {
  try {
    window.sessionStorage.removeItem(DOCUMENT_VIEWER_RETURN_KEY)
  } catch {
    // Session storage can be unavailable in hardened/private browser modes.
  }
}

export function consumeDocumentViewerReturn() {
  try {
    const rawTimestamp = window.sessionStorage.getItem(DOCUMENT_VIEWER_RETURN_KEY)
    if (!rawTimestamp) return false

    window.sessionStorage.removeItem(DOCUMENT_VIEWER_RETURN_KEY)
    const timestamp = Number(rawTimestamp)
    return Number.isFinite(timestamp) && Date.now() - timestamp < DOCUMENT_VIEWER_RETURN_TTL_MS
  } catch {
    return false
  }
}
