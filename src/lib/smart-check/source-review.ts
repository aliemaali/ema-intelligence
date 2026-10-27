import {createHash} from 'node:crypto'
import {OPERATORS} from './model'
import {EWR_DOCUMENT,type RuleDocumentStatus} from './ewr-rules'

export type RuleDocumentReview = {status:RuleDocumentStatus; url:string; sha256:string|null; expectedSha256:string; checkedAt:string}

export type SourceReview = {
  checkedAt: string
  status: 'retrieved' | 'unavailable' | 'unconfigured'
  publisherUrl: string | null
  sha256: string | null
  documents: {title: string; url: string}[]
  limitation: string
  ruleDocument?:RuleDocumentReview
}

/** Only the fixed, officially listed EWR URL is eligible; changed bytes disable the rules. */
export async function reviewEwrDocument(documents:{url:string}[],fetcher:typeof fetch=fetch):Promise<RuleDocumentReview> {
  const base={url:EWR_DOCUMENT.url,sha256:null,expectedSha256:EWR_DOCUMENT.sha256,checkedAt:new Date().toISOString()}
  if(!documents.some(document=>document.url===EWR_DOCUMENT.url))return {...base,status:'not-listed'}
  try{
    const response=await fetcher(EWR_DOCUMENT.url,{redirect:'error',signal:AbortSignal.timeout(8000),cache:'no-store',headers:{Accept:'application/pdf'}})
    if(!response.ok||!response.headers.get('content-type')?.includes('application/pdf'))throw new Error('Not a PDF')
    const reader=response.body?.getReader();if(!reader)throw new Error('Missing PDF body')
    const chunks:Uint8Array[]=[];let size=0
    try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>3*1024*1024)throw new Error('PDF too large');chunks.push(part.value)}}
    finally{await reader.cancel().catch(()=>undefined)}
    const bytes=Buffer.concat(chunks);if(bytes.subarray(0,5).toString()!=='%PDF-')throw new Error('Invalid PDF signature')
    const sha256=createHash('sha256').update(bytes).digest('hex')
    return {...base,sha256,status:sha256===EWR_DOCUMENT.sha256?'matched':'changed'}
  }catch{return {...base,status:'unavailable'}}
}

/** Discovery only: availability and a link are never proof of applicability. */
export function discoverOfficialLinks(html: string, publisherUrl: string) {
  const publisher = new URL(publisherUrl)
  const links = new Map<string, {title:string;url:string}>()
  for (const match of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const title = match[2].replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim().slice(0, 160)
    if (!/\bTAB\b|Anschlussbedingungen|Messkonzept|steuerbare|14a/i.test(title)) continue
    try {
      const url = new URL(match[1].replace(/&amp;/g, '&'), publisher)
      if (url.protocol !== 'https:' || url.origin !== publisher.origin || url.username || url.password) continue
      url.hash = ''
      links.set(url.href, {title, url:url.href})
      if (links.size >= 10) break
    } catch { /* malformed publisher link is not evidence */ }
  }
  return [...links.values()]
}

export async function reviewOfficialSources(operator: string, fetcher: typeof fetch = fetch): Promise<SourceReview> {
  const publisherUrl = OPERATORS.find(op=>op.name===operator)?.url ?? null
  const base = {checkedAt:new Date().toISOString(),publisherUrl,sha256:null,documents:[]}
  if (!publisherUrl) return {...base,status:'unconfigured',limitation:'Kein verifizierter offizieller Einstieg hinterlegt. Lokale Regelwerke fehlen.'}
  try {
    // A fixed publisher registry, no user-supplied URLs and no automatic redirects.
    const response = await fetcher(publisherUrl,{redirect:'error',signal:AbortSignal.timeout(8000),cache:'no-store',headers:{Accept:'text/html'}})
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) throw new Error('Publisher not readable')
    const reader=response.body?.getReader()
    if (!reader) throw new Error('Missing publisher body')
    const chunks:Uint8Array[]=[];let size=0
    try { for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>1024*1024)throw new Error('Publisher body too large');chunks.push(part.value)} }
    finally { await reader.cancel().catch(()=>undefined) }
    const bytes=Buffer.concat(chunks),documents=discoverOfficialLinks(bytes.toString('utf8'),publisherUrl)
    const ruleDocument=operator==='EWR Netz'?await reviewEwrDocument(documents,fetcher):undefined
    return {...base,status:'retrieved',sha256:createHash('sha256').update(bytes).digest('hex'),documents,ruleDocument,limitation:'Offizielle Einstiegsseite abgerufen; nur ein ausdrücklich ausgewertetes und unverändert bestätigtes EWR-Dokument kann lokale Prüfpunkte begründen. Übrige Dokumente, übergeordnete Neufassungen, Übergänge und Projektanwendbarkeit sind nicht inhaltlich verifiziert. Ein passender Datei-Hash ist keine technische Freigabe. Es wird kein vollständiger Normtext gespeichert.'}
  } catch {
    return {...base,status:'unavailable',limitation:'Offizielle Einstiegsseite nicht sicher abrufbar (z. B. Weiterleitung, Zeitüberschreitung oder Zugriffssperre). Keine Aktualitäts- oder Vollständigkeitsbestätigung; Regelwerksprüfung bleibt eingeschränkt.'}
  }
}
