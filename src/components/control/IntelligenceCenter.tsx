'use client'

import { listenForEmaChanges } from '@/lib/ema/updates'
import { ThemeToggle } from '@/components/ThemeRuntime'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Grid2X2, Bell, CalendarDays, CheckSquare, FileText, Keyboard, Mic, RefreshCw, Send, Sparkles, Target } from 'lucide-react'
import { CalendarArtwork, ConnectedAreas, ControlHero } from './ControlHero'
import styles from './control.module.css'

type Item = { id:string; title:string; dueAt:string|null; kind:string }
type Seed = { firstName:string; items:Item[]; draftProjects:string[]; projects:{id:string;name:string;incomplete:boolean}[]; dataWarning:boolean }
type Overview = { connected:boolean; reconnect:boolean; events:{id:string;title:string;start:string;end:string}[]; calendarAvailable:boolean; updatedAt?:string }
type Office = { connected:boolean; pending:number; enabled:boolean; lastSuccessAt?:string|null; lastError?:boolean; mailboxes?:string[] }
const time = (date:string) => new Intl.DateTimeFormat('de-DE',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Berlin'}).format(new Date(date))
const day = (date:string) => new Intl.DateTimeFormat('de-DE',{day:'numeric',month:'short',timeZone:'Europe/Berlin'}).format(new Date(date))
function Ring({icon:Icon,color}:{icon:typeof CalendarDays;color:string}) { return <span className={styles.ring} style={{'--ring':color} as React.CSSProperties}><span><Icon /></span></span> }
function Spark({color}:{color:string}) { return <svg className={styles.spark} viewBox="0 0 60 18" aria-hidden="true"><path d="M0 15L9 12L17 14L25 5L32 9L43 4L50 6L60 1" fill="none" stroke={color} strokeWidth="2" /></svg> }
async function jsonResponse<T>(url:string,signal:AbortSignal):Promise<T> { const response=await fetch(url,{cache:'no-store',signal}); if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))throw Error('Daten konnten nicht geladen werden.'); return response.json() }
export function IntelligenceCenter(seed:Seed) {
  const [overview,setOverview]=useState<Overview|null>(null),[office,setOffice]=useState<Office|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState(''),[command,setCommand]=useState('')
  const currentRequest=useRef<AbortController|null>(null),input=useRef<HTMLInputElement>(null)
  const refresh=useCallback(async()=>{
    currentRequest.current?.abort();const controller=new AbortController();currentRequest.current=controller;setBusy(true);setError('')
    const result=await Promise.allSettled([jsonResponse<Overview>('/api/control/overview',controller.signal),jsonResponse<Office>('/office/api/intelligence/overview',controller.signal)])
    if(controller.signal.aborted)return
    if(result[0].status==='fulfilled')setOverview(result[0].value);else setError('Der Kalender konnte nicht aktualisiert werden. Bitte erneut versuchen.')
    if(result[1].status==='fulfilled')setOffice({...result[1].value,connected:true});else setOffice({connected:false,pending:0,enabled:false})
    setBusy(false)
  },[])
  useEffect(()=>{void refresh();const stop=listenForEmaChanges(()=>{void refresh()});return()=>{stop();currentRequest.current?.abort()}},[refresh])
  const ask=(text?:string)=>{window.dispatchEvent(new CustomEvent('ema:assistant-open',{detail:{text:(text||command).trim().slice(0,2000)}}));setCommand('')}
  const openTasks=seed.items.filter(item=>item.kind!=='appointment')
  const appointments=[...(overview?.events||[]).map(event=>({id:event.id,title:event.title,start:event.start,kind:'outlook'})),...seed.items.filter(item=>item.kind==='appointment'&&item.dueAt&&Date.parse(item.dueAt)>=Date.now()).map(item=>({id:item.id,title:item.title,start:item.dueAt!,kind:'plaud'}))].sort((a,b)=>Date.parse(a.start)-Date.parse(b.start))
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),todayAppointments=appointments.filter(event=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(event.start))===today)
  const next=appointments[0],due=seed.items.filter(item=>item.kind!=='appointment'&&item.dueAt).sort((a,b)=>Date.parse(a.dueAt!)-Date.parse(b.dueAt!))[0]
  return <div className={styles.center}>
    <header className={styles.brandbar}><Link href="/apps"><strong>EMA</strong> <span>Intelligence</span></Link><div className={styles.brandTools}><ThemeToggle /><Link href="/apps" aria-label="EMA Hauptseite öffnen" title="Hauptseite"><Grid2X2 size={21} /></Link><Link href="/assistant" aria-label="Erinnerungen und Aufgaben"><Bell size={21} /></Link><Link href="/settings" className={styles.avatar} aria-label="Mein Profil">{seed.firstName.slice(0,1)}</Link></div></header>
    <ControlHero title={`Hallo, ${seed.firstName}.`} subtitle="Deine Zentrale denkt mit.">
      <form className={styles.command} onSubmit={event=>{event.preventDefault();ask()}}><Sparkles /><input ref={input} aria-label="Auftrag an EMA" value={command} maxLength={2000} onChange={event=>setCommand(event.target.value)} placeholder="Was soll ich für dich erledigen?" /><button type="button" className={styles.mic} aria-label="Mit EMA sprechen" onClick={()=>ask()}><Mic size={21}/></button><button type={command.trim()?'submit':'button'} className={styles.keyboard} aria-label={command.trim()?'Auftrag senden':'Auftrag eingeben'} onClick={()=>{if(!command.trim())input.current?.focus()}}>{command.trim()?<Send size={18}/>:<Keyboard size={19}/>}</button></form>

    </ControlHero>
    <section className={styles.stats} aria-label="Dein Überblick">
      <Link className={styles.stat} href="/tasks"><Ring icon={CheckSquare} color="#ffc15d"/><div className={styles.statText}><strong>{openTasks.length}</strong><b>Aufgaben</b><small>Offen</small><Spark color="#ffc15d"/></div></Link>
      <Link className={styles.stat} href="/calendar"><Ring icon={CalendarDays} color="#42bcff"/><div className={styles.statText}><strong>{overview?.calendarAvailable?todayAppointments.length:seed.items.filter(item=>item.kind==='appointment').length||'—'}</strong><b>Termine</b><small>{overview?.calendarAvailable?'Heute':'Kalender prüfen'}</small><Spark color="#42bcff"/></div></Link>
      <a className={styles.stat} href="/office/eingangsrechnungen"><Ring icon={FileText} color="#80f48e"/><div className={styles.statText}><strong>{office?.connected?office.pending:'—'}</strong><b>Belege</b><small>Zur Prüfung</small><Spark color="#80f48e"/></div></a>
    </section>
    {error?<p role="status" className={styles.error}>{error}</p>:null}
    {overview?.reconnect?<p className={styles.caption}>Kalenderverbindung erforderlich. <Link href="/mail?view=settings">Kalender verbinden →</Link></p>:null}
    <div className={styles.lowerGrid}><section className={styles.agenda}><div className={styles.sectionTop}><h2><Target size={21}/>Dein nächster Schritt</h2><button className={styles.refresh} onClick={()=>void refresh()} disabled={busy} aria-label="Überblick aktualisieren"><RefreshCw size={16}/></button></div><Link href={next?'/calendar':due?'/assistant':seed.draftProjects.length?'/expose':'/projects'} className={styles.agendaContent}><Ring icon={CalendarDays} color="#83f167"/><div className={styles.agendaInfo}><strong>{next?next.title:due?due.title:seed.draftProjects.length?'Exposé-Entwurf prüfen':'Projekte im Blick behalten'}</strong><small>{next?`${day(next.start)} · ${time(next.start)} · Vorbereitung öffnen`:due?`Fällig: ${day(due.dueAt!)} · Erinnerung öffnen`:seed.draftProjects.length?`${seed.draftProjects.length} Projekte mit gespeicherten Entwürfen`:'Keine offenen Termine geladen · Projektübersicht öffnen'}</small></div><CalendarArtwork time={next?time(next.start):'EMA'}/></Link></section><ConnectedAreas/></div>
    {seed.dataWarning?<p className={styles.error}>Einige Aufgaben oder Projektinformationen konnten nicht geladen werden.</p>:null}
    <details className={styles.details}><summary>Projekte & offene Aufgaben</summary><ul>{seed.projects.map(project=><li key={project.id}><Link href={`/projects/${project.id}/overview`}>{project.name}{project.incomplete?' · Standort ergänzen':''}</Link></li>)}</ul><div className={styles.footerLink}><Link href="/projects/new">+ Neues Projekt</Link><Link href="/tasks">Aufgaben & Erinnerungen</Link><Link href="/project-import">Datei importieren</Link><Link href="/partner-submissions">Einreichungen</Link></div></details>
    <p className={styles.smallFooter}>{overview?.updatedAt?`Aktualisiert ${time(overview.updatedAt)} · `:''}EMA Intelligence · Deine Zentrale</p>
  </div>
}

