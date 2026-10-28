'use client'
import { useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { ChevronRight, FileText, Mail, RotateCcw, Trash2 } from 'lucide-react'
import type { ControlMail } from '@/lib/control/mail'
import { horizontalSwipe, mailSelectionKey, toggleMailSelection } from '@/lib/control/mail-selection'
import styles from './control.module.css'
import list from './mail-list.module.css'
const day = (date:string) => new Intl.DateTimeFormat('de-DE',{day:'numeric',month:'short',timeZone:'Europe/Berlin'}).format(new Date(date))
function SwipeMail({mail,selecting,checked,busy,onToggle,onRemove}:{mail:ControlMail;selecting:boolean;checked:boolean;busy:boolean;onToggle:()=>void;onRemove:()=>void}) {
  const [offset,setOffset]=useState(0),[dragging,setDragging]=useState(false)
  const gesture=useRef<{x:number;y:number;start:number;horizontal:boolean;vertical:boolean;moved:boolean}|null>(null)
  function move(event:PointerEvent<HTMLDivElement>) {
    const g=gesture.current;if(!g||selecting||busy)return
    const dx=event.clientX-g.x,dy=event.clientY-g.y
    if(!g.horizontal&&Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx))g.vertical=true
    if(g.vertical)return
    if(!g.horizontal&&horizontalSwipe(dx,dy)){g.horizontal=true;g.moved=true;setDragging(true);event.currentTarget.setPointerCapture(event.pointerId)}
    if(g.horizontal)setOffset(Math.max(-88,Math.min(0,g.start+dx)))
  }
  function end(event:PointerEvent<HTMLDivElement>) {
    const g=gesture.current
    if(g?.horizontal){const final=g.start+event.clientX-g.x;setOffset(final < -35 ? -88 : 0)}
    setDragging(false)
  }
  const content=<>{mail.invoice?<FileText aria-hidden="true"/>:<Mail aria-hidden="true"/>}<span className={styles.mailText}><small>{mail.sender} · {mail.mailbox.split('@')[0]} · {mail.receivedAt?day(mail.receivedAt):''}</small><strong>{mail.subject}</strong><span className={list.reason}>{mail.reason}</span></span></>
  return <div className={list.shell} style={{'--tone':mail.invoice?'#51dffc':mail.priority>=4?'#ffc35a':'#7fbcf2'} as CSSProperties}>
    <button type="button" className={list.swipeDelete} onClick={onRemove} disabled={busy} tabIndex={offset<0&&!selecting?0:-1} aria-hidden={offset===0||selecting} aria-label={`Nachricht „${mail.subject}“ aus EMA entfernen`}><Trash2 size={20}/>Entfernen</button>
    <div className={`${styles.mailRow} ${list.front}`} style={{transform:`translateX(${selecting?0:offset}px)`,transition:dragging?'none':undefined}} onPointerDown={event=>{if(selecting||busy||(event.pointerType==='mouse'&&event.button!==0))return;gesture.current={x:event.clientX,y:event.clientY,start:offset,horizontal:false,vertical:false,moved:false}}} onPointerMove={move} onPointerUp={end} onPointerCancel={()=>{setDragging(false);setOffset(0);gesture.current=null}} onKeyDown={event=>{if(event.key==='Escape')setOffset(0)}}>
      {selecting?<label className={list.link}><input type="checkbox" checked={checked} disabled={busy} onChange={onToggle} aria-label={`Nachricht auswählen: ${mail.subject}`}/>{content}</label>:<><a className={list.link} href={mail.url||'/microsoft'} target={mail.url?'_blank':undefined} rel="noopener noreferrer" onClick={event=>{if((gesture.current?.moved&&event.detail!==0)||offset<0){event.preventDefault();if(!gesture.current?.moved)setOffset(0)}}}>{content}<ChevronRight className={styles.mailRight}/></a><button type="button" className={list.quickDelete} disabled={busy} onClick={onRemove} aria-label={`Nachricht „${mail.subject}“ aus EMA entfernen`} title="Aus EMA entfernen"><Trash2 size={17}/></button></>}
    </div>
  </div>
}
export function ControlMailList({messages,onRemoved,onRestored}:{messages:ControlMail[];onRemoved:(messages:ControlMail[])=>void;onRestored:(messages:ControlMail[])=>void}) {
  const [selecting,setSelecting]=useState(false),[selected,setSelected]=useState<Set<string>>(new Set()),[expanded,setExpanded]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[undo,setUndo]=useState<ControlMail[]>([])
  const lock=useRef(false),shown=expanded?messages:messages.slice(0,2),chosen=messages.filter(mail=>selected.has(mailSelectionKey(mail)))
  async function change(action:'hide'|'restore',items:ControlMail[]) {
    if(lock.current||!items.length)return
    lock.current=true;setBusy(true);setError('')
    try {
      const response=await fetch('/api/control/mail-dismissals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,messages:items.map(({id,mailbox})=>({id,mailbox}))})})
      if(!response.headers.get('content-type')?.includes('application/json'))throw Error('Bitte erneut anmelden.')
      const data=await response.json();if(!response.ok)throw Error(data.error||'Speichern fehlgeschlagen.')
      if(action==='hide'){onRemoved(items);setUndo(items);setSelected(new Set());setSelecting(false)}else{onRestored(items);setUndo([])}
    } catch(error){setError(error instanceof Error?error.message:'Bitte erneut versuchen.')}
    finally{lock.current=false;setBusy(false)}
  }
  return <>
    {messages.length?<div className={list.toolbar}>{selecting?<><span>{chosen.length} ausgewählt</span><button type="button" disabled={busy} onClick={()=>{setExpanded(true);setSelected(chosen.length===messages.length?new Set():new Set(messages.map(mailSelectionKey)))}}>{chosen.length===messages.length?'Auswahl aufheben':'Alle auswählen'}</button><button type="button" className={list.removeSelected} disabled={busy||!chosen.length} onClick={()=>void change('hide',chosen)}><Trash2 size={15}/>Entfernen{chosen.length?` (${chosen.length})`:''}</button><button type="button" disabled={busy} onClick={()=>{setSelecting(false);setSelected(new Set());setError('')}}>Abbrechen</button></>:<button type="button" disabled={busy} onClick={()=>{setSelecting(true);setExpanded(true);setSelected(new Set());setError('')}}>Auswählen</button>}</div>:null}
    {error?<p role="alert" className={styles.error}>{error}</p>:null}
    {undo.length?<div role="status" className={list.undo}><span>{undo.length===1?'Nachricht aus EMA entfernt.':`${undo.length} Nachrichten aus EMA entfernt.`}</span><button type="button" disabled={busy} onClick={()=>void change('restore',undo)}><RotateCcw size={14}/>Rückgängig</button></div>:null}
    <div className={styles.mailRows}>{shown.map(mail=><SwipeMail key={mailSelectionKey(mail)} mail={mail} selecting={selecting} checked={selected.has(mailSelectionKey(mail))} busy={busy} onToggle={()=>setSelected(current=>toggleMailSelection(current,mailSelectionKey(mail)))} onRemove={()=>void change('hide',[mail])}/>)}</div>
    {messages.length>2?<button type="button" className={styles.textButton} disabled={selecting} onClick={()=>setExpanded(!expanded)}>{expanded?'Weniger anzeigen':`Weitere Nachrichten (${messages.length-2}) →`}</button>:null}
  </>
}
