'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {officeDirectory} from '@/lib/ema/office-directory';
import {contactDuplicates,type ReviewContact,type DuplicateGroup,type ReviewDocument} from '@/lib/ema/duplicates';
export function DuplicateReview({groups,truncated,documentError}:{groups:DuplicateGroup<ReviewDocument>[];truncated:boolean;documentError:boolean}){
  const [contacts,setContacts]=useState<ReviewContact[]>([]),[busy,setBusy]=useState(true),[errors,setErrors]=useState<string[]>([]),[revision,setRevision]=useState(0);
  useEffect(()=>{
    const c=new AbortController();setBusy(true);setErrors([]);setContacts([]);
    async function microsoft(){const records:ReviewContact[]=[];let cursor:string|undefined;const seen=new Set<string>();
      for(let i=0;i<100;i++){
        const r=await fetch('/api/mail/contacts'+(cursor?'?'+new URLSearchParams({cursor}):''),{cache:'no-store',signal:c.signal});
        const j=await r.json();if(!r.ok)throw new Error(j.error||'Microsoft-Kontakte nicht erreichbar.');records.push(...(j.value||[]));cursor=j['@odata.nextLink'];if(!cursor)return records;if(seen.has(cursor))throw new Error('Kontaktseiten wiederholen sich.');seen.add(cursor);
      }throw new Error('Kontaktverzeichnis zu groß für die vollständige Prüfung.');
    }
    void Promise.allSettled([microsoft(),officeDirectory(c.signal)]).then(results=>{
      if(c.signal.aborted)return;setContacts(results.flatMap(r=>r.status==='fulfilled'?r.value:[]));setErrors(results.flatMap((r,i)=>r.status==='rejected'?[`${i===0?'Microsoft':'Office'}: ${r.reason.message}`]:[]));setBusy(false);
    });return()=>c.abort();
  },[revision]);
  const contactGroups=contactDuplicates(contacts);
  return <div className="space-y-4"><section className="card-padded"><h2 className="font-bold">Dokumente</h2><p className="mt-2 text-sm text-muted-foreground">Gleiche Prüfsumme bedeutet gleicher Dateiinhalt. Gleicher Dateiname und gleiche Größe sind nur ein Hinweis. Vor einer Bereinigung die Originale vergleichen.</p>
    {documentError?<p role="status" className="mt-3">Dokumente konnten nicht geprüft werden. <Link className="underline" href="/system/review">Erneut versuchen</Link></p>:groups.length?groups.map(g=><article key={g.key} className="mt-4 rounded-xl border border-[var(--ema-border)] p-3"><h3 className="text-sm font-bold">{g.exact?'Identischer Dateiinhalt':'Möglicherweise doppelt'}</h3><ul>{g.items.map(d=><li key={d.id} className="mt-3 text-sm"><strong>{d.display_name||d.file_name}</strong><p className="text-xs text-muted-foreground">{d.source_app==='ema_office'?'Office':'DMS'} · {d.file_name} · {d.file_size_bytes?.toLocaleString('de-DE')} Bytes</p><a className="mt-1 inline-block underline" href={`/api/system/document-url?id=${encodeURIComponent(d.id)}`} target="_blank" rel="noopener noreferrer">Original öffnen</a></li>)}</ul></article>):<p className="mt-3 text-sm">Keine Dublettenhinweise in den geprüften Dokumentdaten.</p>}
    {truncated&&<p className="mt-3 text-sm">Es wurden die ersten 5.000 aktiven Dokumente geprüft.</p>}
    <Link className="mt-4 inline-block text-sm underline" href="/dms">Dokumente im DMS verwalten →</Link>
  </section><section className="card-padded"><h2 className="font-bold">Kontakte</h2><p className="mt-2 text-sm text-muted-foreground">Mehrere Einträge mit derselben E-Mail innerhalb eines Adressbuchs. Ein gemeinsamer Office- und Mail-Kontakt zählt nicht als Dublette. Gemeinsam genutzte E-Mail-Adressen können beabsichtigt sein.</p>
    {busy?<p role="status" className="mt-3 text-sm">Kontakte werden geprüft …</p>:<>{errors.map(error=><p key={error} role="status" className="mt-3 text-sm">{error}</p>)}{errors.length>0&&<button className="btn-secondary mt-3" onClick={()=>setRevision(v=>v+1)}>Erneut versuchen</button>}
      {contactGroups.map(g=><article key={g.key} className="mt-4 rounded-xl border border-[var(--ema-border)] p-3"><h3 className="break-all text-sm font-bold">{g.key.slice(g.key.indexOf(':')+1)}</h3><ul>{g.items.map(c=><li key={c.id} className="mt-3 text-sm"><strong>{c.displayName||'Ohne Namen'}</strong><p className="text-xs text-muted-foreground">{c.id.startsWith('office:')?'Office':c.id.startsWith('ema-shared-contact:')?'Geteiltes Adressbuch':'Mein Adressbuch'}{c.businessPhones?.length?` · ${c.businessPhones.join(', ')}`:''}</p>{c.officeHref&&<a className="underline" href={c.officeHref}>In Office prüfen</a>}</li>)}</ul></article>)}{!contactGroups.length&&<p className="mt-3 text-sm">{errors.length?'In den erreichbaren Quellen keine Dublettenhinweise. Die Prüfung ist unvollständig.':'Keine Kontakt-Dublettenhinweise gefunden.'}</p>}</>}
    <Link className="mt-4 inline-block text-sm underline" href="/mail?view=contacts">Kontakte verwalten →</Link>
  </section><p className="text-xs text-muted-foreground">Die Prüfung ändert keine Daten. Unterschiedliche Geschäftsdaten werden nicht automatisch zusammengeführt.</p></div>;
}
