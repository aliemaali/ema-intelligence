"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {CalendarDays,ChevronRight,Home,Mail,Mic,PenLine,RefreshCw,Settings,Sparkles,Users,Folder,Flag} from 'lucide-react';
import {demoMessages} from '@/lib/mail/demo';
import {invoiceHint,type Message} from '@/lib/mail/model';
import {graphDate,teamsJoinUrl} from '@/lib/mail/calendar';
import {todayRange} from '@/lib/mail/voice';
import type {MailPimItem} from './MailPim';
import {MailSwipeRow} from './MailSwipeRow';
import s from './mail.module.css';
export type MailView='home'|'mail'|'calendar'|'contacts'|'tasks'|'settings';
export function MailBottomNav({view,onNavigate}:{view:MailView;onNavigate:(view:MailView)=>void}) {
  return <nav className={s.dashboardNav} aria-label="Mail Hauptnavigation">{([{id:'home',label:'Start',icon:Home},{id:'mail',label:'Postfach',icon:Mail},{id:'calendar',label:'Kalender',icon:CalendarDays},{id:'contacts',label:'Kontakte',icon:Users}] as const).map(item=><button key={item.id} aria-current={view===item.id?'page':undefined} onClick={()=>onNavigate(item.id)}><item.icon size={23}/><span>{item.label}</span></button>)}</nav>;
}
export function priorityMail(m:Message){return m.importance==='high'||m.flag?.flagStatus==='flagged'||m.emaAnalysis?.priority==='high';}
async function get(path:string,signal:AbortSignal){const r=await fetch('/api/mail/'+path,{cache:'no-store',signal});const d=await r.json();if(!r.ok)throw new Error(d.error||'Daten konnten nicht geladen werden.');return d;}
export function MailDashboard({demo,mailbox,accounts,canSend,canWrite,onMailbox,onNavigate,onOpen,onCompose,onVoice,onTrash,revision,demoRecords}:{demo:boolean;mailbox:string;accounts:{mailbox:string;name?:string;address?:string}[];canSend:boolean;canWrite:boolean;onMailbox:(mailbox:string)=>void;onNavigate:(view:MailView)=>void;onOpen:(m:Message)=>void;onCompose:()=>void;onVoice:()=>void;onTrash:(m:Message)=>Promise<void>;revision:unknown;demoRecords?:MailPimItem[]}) {
  const [messages,setMessages]=useState<Message[]>([]),[events,setEvents]=useState<MailPimItem[]>([]),[unread,setUnread]=useState<number|null>(null),[busy,setBusy]=useState(true),[errors,setErrors]=useState<string[]>([]),[tab,setTab]=useState<'priority'|'all'|'events'>('priority'),[partial,setPartial]=useState(false),[swiped,setSwiped]=useState<string|null>(null),[today,setToday]=useState(new Date());
  const version=useRef(0), demoDeleted=useRef(new Set<string>());
  const refresh=useCallback(async(signal:AbortSignal)=>{
    const current=++version.current;setBusy(true);
    if(demo){const day=new Date();day.setHours(14,0,0,0);setMessages(demoMessages.filter(m=>!demoDeleted.current.has(m.id)));setUnread(demoMessages.filter(m=>!m.isRead).length);setEvents(demoRecords??[{id:'demo-overview',subject:'Projektbesprechung Chemnitz',start:{dateTime:day.toISOString()},end:{dateTime:new Date(day.getTime()+1800000).toISOString()},location:{displayName:'Microsoft Teams'}}]);setBusy(false);return;}
    setMessages([]);setEvents([]);setUnread(null);setErrors([]);setPartial(false);setToday(new Date());
    const range=todayRange();
    const results=await Promise.allSettled([get(`messages?${new URLSearchParams({mailbox,folder:'inbox'})}`,signal),get(`calendar?${new URLSearchParams(range)}`,signal),get('badge',signal)]);
    if(signal.aborted||version.current!==current)return;
    const problems:string[]=[];
    if(results[0].status==='fulfilled'){setMessages(results[0].value.messages);setPartial(Boolean(results[0].value.cursor));}else problems.push('Posteingang: '+results[0].reason.message);
    if(results[1].status==='fulfilled'){setEvents(results[1].value.value||[]);if(results[1].value['@odata.nextLink'])problems.push('Weitere Termine findest du im Kalender.');}else problems.push('Kalender: '+results[1].reason.message);
    if(results[2].status==='fulfilled')setUnread(results[2].value.count);else problems.push('Ungelesen-Zahl derzeit nicht verfügbar.');
    setErrors(problems);setBusy(false);
  },[demo,mailbox,demoRecords]);
  useEffect(()=>{const controller=new AbortController();void refresh(controller.signal);const update=()=>{if(!document.hidden)void refresh(controller.signal);};const timer=setInterval(update,60000);window.addEventListener('focus',update);document.addEventListener('visibilitychange',update);return()=>{controller.abort();version.current++;clearInterval(timer);window.removeEventListener('focus',update);document.removeEventListener('visibilitychange',update);};},[refresh,revision]);
  const important=messages.filter(priorityMail),list=tab==='priority'?important:messages;
  const tasks=messages.reduce((n,m)=>n+(m.emaAnalysis?.tasks.length||0),0);
  return <div className={s.dashboard}>
    <div className={s.dashboardScroll}>
      <header className={s.dashboardHeader}><a href="/apps" className={s.dashboardBrand}><i>e</i><span>EMA Mail</span></a><div><button onClick={()=>void refresh(new AbortController().signal)} disabled={busy} aria-label="Dashboard aktualisieren"><RefreshCw size={18}/></button><button onClick={()=>onNavigate('settings')} aria-label="Einstellungen"><Settings size={19}/></button></div></header>
      {demo&&<p className={s.dashboardDemo}>Designvorschau · Beispieldaten</p>}
      <div className={s.dashboardTitle}><p>{today.toLocaleDateString('de-DE',{timeZone:'Europe/Berlin',weekday:'long',day:'numeric',month:'long'})}</p><h1>Dein Überblick</h1></div>
      <section className={s.dashboardHero} aria-label="Tagesüberblick"><Sparkles size={29}/><div><h2>Alles im Blick</h2><p>{busy?'Dein Tag wird geladen …':`${unread===null?'–':unread} ungelesene E-Mails. ${events.length} Termine heute.`}</p><small>Ungelesen: alle freigegebenen Postfächer</small><p className={s.dashboardInsight}>{tasks?`${tasks} Aufgabenvorschläge in den analysierten E-Mails.`:'Wichtige Nachrichten und Termine an einem Ort.'}</p></div></section>
      <label className={s.dashboardMailbox}><span>Postfach</span><select value={mailbox} onChange={e=>onMailbox(e.target.value)} aria-label="Postfach auswählen">{accounts.length?accounts.map(a=><option key={a.mailbox} value={a.mailbox}>{a.name||a.address||a.mailbox}</option>):<option value="me">Mein Postfach</option>}</select></label>
      {errors.length>0&&<div className={s.dashboardErrors} role="status">{errors.map(error=><p key={error}>{error}</p>)}<button onClick={()=>void refresh(new AbortController().signal)}>Erneut laden</button></div>}
      <div className={s.dashboardTabs} role="group" aria-label="Übersicht filtern">{([{id:'priority',label:'Priorität'},{id:'all',label:'Alle E-Mails'},{id:'events',label:'Termine'}]as const).map(t=><button key={t.id} aria-pressed={tab===t.id} onClick={()=>setTab(t.id)}>{t.label}</button>)}</div>
      <div className={s.dashboardColumns}>
      {tab!=='events'&&<section className={s.dashboardMails}><div className={s.dashboardSectionTitle}><h2>{tab==='priority'?'Jetzt wichtig':'Dein Posteingang'}</h2><button onClick={()=>onNavigate('mail')} aria-label="Postfach öffnen"><ChevronRight size={20}/></button></div>
      {!busy&&list.length===0&&<p className={s.dashboardEmpty}>{errors.some(e=>e.startsWith('Posteingang:'))?'Posteingang konnte nicht geladen werden.':tab==='priority'?'Keine als wichtig markierten E-Mails in den geladenen Nachrichten.':'Dein Posteingang ist leer.'}</p>}
      {list.slice(0,tab==='priority'?3:8).map((m,i)=><div className={s.dashboardMailWrap} key={m.id}><MailSwipeRow open={swiped===m.id} disabled={!canWrite||busy} subject={m.subject} onOpenChange={open=>setSwiped(open?m.id:null)} onDelete={async()=>{if(demo)demoDeleted.current.add(m.id);await onTrash(m);setSwiped(null);if(demo)setMessages(old=>old.filter(item=>item.id!==m.id));else void refresh(new AbortController().signal);}}><button className={s.dashboardMail} onClick={()=>onOpen(m)}><span className={s.dashboardAvatar} data-color={i%3}>{(m.from.emailAddress.name||m.from.emailAddress.address).split(/\s+/).slice(0,2).map(n=>n[0]).join('').toUpperCase()}</span><span className={s.dashboardMailContent}><span className={s.dashboardSender}>{m.from.emailAddress.name||m.from.emailAddress.address}<time>{new Date(m.receivedDateTime).toLocaleTimeString('de-DE',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit'})}</time></span><strong>{m.subject||'(Kein Betreff)'}</strong><span className={s.dashboardPreview}>{m.bodyPreview}</span><span className={s.dashboardTag}>{invoiceHint(m)?<><Folder size={13}/> Rechnungshinweis</>:priorityMail(m)?<><Flag size={13}/> Wichtig</>:<><Mail size={13}/> Nachricht</>}</span></span></button></MailSwipeRow></div>)}
      {partial&&<p className={s.dashboardFootnote}>Aus den neuesten 30 Nachrichten. Weitere E-Mails findest du im Postfach.</p>}
      </section>}
      <section className={s.dashboardAgenda}><div className={s.dashboardSectionTitle}><h2>Deine Termine</h2><button onClick={()=>onNavigate('calendar')} aria-label="Kalender öffnen"><ChevronRight size={20}/></button></div><p className={s.dashboardFootnote}>Heute · dein persönlicher Kalender</p>
      {!busy&&!events.length&&<p className={s.dashboardEmpty}>{errors.some(e=>e.startsWith('Kalender:'))?'Kalender konnte nicht geladen werden.':'Heute stehen keine Termine an.'}</p>}
      {events.slice(0,tab==='events'?20:4).map(event=>{const join=teamsJoinUrl(event.onlineMeeting?.joinUrl);return <article className={s.dashboardEvent} key={event.id}><span className={s.dashboardDot}/><time>{event.isAllDay?'Ganztägig':event.start?graphDate(event.start.dateTime).toLocaleTimeString('de-DE',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit'}):'–'}</time><div><button onClick={()=>onNavigate('calendar')}>{event.subject||'Termin'}</button><p>{event.isOnlineMeeting?'Microsoft Teams':event.location?.displayName||'Kalendertermin'}</p></div>{join&&<a href={join} target="_blank" rel="noopener noreferrer">Beitreten</a>}</article>;})}
      </section></div>
    </div>
    <div className={s.dashboardActions}><button onClick={onVoice} aria-label="Sprachsteuerung öffnen"><Mic size={24}/><span>Sprechen</span></button><button disabled={!canSend} onClick={onCompose} aria-label="Neue E-Mail verfassen"><PenLine size={25}/></button></div>
  </div>;
}
