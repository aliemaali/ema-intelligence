"use client";
import { useEffect, useState } from 'react';
import { contactNameIndex, loadNameContacts, type ContactNames, type NameContact } from '@/lib/mail/contact-names';
import { MailSessionCache } from '@/lib/mail/session-cache';

const demoContacts: NameContact[] = [{id:'demo-contact',displayName:'Lena Berger',emailAddresses:[{address:'lena.berger@example.com'}]}];
export function useMailContactNames({demo,scope,revision,demoRecords}: {demo:boolean;scope:string|null;revision:number;demoRecords?:NameContact[]}) {
  const [names,setNames] = useState<ContactNames>(()=>contactNameIndex(demo ? demoRecords || demoContacts : []));
  const [cache] = useState(()=>new MailSessionCache<NameContact[]>(1));
  useEffect(()=>{
    if(demo){setNames(contactNameIndex(demoRecords || demoContacts));return;}
    if(!scope){cache.clear();setNames(contactNameIndex([]));return;}
    try { cache.bindStorage(localStorage,scope+'contact-names'); } catch { cache.clear(); /* Memory-only when storage is disabled. */ }
    setNames(contactNameIndex(cache.get('contacts') || []));
    const controller = new AbortController();
    let inFlight = false;
    let checkedAt = 0;
    const refresh = async(force=false)=>{
      if(inFlight || (!force && Date.now()-checkedAt<300000) || controller.signal.aborted)return;
      inFlight=true;
      try {
        const contacts=await loadNameContacts(async path=>{
          const response=await fetch('/api/mail/'+path,{cache:'no-store',signal:controller.signal});
          if(!response.ok)throw Object.assign(new Error('Kontakte nicht verfügbar.'),{status:response.status});
          return response.json();
        });
        if(controller.signal.aborted)return;
        // Persist only the fields needed for display, never phone numbers or other contact data.
        const minimal=contacts.map(contact=>({id:contact.id,displayName:contact.displayName,emailAddresses:contact.emailAddresses}));
        cache.set('contacts',minimal);setNames(contactNameIndex(minimal));checkedAt=Date.now();
      } catch(error) {
        checkedAt=Date.now();
        if(!controller.signal.aborted && [401,403].includes((error as {status?:number}).status || 0)){
          cache.clear();setNames(contactNameIndex([]));
        }
        // Mail remains usable without contact permissions or while temporarily offline.
      } finally {inFlight=false;}
    };
    void refresh(true);
    const update=()=>{if(!document.hidden)void refresh();};
    const timer=window.setInterval(update,300000);
    window.addEventListener('focus',update);document.addEventListener('visibilitychange',update);
    return ()=>{controller.abort();clearInterval(timer);window.removeEventListener('focus',update);document.removeEventListener('visibilitychange',update);};
  },[demo,scope,revision,demoRecords,cache]);
  return names;
}
