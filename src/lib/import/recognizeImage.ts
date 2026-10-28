import path from 'node:path'
import { access } from 'node:fs/promises'
import sharp from 'sharp'
import { createWorker } from 'tesseract.js'

export async function recognizeProjectImage(bytes: Buffer): Promise<string> {
  // Fail as a normal import error if a deployment is missing OCR runtime files.
  // Tesseract otherwise throws from a worker message handler outside the action.
  // Keep native resolution outside Webpack's createRequire transform.
  const { createRequire } = process.getBuiltinModule('module')
  const resolve = createRequire(path.join(process.cwd(), 'package.json'))
  const packagePath = resolve.resolve('tesseract.js/package.json')
  const coreRoot = path.dirname(createRequire(packagePath).resolve('tesseract.js-core/package.json'))
  const langPath = path.join(process.cwd(), 'assets/ocr')
  await Promise.all([
    path.join(path.dirname(packagePath), 'src/worker-script/node/index.js'),
    path.join(coreRoot, 'tesseract-core-lstm.wasm'),
    path.join(coreRoot, 'tesseract-core-simd-lstm.wasm'),
    path.join(langPath, 'deu.traineddata'),
    path.join(langPath, 'eng.traineddata'),
  ].map(file => access(file)))

  const image = await sharp(bytes, { limitInputPixels: 25_000_000 }).rotate()
    .flatten({ background: '#ffffff' }).trim({ background: '#000000', threshold: 20 })
    .extend({ top: 40, bottom: 40, left: 40, right: 40, background: '#ffffff' }).png().toBuffer()
  const worker = await createWorker('deu+eng', 1, {
    langPath, gzip: false, cachePath: '/tmp',
    // Recognition jobs reject their promises; do not additionally throw globally.
    errorHandler: () => {},
  })
  try { return (await worker.recognize(image)).data.text || '' }
  finally { await worker.terminate() }
}
