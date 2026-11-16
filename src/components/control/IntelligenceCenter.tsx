'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, CalendarDays, CheckSquare, Grid2X2, Mic, RefreshCw, Send, Sparkles } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeRuntime'
import { berlinDateInput } from '@/lib/mail/calendar'
import { listenForEmaChanges } from '@/lib/ema/updates'
import styles from './control.module.css'

type Item = { id:string; title:string; dueAt:string|null; kind:string }
type Seed = { firstName:string; items:Item[]; draftProjects:string[]; projects:{id:string;name:string;incomplete:boolean}[]; dataWarning:boolean }
type Overview = { connected:boolean; reconnect:boolean; events:{id:string;title:string;start:string;end:string}[]; calendarAvailable:boolean; updatedAt?:string }
type Office = { pending:number }
type Connection = 'loading'|'ready'|'signin'|'error'
const time = (date:string) => new Intl.DateTimeFormat('de-DE',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Berlin'}).format(new Date(date))
const day = (date:string) => new Intl.DateTimeFormat('de-DE',{day:'numeric',month:'short',timeZone:'Europe/Berlin'}).format(new Date(date))
async function read<T>(url:string,signal:AbortSignal):Promise<T> {
  const response=await fetch(url,{cache:'no-store',signal:AbortSignal.any([signal,AbortSignal.timeout(12000)])});
  if(response.redirected || response.status===401)throw Object.assign(new Error('Anmeldung erforderlich'),{signin:true});
  if(!response.ok || !response.headers.get('content-type')?.includes('application/json'))throw new Error('Verbindung fehlgeschlagen');
  return response.json();
}
export function IntelligenceCenter(seed:Seed) {
  const router=useRouter();
  const [overview,setOverview]=useState<Overview|null>(null),[office,setOffice]=useState<Office|null>(null);
  const [calendarState,setCalendarState]=useState<Connection>('loading'),[officeState,setOfficeState]=useState<Connection>('loading');
  const [busy,setBusy]=useState(true),[command,setCommand]=useState('');
  const currentRequest=useRef<AbortController|null>(null);
  const refresh=useCallback(async()=>{
    currentRequest.current?.abort();const controller=new AbortController();currentRequest.current=controller;setBusy(true);
    const result=await Promise.allSettled([read<Overview>('/api/control/overview',controller.signal),read<Office>('/office/api/intelligence/overview',controller.signal)]);
    if(controller.signal.aborted)return;
    if(result[0].status==='fulfilled'){
      const value=result[0].value;setOverview(value);setCalendarState(value.reconnect?'signin':value.calendarAvailable?'ready':'error');
    }else setCalendarState(result[0].reason?.signin?'signin':'error');
    if(result[1].status==='fulfilled'){setOffice(result[1].value);setOfficeState('ready');}
    else setOfficeState(result[1].reason?.signin?'signin':'error');
    setBusy(false);
  },[]);
  useEffect(()=>{void refresh();const stop=listenForEmaChanges(()=>void refresh());return()=>{stop();currentRequest.current?.abort();};},[refresh]);
  const ask=()=>{window.dispatchEvent(new CustomEvent('ema:assistant-open',{detail:{text:command.trim().slice(0,2000)}}));setCommand('');};
  const tasks=seed.items.filter(item=>item.kind!=='appointment').sort((a,b)=>(a.dueAt?Date.parse(a.dueAt):Infinity)-(b.dueAt?Date.parse(b.dueAt):Infinity));
  const events=(overview?.events||[]).filter(event=>Date.parse(event.end)>Date.now());
  return <div className={`${styles.center} ${styles.simple}`}>
    <header className={styles.brandbar}><Link href="/apps"><strong>EMA</strong> <span>Intelligence</span></Link><div className={styles.brandTools}><ThemeToggle/><Link href="/apps" aria-label="EMA Hauptseite öffnen"><Grid2X2 size={21}/></Link><Link href="/settings" className={styles.avatar} aria-label="Mein Profil">{seed.firstName.slice(0,1)}</Link></div></header>
    <section className={styles.assistantIntro}>
      <span className={styles.caption}>Dein persönlicher Assistent</span><h1>Hallo, {seed.firstName}.</h1><p>Was möchtest du erledigen?</p>
      <form className={styles.command} onSubmit={event=>{event.preventDefault();ask();}}><Sparkles aria-hidden="true"/><input aria-label="Auftrag an EMA" value={command} maxLength={2000} onChange={event=>setCommand(event.target.value)} placeholder="Auftrag eingeben …"/><button type={command.trim()?'submit':'button'} className={styles.keyboard} aria-label={command.trim()?'Auftrag senden':'Mit EMA sprechen'} onClick={()=>{if(!command.trim())ask();}}>{command.trim()?<Send size={20}/>:<Mic size={20}/>}</button></form>
    </section>
    <section className={styles.connectionBar} aria-label="Verbindungen" aria-busy={busy}>
      <div><span className={styles.connectionDot} data-state={calendarState}/><span>Kalender: {calendarState==='loading'?'Wird geprüft':calendarState==='ready'?'Aktuell':calendarState==='signin'?'Verbinden':'Aktualisierung fehlgeschlagen'}</span>{calendarState==='signin'&&<Link href="/mail?view=settings">Verbinden</Link>}</div>
      <div><span className={styles.connectionDot} data-state={officeState}/><span>Office: {officeState==='loading'?'Wird geprüft':officeState==='ready'?'Verbunden':officeState==='signin'?'Anmeldung erforderlich':'Nicht erreichbar'}</span>{officeState==='signin'&&<a href="/office">Anmelden</a>}</div>
      <button className={styles.retry} onClick={()=>{void refresh();router.refresh();}} disabled={busy}><RefreshCw size={15}/>{busy?'Aktualisieren …':calendarState==='error'||officeState==='error'||seed.dataWarning?'Erneut versuchen':'Aktualisieren'}</button>
    </section>
    {(calendarState==='error'||officeState==='error')&&<p role="status" className={styles.caption}>Die betroffene Verbindung konnte nicht aktualisiert werden. Bereits geladene Angaben können veraltet sein.</p>}
    {seed.dataWarning&&<p role="status" className={styles.error}>Aufgaben oder Projekte sind unvollständig geladen. Bitte erneut versuchen.</p>}
    <section className={styles.focusPanel}><div className={styles.sectionTop}><h2><CheckSquare size={20}/>Offene Aufgaben</h2><Link href="/tasks">Alle ansehen</Link></div>
      {tasks.length? <ul className={styles.focusList}>{tasks.slice(0,3).map(item=><li key={`${item.kind}:${item.id}`}><Link href="/tasks"><strong>{item.title}</strong><small>{item.dueAt?`Fällig ${day(item.dueAt)}`:'Ohne Fälligkeit'}</small></Link></li>)}</ul>:<p className={styles.caption}>{seed.dataWarning?'Aufgaben konnten nicht vollständig geprüft werden.':'Keine offenen Aufgaben.'}</p>}
      {officeState==='ready'&&Boolean(office?.pending)&&<a className={styles.actionRow} href="/office/eingangsrechnungen"><Bell size={18}/>{office!.pending} Belege zur Prüfung<span>In Office öffnen →</span></a>}
    </section>
    <section className={styles.focusPanel}><div className={styles.sectionTop}><h2><CalendarDays size={20}/>Termine</h2><Link href="/mail?view=calendar">Kalender öffnen</Link></div>
      {calendarState==='ready'&&events.length?<ul className={styles.focusList}>{events.slice(0,2).map(event=><li key={event.id}><Link href={`/mail?view=calendar&date=${berlinDateInput(event.start).slice(0,10)}`}><strong>{event.title}</strong><small>{day(event.start)} · {time(event.start)} Uhr</small></Link></li>)}</ul>:<p className={styles.caption}>{calendarState==='ready'?'Keine weiteren Termine in den nächsten sieben Tagen.':calendarState==='loading'?'Termine werden geladen …':'Kalender prüfen, um Termine anzuzeigen.'}</p>}
    </section>
    <details className={styles.details}><summary>Projekte öffnen</summary><ul>{seed.projects.map(project=><li key={project.id}><Link href={`/projects/${project.id}/context`}>{project.name}</Link></li>)}</ul><Link href="/projects">Projektübersicht →</Link></details>
    <footer className={styles.simpleFooter}><Link href="/system/review">Dubletten prüfen</Link><Link href="/apps">Alle Apps</Link>{overview?.updatedAt&&calendarState==='ready'&&<small>Kalender aktualisiert {time(overview.updatedAt)}</small>}</footer>
  </div>;
}
