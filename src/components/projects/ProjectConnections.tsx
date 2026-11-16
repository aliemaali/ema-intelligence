'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {listenForEmaChanges} from '@/lib/ema/updates';
import {berlinDateInput,berlinTime} from '@/lib/mail/calendar';
type MessageLink={mailbox:string;message_id:string;subject:string;sender:string};
type Event={id:string;subject:string;start:{dateTime:string};end:{dateTime:string};type?:string};
async function read(url:string,signal:AbortSignal){const r=await fetch(url,{signal,cache:'no-store'});const j=await r.json();if(!r.ok)throw new Error(j.error||'Verknüpfungen konnten nicht geladen werden.');return j;}
export function ProjectConnections({projectId}:{projectId:string}){
  const [messages,setMessages]=useState<MessageLink[]>([]),[events,setEvents]=useState<Event[]>([]),[errors,setErrors]=useState<string[]>([]),[busy,setBusy]=useState(true),[more,setMore]=useState(false),[page,setPage]=useState(0),[moreEvents,setMoreEvents]=useState(false);
  const controller=useRef<AbortController|null>(null);
  const refresh=useCallback(async()=>{
    controller.current?.abort();const c=new AbortController();controller.current=c;setBusy(true);setErrors([]);
    const q=new URLSearchParams({projectId,page:String(page)});
    const results=await Promise.allSettled([read(`/api/mail/project-mail?${q}`,c.signal),read(`/api/mail/project-events?${new URLSearchParams({projectId})}`,c.signal)]);
    if(c.signal.aborted)return;
    if(results[0].status==='fulfilled'){setMessages(results[0].value.links);setMore(results[0].value.more);}else setMessages([]);
    if(results[1].status==='fulfilled'){setEvents(results[1].value.events);setMoreEvents(results[1].value.more);}else setEvents([]);
    setErrors(results.flatMap((r,i)=>r.status==='rejected'?[`${i===0?'E-Mails':'Termine'}: ${r.reason.message}`]:[]));setBusy(false);
  },[projectId,page]);
  useEffect(()=>{void refresh();const stop=listenForEmaChanges(()=>void refresh());return()=>{stop();controller.current?.abort();};},[refresh]);
  return <div className="space-y-4" aria-busy={busy}>
    {errors.length>0&&<div role="status" className="card-padded"><p>{errors.join(' ')}</p><button onClick={()=>void refresh()} disabled={busy} className="btn-secondary mt-3">Erneut versuchen</button><Link href="/mail?view=settings" className="ml-3 text-sm underline">Verbindung prüfen</Link></div>}
    <section className="card-padded"><h2 className="font-bold">Verknüpfte E-Mails</h2><p className="mt-1 text-xs text-muted-foreground">Die Originalnachricht öffnet sich in EMA Mail. Ordne sie dort über „Projekt zuordnen“ zu.</p>
      <ul className="mt-3 divide-y divide-[var(--ema-border)]">{messages.map(m=><li key={`${m.mailbox}:${m.message_id}`}><Link className="block py-3" href={`/mail?${new URLSearchParams({view:'mail',mailbox:m.mailbox,message:m.message_id})}`}><strong className="block text-sm">{m.subject||'Ohne Betreff'}</strong><small className="text-muted-foreground">{m.sender}</small></Link></li>)}</ul>
      {!busy&&!messages.length&&!errors.some(e=>e.startsWith('E-Mails'))&&<p className="mt-3 text-sm text-muted-foreground">Noch keine E-Mails zugeordnet.</p>}
      <div className="mt-3 flex gap-3">{page>0&&<button className="btn-secondary btn-sm" onClick={()=>setPage(v=>v-1)}>Zurück</button>}{more&&<button className="btn-secondary btn-sm" onClick={()=>setPage(v=>v+1)}>Weitere E-Mails</button>}</div>
    </section>
    <section className="card-padded"><h2 className="font-bold">Verknüpfte Termine</h2><p className="mt-1 text-xs text-muted-foreground">Projektzuordnung im persönlichen Kalender. Terminserien öffnen sich im Kalender.</p><ul className="mt-3 divide-y divide-[var(--ema-border)]">{[...events].sort((a,b)=>Date.parse(a.start.dateTime)-Date.parse(b.start.dateTime)).map(e=><li key={e.id}><Link className="block py-3" href={`/mail?view=calendar&date=${berlinDateInput(e.start.dateTime).slice(0,10)}`}><strong className="block text-sm">{e.subject}</strong><small className="text-muted-foreground">{berlinDateInput(e.start.dateTime).slice(0,10)} · {berlinTime(e.start.dateTime)}{e.type==='seriesMaster'?' · Terminserie':''}</small></Link></li>)}</ul>
      {!busy&&!events.length&&!errors.some(e=>e.startsWith('Termine'))&&<p className="mt-3 text-sm text-muted-foreground">Noch keine Termine zugeordnet.</p>}{moreEvents&&<p className="mt-3 text-sm">Weitere Termine findest du im <Link className="underline" href="/mail?view=calendar">Kalender</Link>.</p>}
    </section>
    {busy&&<p role="status" className="text-sm text-muted-foreground">Verknüpfungen werden geladen …</p>}
  </div>;
}
