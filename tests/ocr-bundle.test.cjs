const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

// Run after next build: OCR starts a worker outside the normal import graph.
// Both entry points must ship its WASM and language data to the server.
for (const route of ['app/project-import/page.js', 'app/api/expose/import/route.js']) {
  test(`${route} ships a complete OCR runtime`, () => {
    const manifest = path.resolve('.next/server', `${route}.nft.json`)
    const files = JSON.parse(fs.readFileSync(manifest, 'utf8')).files
    for (const suffix of [
      '/tesseract.js/src/worker-script/node/index.js',
      '/tesseract.js-core/tesseract-core-lstm.wasm',
      '/tesseract.js-core/tesseract-core-simd-lstm.wasm',
      '/assets/ocr/deu.traineddata',
      '/assets/ocr/eng.traineddata',
    ]) {
      const entry = files.find(file => file.endsWith(suffix))
      assert.ok(entry, `Missing deployment dependency: ${suffix}`)
      assert.ok(fs.statSync(path.resolve(path.dirname(manifest), entry)).size > 0)
    }
  })
}
