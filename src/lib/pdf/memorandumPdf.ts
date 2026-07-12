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

export async function generateMemorandumPdf(pages: HTMLElement[]): Promise<Blob> {
  if (!pages.length) throw new Error('Keine Memorandum-Seiten gefunden')

  const { default: html2canvas } = await import('html2canvas')

  await Promise.all(pages.map((page) => waitForImages(page)))
  await nextFrame()

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  for (let i = 0; i < pages.length; i += 1) {
    const canvas = await html2canvas(pages[i], {
      scale: Math.min(2.5, Math.max(2, window.devicePixelRatio || 2)),
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    })

    const imageData = canvas.toDataURL('image/jpeg', 0.95)

    if (i > 0) doc.addPage('a4', 'landscape')
    doc.addImage(imageData, 'JPEG', 0, 0, PAGE_W_MM, PAGE_H_MM, undefined, 'FAST')
  }

  return doc.output('blob')
}
