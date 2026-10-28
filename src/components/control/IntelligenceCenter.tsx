'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Grid2X2, Bell, CalendarDays, Check, FileText, Keyboard, Mail, Mic, RefreshCw, Send, Sparkles, Target } from 'lucide-react'
import { CalendarArtwork, ConnectedAreas, ControlHero } from './ControlHero'
import { EMA_MAILBOXES, rankMail, type ControlMail } from '@/lib/control/mail'
import { ControlMailList } from './ControlMailList'
import { mailSelectionKey } from '@/lib/control/mail-selection'
import styles from './control.module.css'

type Item = { id:string; title:string; dueAt:string|null; kind:string }
type Seed = { firstName:string; items:Item[]; draftProjects:string[]; projects:{id:string;name:string;incomplete:boolean}[]; dataWarning:boolean }
type Overview = { connected:boolean; reconnect:boolean; mailboxes:{mailbox:string;state:string}[]; messages:ControlMail[]; events:{id:string;title:string;start:string;end:string}[]; calendarAvailable:boolean; updatedAt?:string }
type Office = { connected:boolean; pending:number; enabled:boolean; lastSuccessAt?:string|null; lastError?:boolean; mailboxes?:string[] }
const time = (date:string) => new Intl.DateTimeFormat('de-DE',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Berlin'}).format(new Date(date))
const day = (date:string) => new Intl.DateTimeFormat('de-DE',{day:'numeric',month:'short',timeZone:'Europe/Berlin'}).format(new Date(date))
function Ring({icon:Icon,color}:{icon:typeof Mail;color:string}) { return <span className={styles.ring} style={{'--ring':color} as React.CSSProperties}><span><Icon /></span></span> }
function Spark({color}:{color:string}) { return <svg className={styles.spark} viewBox="0 0 60 18" aria-hidden="true"><path d="M0 15L9 12L17 14L25 5L32 9L43 4L50 6L60 1" fill="none" stroke={color} strokeWidth="2" /></svg> }
async function jsonResponse<T>(url:string,signal:AbortSignal):Promise<T> { const response=await fetch(url,{cache:'no-store',signal}); if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))throw Error('Daten konnten nicht geladen werden.'); return response.json() }
export function IntelligenceCenter(seed:Seed) {
  const [overview,setOverview]=useState<Overview|null>(null),[office,setOffice]=useState<Office|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState(''),[mailbox,setMailbox]=useState('all'),[command,setCommand]=useState(''),[syncing,setSyncing]=useState(false),[syncMessage,setSyncMessage]=useState('')
  const currentRequest=useRef<AbortController|null>(null),input=useRef<HTMLInputElement>(null)
  const refresh=useCallback(async()=>{
    currentRequest.current?.abort();const controller=new AbortController();currentRequest.current=controller;setBusy(true);setError('')
    const result=await Promise.allSettled([jsonResponse<Overview>('/api/control/overview',controller.signal),jsonResponse<Office>('/office/api/intelligence/overview',controller.signal)])
    if(controller.signal.aborted)return
    if(result[0].status==='fulfilled')setOverview(result[0].value);else setError('E-Mails und Kalender konnten nicht aktualisiert werden. Bitte erneut versuchen.')
    if(result[1].status==='fulfilled')setOffice({...result[1].value,connected:true});else setOffice({connected:false,pending:0,enabled:false})
    setBusy(false)
  },[])
  useEffect(()=>{void refresh();return()=>currentRequest.current?.abort()},[refresh])
  const ask=(text?:string)=>{window.dispatchEvent(new CustomEvent('ema:assistant-open',{detail:{text:(text||command).trim().slice(0,2000)}}));setCommand('')}
  const visible=(overview?.messages||[]).filter(item=>mailbox==='all'||item.mailbox===mailbox), important=(overview?.messages||[]).filter(item=>item.priority>=3)
  const appointments=[...(overview?.events||[]).map(event=>({id:event.id,title:event.title,start:event.start,kind:'outlook'})),...seed.items.filter(item=>item.kind==='appointment'&&item.dueAt&&Date.parse(item.dueAt)>=Date.now()).map(item=>({id:item.id,title:item.title,start:item.dueAt!,kind:'plaud'}))].sort((a,b)=>Date.parse(a.start)-Date.parse(b.start))
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),todayAppointments=appointments.filter(event=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(event.start))===today)
  const next=appointments[0],due=seed.items.filter(item=>item.kind!=='appointment'&&item.dueAt).sort((a,b)=>Date.parse(a.dueAt!)-Date.parse(b.dueAt!))[0]
  async function syncInvoices(){setSyncing(true);setSyncMessage('');try{const response=await fetch('/office/api/intelligence/invoice-sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mailboxes:EMA_MAILBOXES})});if(!response.headers.get('content-type')?.includes('application/json'))throw Error('Bitte zuerst EMA Office öffnen und anmelden.');const data=await response.json();if(!response.ok)throw Error(data.error||'Abgleich konnte nicht gestartet werden.');setSyncMessage(`${data.created??0} neue Belege zur Prüfung, ${data.duplicate??0} Dubletten erkannt.${data.partial?' Der Abgleich ist teilweise fehlgeschlagen; bitte die Verbindung prüfen.':''}${data.subscriptionError?' '+data.subscriptionError:''}`);void refresh()}catch(e){setSyncMessage(e instanceof Error?e.message:'Abgleich fehlgeschlagen.')}finally{setSyncing(false)}}
  return <div className={styles.center}>
    <header className={styles.brandbar}><Link href="/apps"><strong>EMA</strong> <span>Intelligence</span></Link><div className={styles.brandTools}><Link href="/apps" aria-label="EMA Hauptseite öffnen" title="Hauptseite"><Grid2X2 size={21} /></Link><Link href="/assistant" aria-label="Erinnerungen und Aufgaben"><Bell size={21} /></Link><Link href="/settings" className={styles.avatar} aria-label="Mein Profil">{seed.firstName.slice(0,1)}</Link></div></header>
    <ControlHero title={`Hallo, ${seed.firstName}.`} subtitle="Deine Zentrale denkt mit.">
      <form className={styles.command} onSubmit={event=>{event.preventDefault();ask()}}><Sparkles /><input ref={input} aria-label="Auftrag an EMA" value={command} maxLength={2000} onChange={event=>setCommand(event.target.value)} placeholder="Was soll ich für dich erledigen?" /><button type="button" className={styles.mic} aria-label="Mit EMA sprechen" onClick={()=>ask()}><Mic size={21}/></button><button type={command.trim()?'submit':'button'} className={styles.keyboard} aria-label={command.trim()?'Auftrag senden':'Auftrag eingeben'} onClick={()=>{if(!command.trim())input.current?.focus()}}>{command.trim()?<Send size={18}/>:<Keyboard size={19}/>}</button></form>

    </ControlHero>
    <section className={styles.stats} aria-label="Dein Überblick">
      <a className={styles.stat} href="#wichtige-mails"><Ring icon={Mail} color="#ffc15d"/><div className={styles.statText}><strong>{overview?important.length:'—'}</strong><b>Wichtig</b><small>E-Mails prüfen</small><Spark color="#ffc15d"/></div></a>
      <Link className={styles.stat} href="/calendar"><Ring icon={CalendarDays} color="#42bcff"/><div className={styles.statText}><strong>{overview?.calendarAvailable?todayAppointments.length:seed.items.filter(item=>item.kind==='appointment').length||'—'}</strong><b>Termine</b><small>{overview?.calendarAvailable?'Heute':'Kalender prüfen'}</small><Spark color="#42bcff"/></div></Link>
      <a className={styles.stat} href="/office/eingangsrechnungen"><Ring icon={FileText} color="#80f48e"/><div className={styles.statText}><strong>{office?.connected?office.pending:'—'}</strong><b>Belege</b><small>Zur Prüfung</small><Spark color="#80f48e"/></div></a>
    </section>
    <section className={styles.panel} id="wichtige-mails">
      <div className={styles.sectionTop}><div className={styles.sectionTitle}><span><Mail/></span><div><h2>Wichtige E-Mails</h2><p className={styles.caption}>Aus deinen beiden Postfächern</p></div></div><button className={styles.refresh} onClick={()=>void refresh()} disabled={busy} aria-label="E-Mails und Kalender aktualisieren"><RefreshCw size={16}/></button></div>
      <div className={styles.mailboxes}><button className={styles.mailbox} aria-pressed={mailbox==='all'} onClick={()=>setMailbox('all')}>Alle</button>{EMA_MAILBOXES.map(address=><button key={address} className={styles.mailbox} aria-pressed={mailbox===address} onClick={()=>setMailbox(address)}><Mail/><span>{address}</span>{overview?<i aria-label={overview.mailboxes.find(item=>item.mailbox===address)?.state==='connected'?'Verbunden':'Lesefreigabe erforderlich'} className={`${styles.statusDot} ${overview.mailboxes.find(item=>item.mailbox===address)?.state==='connected'?'':styles.pendingDot}`}/>:null}</button>)}</div>
      {busy&&!overview?<p role="status" className={styles.busy}>Deine Postfächer werden geprüft …</p>:null}
      {error?<p role="status" className={styles.error}>{error}</p>:null}
      {overview?.reconnect?<div className={styles.empty}>Für mindestens ein Postfach fehlt noch der bestätigte Lesezugriff. Bereits verfügbare Nachrichten bleiben sichtbar.<br/><a href="/api/microsoft/connect">Microsoft-Leserechte verbinden →</a><p>Für info@ ist zusätzlich eine Postfachfreigabe in Microsoft 365 erforderlich.</p></div>:null}
      {!busy&&overview&&!overview.reconnect&&!visible.length?<p className={styles.empty}>Keine weiteren Nachrichten in dieser Übersicht.</p>:null}
      <ControlMailList key={mailbox} messages={visible} onRemoved={items=>{currentRequest.current?.abort();setBusy(false);const keys=new Set(items.map(mailSelectionKey));setOverview(previous=>previous?{...previous,messages:previous.messages.filter(mail=>!keys.has(mailSelectionKey(mail)))}:previous)}} onRestored={items=>{currentRequest.current?.abort();setBusy(false);setOverview(previous=>previous?{...previous,messages:rankMail([...new Map([...previous.messages,...items].map(mail=>[mailSelectionKey(mail),mail])).values()])}:previous)}}/>
      {overview?.messages.length?<p className={styles.caption}>Priorisiert nach Outlook-Markierung, Fristbegriffen und Rechnungshinweisen. Jeweils die letzten 25 E-Mails.</p>:null}
      <div className={styles.flow}><div className={styles.flowPath}>{[{Icon:Mail,label:'E-Mail'},{Icon:FileText,label:'Erkannt'},{Icon:Check,label:'Office'}].map(({Icon,label},index)=><div key={label} style={{display:'contents'}}>{index?<i className={styles.flowLine}/>:null}<span className={styles.flowNode}><span><Icon/></span>{label}</span></div>)}</div><div className={styles.flowLabel}>{office?.connected?office.enabled?'Eingangsrechnung · Entwurf zur Prüfung':'Rechnungseingang noch nicht aktiviert':'Office-Anmeldung erforderlich'}<br/>{office?.connected&&office.enabled?<button className={styles.textButton} disabled={syncing} onClick={()=>void syncInvoices()}>{syncing?'Wird abgeglichen …':'Beide Postfächer abgleichen →'}</button>:<a href="/office/integrationen">In Office einrichten →</a>}</div></div>
      {syncMessage?<p role="status" className={styles.caption}>{syncMessage}</p>:null}{office?.lastError?<p className={styles.error}>Der letzte Rechnungsabgleich meldet einen Fehler. Bitte die Verbindung in Office prüfen.</p>:null}
    </section>
    <div className={styles.lowerGrid}><section className={styles.agenda}><h2><Target size={21}/>Dein nächster Schritt</h2><Link href={next?'/calendar':due?'/assistant':seed.draftProjects.length?'/expose':'/projects'} className={styles.agendaContent}><Ring icon={CalendarDays} color="#83f167"/><div className={styles.agendaInfo}><strong>{next?next.title:due?due.title:seed.draftProjects.length?'Exposé-Entwurf prüfen':'Projekte im Blick behalten'}</strong><small>{next?`${day(next.start)} · ${time(next.start)} · Vorbereitung öffnen`:due?`Fällig: ${day(due.dueAt!)} · Erinnerung öffnen`:seed.draftProjects.length?`${seed.draftProjects.length} Projekte mit gespeicherten Entwürfen`:'Keine offenen Termine geladen · Projektübersicht öffnen'}</small></div><CalendarArtwork time={next?time(next.start):'EMA'}/></Link></section><ConnectedAreas/></div>
    {seed.dataWarning?<p className={styles.error}>Einige Aufgaben oder Projektinformationen konnten nicht geladen werden.</p>:null}
    <details className={styles.details}><summary>Projekte & offene Aufgaben</summary><ul>{seed.projects.map(project=><li key={project.id}><Link href={`/projects/${project.id}/overview`}>{project.name}{project.incomplete?' · Standort ergänzen':''}</Link></li>)}</ul><div className={styles.footerLink}><Link href="/projects/new">+ Neues Projekt</Link><Link href="/tasks">Aufgaben & Erinnerungen</Link><Link href="/project-import">Datei importieren</Link><Link href="/partner-submissions">Einreichungen</Link></div></details>
    <p className={styles.smallFooter}>{overview?.updatedAt?`Aktualisiert ${time(overview.updatedAt)} · `:''}EMA Intelligence · Deine Zentrale</p>
  </div>
}

