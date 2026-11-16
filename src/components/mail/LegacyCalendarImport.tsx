"use client";
import {useEffect,useState} from 'react';
import {MailDialog} from './MailDialog';
import {LEGACY_CALENDAR_KEY,readLegacyCalendar,type LegacyCalendarEvent} from '@/lib/ema/legacy-calendar';
import s from './mail.module.css';
export function LegacyCalendarImport({userId,onImported}:{userId:string;onImported:()=>void}) {
  const [items,setItems]=useState<LegacyCalendarEvent[]>([]),[open,setOpen]=useState(false),[selected,setSelected]=useState<string[]>([]),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  const key=`ema-calendar-imports-v1:${userId}`;
  useEffect(()=>{try{const done=JSON.parse(localStorage.getItem(key)||'{}');setItems(readLegacyCalendar(localStorage.getItem(LEGACY_CALENDAR_KEY)).filter(item=>!done[item.id]));}catch{/* Preserve the original device data when storage is blocked. */}},[key]);
  async function migrate(){
    setBusy(true);setNotice('');let count=0;const completed=new Set<string>();
    try {
      const chosen=items.filter(item=>selected.includes(item.id));
      for(let start=0;start<chosen.length;start+=10){
        const response=await fetch('/api/mail/calendar-import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({events:chosen.slice(start,start+10),confirmed:true})});
        const data=await response.json();if(!response.ok)throw new Error(data.error||'Übernahme konnte nicht bestätigt werden.');
        for(const result of data.results||[])if(result.eventId){completed.add(result.id);count++;}
        try{const done=JSON.parse(localStorage.getItem(key)||'{}');for(const result of data.results||[])if(result.eventId)done[result.id]=result.eventId;localStorage.setItem(key,JSON.stringify(done));}catch{/* Graph source markers also protect repeated imports. */}
        if((data.results||[]).some((result:{eventId?:string})=>!result.eventId))throw new Error('Einige Termine konnten nicht übernommen werden. Die Originale bleiben auf diesem Gerät erhalten.');
      }
      setOpen(false);
    }catch(error){setNotice((error as Error).message);}
    finally{setItems(old=>old.filter(item=>!completed.has(item.id)));setSelected([]);setBusy(false);if(count)onImported();}
  }
  if(!items.length && !notice)return null;
  return <>
    <p className={s.dashboardFootnote}>{items.length ? <button type="button" className={s.subtle} onClick={()=>setOpen(true)}>Frühere Gerätetermine übernehmen ({items.length})</button> : null}</p>
    {notice && <p role="status">{notice}</p>}
    {open && <MailDialog title="Frühere Termine übernehmen" busy={busy} onClose={()=>setOpen(false)}>
      <p>Wähle deine Termine aus. Sie werden einmalig in deinen gemeinsamen Microsoft-Kalender übernommen. Die bisherigen Gerätedaten bleiben als Sicherung erhalten.</p>
      {items.map(item=><label className={s.checkLabel} key={item.id}><input type="checkbox" checked={selected.includes(item.id)} disabled={busy} onChange={event=>setSelected(old=>event.target.checked?[...old,item.id]:old.filter(id=>id!==item.id))}/><span>{item.title} · {item.date} · {item.time}</span></label>)}
      {notice && <p role="alert">{notice}</p>}
      <button className={s.primary} disabled={busy||!selected.length} onClick={()=>void migrate()}>{busy?'Wird übernommen …':'Ausgewählte Termine übernehmen'}</button>
    </MailDialog>}
  </>;
}
