"use client";
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {createClient} from '@/lib/supabase/client';
import {listenForEmaChanges,notifyEmaDataChanged} from '@/lib/ema/updates';
type Reminder={id:string;title:string;due_at:string;completed_at:string|null};
export function SharedReminderList({userId,initial}:{userId:string;initial:Reminder[]}){
  const [items,setItems]=useState(initial),[title,setTitle]=useState(''),[due,setDue]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const router=useRouter();
  useEffect(()=>{setItems(initial);},[initial]);
  useEffect(()=>listenForEmaChanges(()=>{router.refresh();}),[router]);
  async function save(event:React.FormEvent){
    event.preventDefault();if(busy)return;setBusy(true);setError('');
    try{
      const name=title.trim(),date=new Date(due);if(!name||name.length>200||!Number.isFinite(date.getTime()))throw new Error('Bitte Titel und Datum prüfen.');
      const {data,error}=await createClient().from('ema_reminders').insert({user_id:userId,title:name,due_at:date.toISOString()}).select('id,title,due_at,completed_at').single();
      if(error||!data)throw new Error('Aufgabe konnte nicht gespeichert werden.');
      setItems(old=>[...old,data]);setTitle('');setDue('');notifyEmaDataChanged();
    }catch(error){setError((error as Error).message);}finally{setBusy(false);}
  }
  async function toggle(item:Reminder){
    if(busy)return;setBusy(true);setError('');
    try{
      const {data,error}=await createClient().from('ema_reminders').update({completed_at:item.completed_at?null:new Date().toISOString()}).eq('id',item.id).eq('user_id',userId).select('id,completed_at').single();
      if(error||!data)throw new Error('Aufgabenstatus konnte nicht gespeichert werden.');
      setItems(old=>old.map(row=>row.id===item.id?{...row,completed_at:data.completed_at}:row));notifyEmaDataChanged();
    }catch(error){setError((error as Error).message);}finally{setBusy(false);}
  }
  return <section id="reminders" className="rounded-2xl border border-border bg-card p-4 space-y-4">
    <h2 className="text-xl font-bold">Meine Aufgaben & Erinnerungen</h2>
    <p className="text-sm text-muted-foreground">Ein gemeinsamer Stand für Intelligence, Assistenz und Mail.</p>
    {error&&<p role="alert">{error}</p>}
    <form onSubmit={event=>void save(event)} className="grid gap-3">
      <label>Titel<input className="input" required maxLength={200} value={title} onChange={event=>setTitle(event.target.value)} disabled={busy}/></label>
      <label>Fällig<input className="input" required type="datetime-local" value={due} onChange={event=>setDue(event.target.value)} disabled={busy}/></label>
      <button className="btn-primary" disabled={busy}>Aufgabe speichern</button>
    </form>
    {!items.length?<p>Keine persönlichen Aufgaben vorhanden.</p>:items.map(item=><label key={item.id} className="flex items-center gap-3 py-2 border-b border-border">
      <input type="checkbox" checked={Boolean(item.completed_at)} disabled={busy} onChange={()=>void toggle(item)}/>
      <span><strong className={item.completed_at?'line-through opacity-60':''}>{item.title}</strong><small className="block">{new Date(item.due_at).toLocaleString('de-DE',{timeZone:'Europe/Berlin',dateStyle:'short',timeStyle:'short'})}</small></span>
    </label>)}
  </section>;
}
