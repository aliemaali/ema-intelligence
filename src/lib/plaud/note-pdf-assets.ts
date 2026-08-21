import fs from 'node:fs'
import path from 'node:path'
import type { PlaudNotePdfAssets } from './note-pdf'

function readBase64(root: string, relativePath: string) {
  try {
    return fs.readFileSync(path.join(root, relativePath)).toString('base64')
  } catch (error) {
    console.warn('[plaud-pdf] Optional PDF asset is unavailable; using fallback rendering.', {
      relativePath,
      error: error instanceof Error ? error.message : 'unknown error',
    })
    return undefined
  }
}

export function loadPlaudPdfAssets(root = process.cwd()): PlaudNotePdfAssets {
  const logo = readBase64(root, 'public/brand/ema-logo.png')
  const regular = readBase64(root, 'public/fonts/inter/inter-latin-ext-400.ttf')
  const semiBold = readBase64(root, 'public/fonts/inter/inter-latin-ext-600.ttf')
  const bold = readBase64(root, 'public/fonts/inter/inter-latin-ext-700.ttf')
  const assets: PlaudNotePdfAssets = {}

  if (logo) assets.logoDataUrl = `data:image/png;base64,${logo}`
  if (regular && semiBold && bold) {
    assets.regularFontBase64 = regular
    assets.semiBoldFontBase64 = semiBold
    assets.boldFontBase64 = bold
  }

  return assets
}
