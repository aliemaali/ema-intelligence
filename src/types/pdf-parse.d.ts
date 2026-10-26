declare module 'pdf-parse' {
  type PdfParseResult = {
    text: string
    numpages?: number
    info?: Record<string, unknown>
    metadata?: Record<string, unknown>
    version?: string
  }

  export default function pdfParse(dataBuffer: Buffer, options?: { max?: number }): Promise<PdfParseResult>
}
