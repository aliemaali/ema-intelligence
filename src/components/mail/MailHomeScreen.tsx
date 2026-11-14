"use client";
import { useCallback, useEffect, useState } from "react";
import s from "./mail.module.css";
type BadgeNavigator = Navigator & {setAppBadge?: (count:number)=>Promise<void>; standalone?:boolean};
export function MailHomeScreen({demo, visible, revision, background=false}: {demo:boolean; visible:boolean; revision?:unknown; background?:boolean}) {
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);
  const [count,setCount]=useState<number|null>(null);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (demo) return;
    try {
      const response=await fetch('/api/mail/badge',{cache:'no-store',signal});
      if (signal?.aborted) return;
      if ([401,403].includes(response.status)) {
        setCount(null);
        await (navigator as BadgeNavigator).setAppBadge?.(0);
        return;
      }
      if (!response.ok) return;
      const result=await response.json();
      if (signal?.aborted || !Number.isSafeInteger(result.count) || result.count<0) return;
      setCount(result.count);
      await (navigator as BadgeNavigator).setAppBadge?.(result.count);
    } catch { /* Keep last known count when offline or unsupported. */ }
  },[demo]);
  useEffect(()=>{
    if(demo || !background) return;
    const controller=new AbortController();
    const update=()=>{ if(document.visibilityState==='visible') void refresh(controller.signal); };
    update();
    const timer=window.setInterval(update,60000);
    window.addEventListener('focus',update);
    document.addEventListener('visibilitychange',update);
    return ()=>{controller.abort();clearInterval(timer);window.removeEventListener('focus',update);document.removeEventListener('visibilitychange',update);};
  },[demo,refresh,revision,background]);
  useEffect(()=>{if(visible) void refresh();},[visible,refresh]);
  async function enable() {
    if(demo) {setNotice('Vorschau: Es werden keine Mitteilungen aktiviert und keine Kennzeichen gesetzt.');return;}
    setBusy(true);
    try {
      if(!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) throw new Error('Bitte EMA Mail zuerst zum Home-Bildschirm hinzufügen und dort öffnen.');
      const key=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if(!key) throw new Error('Push ist serverseitig noch nicht eingerichtet.');
      // Permission prompt stays directly within the user's button gesture.
      if(await Notification.requestPermission()!=='granted') throw new Error('Mitteilungen sind nicht erlaubt. Prüfe auf dem iPhone Einstellungen → Mitteilungen → eMail, einschließlich Kennzeichen.');
      const registration=await navigator.serviceWorker.register('/mail/sw.js',{scope:'/mail/'});
      if(!registration.active) await new Promise<void>((resolve,reject)=>{
        const worker=registration.installing||registration.waiting;
        const timer=setTimeout(()=>reject(new Error('Bitte die App erneut öffnen und noch einmal aktivieren.')),10000);
        if(!worker){clearTimeout(timer);reject(new Error('Service Worker noch nicht aktiv.'));return;}
        worker.addEventListener('statechange',()=>{if(worker.state==='activated'){clearTimeout(timer);resolve();}});
      });
      const bytes=Uint8Array.from(atob(key.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
      const subscription=await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});
      const response=await fetch('/api/mail/push-subscription',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:subscription.endpoint,keys:subscription.toJSON().keys})});
      if(!response.ok) throw new Error('Push-Gerät konnte nicht gespeichert werden. Bitte Anmeldung und Freischaltung prüfen.');
      await refresh();
      setNotice('Dieses Gerät ist registriert. Neue-Mail-Push zusätzlich unten für die gewünschten Postfächer aktivieren. Hintergrundaktualisierung benötigt einen eingerichteten Worker; Kennzeichen kannst du in den iPhone-Einstellungen erlauben.');
    } catch(error) {setNotice(error instanceof Error?error.message:'Aktivierung fehlgeschlagen.');}
    finally {setBusy(false);}
  }
  if(!visible) return null;
  return <section className={s.auxItem}>
    <h3>eMail auf deinem Home-Bildschirm</h3>
    {/* The system overlays the live unread badge; it is never baked into the icon. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src="/mail/icons/icon-192.png" width="80" height="80" alt="Dein eMail App-Logo" />
    <p>In Safari: Teilen → Zum Home-Bildschirm. Danach eMail über das neue Symbol öffnen.</p>
    <p>Das App-Kennzeichen zählt ungelesene E-Mails im Posteingang deines eigenen und aller für dich freigegebenen gemeinsamen Postfächer. Beim Lesen wird es aktualisiert; bei null verschwindet es.</p>
    <p>{demo?'Vorschau: keine echten Ungelesen-Zahlen.':count===null?'Ungelesen-Zahl noch nicht verfügbar.':`${count} ungelesene E-Mails.`} Auf dem iPhone ab iOS 16.4 sind Mitteilungen und Kennzeichen erforderlich. Änderungen aus anderen Mail-Apps erscheinen beim nächsten Abgleich.</p>
    <button className={s.primary} disabled={busy} onClick={()=>void enable()}>{busy?'Wird aktiviert …':'Mitteilungen und App-Kennzeichen aktivieren'}</button>
    {notice && <p role="status">{notice}</p>}
  </section>;
}
