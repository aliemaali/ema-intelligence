import jsPDF from 'jspdf'

const PAGE_W_MM = 297
const PAGE_H_MM = 210

export async function waitForImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll('img'))

  await Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete && image.naturalWidth > 0) {
            resolve()
            return
          }

          const finish = () => resolve()
          image.addEventListener('load', finish, { once: true })
          image.addEventListener('error', finish, { once: true })
          window.setTimeout(finish, 5000)
        }),
    ),
  )
}

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
}

function isIosDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function renderScale(page: HTMLElement) {
  const width = Math.max(page.getBoundingClientRect().width, 1)
  const targetWidth = isIosDevice() ? 1450 : 1800
  return Math.max(1, Math.min(isIosDevice() ? 1.3 : 1.65, targetWidth / width))
}

export async function generateMemorandumPdf(pages: HTMLElement[]): Promise<Blob> {
  if (!pages.length) throw new Error('Keine Memorandum-Seiten gefunden')

  const { default: html2canvas } = await import('html2canvas')

  await Promise.all(pages.map((page) => waitForImages(page)))
  await nextFrame()

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: true,
  })

  for (let i = 0; i < pages.length; i += 1) {
    const page = pages[i]
    const canvas = await html2canvas(page, {
      scale: renderScale(page),
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
      imageTimeout: 7000,
      removeContainer: true,
    })

    const imageData = canvas.toDataURL('image/jpeg', isIosDevice() ? 0.84 : 0.9)

    if (i > 0) doc.addPage('a4', 'landscape')
    doc.addImage(imageData, 'JPEG', 0, 0, PAGE_W_MM, PAGE_H_MM, undefined, 'FAST')

    // iOS Safari has a strict canvas-memory limit. Release each page immediately.
    canvas.width = 1
    canvas.height = 1
    await nextFrame()
  }

  return doc.output('blob')
}
