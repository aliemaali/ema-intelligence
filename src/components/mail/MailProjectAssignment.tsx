'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {toast} from 'sonner';
import {notifyEmaDataChanged} from '@/lib/ema/updates';

type Project={id:string;project_name:string};
async function request(path:string,body?:unknown){
  const r=await fetch(`/api/mail/${path}`,{cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
  const data=await r.json();if(!r.ok)throw new Error(data.error||'Zuordnung fehlgeschlagen.');return data;
}
export function MailProjectAssignment({id,kind,mailbox='me'}:{id:string;kind:'message'|'event';mailbox?:string}){
  const [expanded,setExpanded]=useState(false);
  const [projects,setProjects]=useState<Project[]>([]),[links,setLinks]=useState<string[]>([]),[selected,setSelected]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[saved,setSaved]=useState(false),[revision,setRevision]=useState(0);
  useEffect(()=>{
    if(!expanded)return;
    let active=true;setLoading(true);setError('');setSaved(false);
    const params=new URLSearchParams({mailbox,...(kind==='event'?{id}:{messageId:id})});
    void Promise.all([request('project-options'),request(`${kind==='event'?'event-project':'project-link'}?${params}`)]).then(([options,assigned])=>{
      if(!active)return;setProjects(options.projects);setLinks(kind==='event'?(assigned.projectId?[assigned.projectId]:[]):assigned.links.map((p:{project_id:string})=>p.project_id));
    }).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[id,kind,mailbox,revision,expanded]);
  async function save(projectId:string,remove=false){
    setBusy(true);setError('');setSaved(false);
    try{
      await request(kind==='event'?'event-project':'project-link',kind==='event'?{id,mailbox,projectId:remove?null:projectId,confirmed:true}:{messageId:id,mailbox,projectId,operation:remove?'remove':'add'});
      setLinks(old=>kind==='event'?(remove?[]:[projectId]):remove?old.filter(p=>p!==projectId):[...new Set([...old,projectId])]);setSelected('');setSaved(true);toast.success('Projektzuordnung gespeichert.');notifyEmaDataChanged();
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <details onToggle={e=>setExpanded(e.currentTarget.open)} className="my-3 rounded-xl border border-[var(--ema-border)] p-3 text-sm"><summary className="cursor-pointer">Projekt zuordnen{links.length?` · ${links.length}`:''}</summary>
    <div className="mt-3 space-y-3">
      {links.map(projectId=><div key={projectId} className="flex flex-wrap items-center gap-3"><Link href={`/projects/${projectId}/context`}>{projects.find(p=>p.id===projectId)?.project_name||'Projekt öffnen'} →</Link><button type="button" className="text-xs underline" disabled={busy} onClick={()=>void save(projectId,true)}>Verknüpfung lösen</button></div>)}
      <div className="flex flex-wrap gap-2"><select aria-label="Gemeinsames EMA-Projekt" value={selected} disabled={loading||busy||Boolean(error)} onChange={e=>{setSelected(e.target.value);setSaved(false);}} className="min-w-0 max-w-full rounded-lg border border-[var(--ema-border)] bg-[var(--ema-surface)] p-2"><option value="">{loading?'Projekte werden geladen …':'Projekt auswählen'}</option>{projects.filter(p=>!links.includes(p.id)).map(p=><option key={p.id} value={p.id}>{p.project_name}</option>)}</select><button type="button" disabled={!selected||busy||loading} className="rounded-lg border border-[var(--ema-border)] px-3 py-2" onClick={()=>void save(selected)}>{busy?'Speichern …':'Zuordnen'}</button></div>
      {error&&<p role="alert">{error} <button type="button" onClick={()=>setRevision(v=>v+1)}>Erneut versuchen</button></p>}{saved&&<p role="status">Projektzuordnung gespeichert.</p>}
    </div>
  </details>;
}
