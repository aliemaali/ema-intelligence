"use client";
import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Square, Volume2 } from 'lucide-react';
import { MailDialog } from './MailDialog';
import s from './mail.module.css';
type Recognition = {lang:string;continuous:boolean;interimResults:boolean;onresult:((event:{results:ArrayLike<ArrayLike<{transcript:string}>>})=>void)|null;onerror:((event:{error:string})=>void)|null;onend:(()=>void)|null;start:()=>void;abort:()=>void};
type SpeechWindow = Window & {SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};
export function speakMail(text:string) {
  if (!('speechSynthesis' in window)) throw new Error('Vorlesen wird hier nicht unterstützt.');
  window.speechSynthesis.cancel();
  const words = text.match(/[\s\S]{1,350}(?:[.!?]\s|$)|[\s\S]{1,350}/g) || [];
  for (const chunk of words.slice(0,30)) { const utterance=new SpeechSynthesisUtterance(chunk);utterance.lang='de-DE';window.speechSynthesis.speak(utterance); }
}
export function MailVoice({onCommand,onClose}:{onCommand:(text:string)=>Promise<string>;onClose:()=>void}) {
  const [text,setText]=useState(''),[listening,setListening]=useState(false),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[supported,setSupported]=useState(false);
  const recognition=useRef<Recognition|null>(null), active=useRef(true),timer=useRef<ReturnType<typeof setTimeout>>();
  useEffect(()=>{
    active.current=true;
    const w=window as SpeechWindow;setSupported(Boolean(w.SpeechRecognition||w.webkitSpeechRecognition));
    function hide(){if(document.hidden){recognition.current?.abort();window.speechSynthesis?.cancel();}}
    document.addEventListener('visibilitychange',hide);
    return ()=>{active.current=false;clearTimeout(timer.current);recognition.current?.abort();window.speechSynthesis?.cancel();document.removeEventListener('visibilitychange',hide);};
  },[]);
  function start(){
    if(listening){recognition.current?.abort();return;}
    window.speechSynthesis?.cancel();
    const Constructor=(window as SpeechWindow).SpeechRecognition||(window as SpeechWindow).webkitSpeechRecognition;
    if(!Constructor){setStatus('Nutze das Mikrofon deiner iPhone-Tastatur im Befehlsfeld.');return;}
    const r=new Constructor();recognition.current=r;r.lang='de-DE';r.continuous=false;r.interimResults=false;
    r.onresult=e=>{if(active.current)setText(e.results[0]?.[0]?.transcript||'');};
    r.onerror=e=>{if(active.current)setStatus(e.error==='not-allowed'?'Mikrofonzugriff wurde nicht erlaubt. Nutze die Tastatur oder erlaube den Zugriff in Safari.':'Spracherkennung nicht verfügbar. Nutze die Tastatur-Diktierfunktion oder versuche es erneut.');};
    r.onend=()=>{clearTimeout(timer.current);if(active.current)setListening(false);};
    setStatus('');setListening(true);
    try{r.start();timer.current=setTimeout(()=>{r.abort();if(active.current)setStatus('Aufnahme beendet. Du kannst den Befehl eingeben oder erneut sprechen.');},20000);}catch{setListening(false);setStatus('Mikrofon konnte nicht gestartet werden. Nutze die Tastatur.');}
  }
  async function run(){recognition.current?.abort();setBusy(true);try{const result=await onCommand(text);if(active.current)setStatus(result);}catch(e){if(active.current)setStatus(e instanceof Error?e.message:'Befehl fehlgeschlagen.');}finally{if(active.current)setBusy(false);}}
  return <MailDialog title="EMA Sprachsteuerung" onClose={onClose} busy={busy}>
    <p>Tippe auf das Mikrofon, sprich und prüfe den erkannten Befehl. Die Spracherkennung erfolgt über deinen Browser und dessen Sprachdienst.</p>
    <button className={s.primary} onClick={start} disabled={busy||!supported} aria-pressed={listening}>{listening?<MicOff size={18}/>:<Mic size={18}/>} {listening?'Aufnahme beenden':'Sprechen'}</button>
    {!supported&&<p>Hier kannst du das Mikrofon deiner iPhone-Tastatur verwenden.</p>}
    <label>Dein Befehl<textarea rows={3} maxLength={2000} value={text} onChange={e=>setText(e.target.value)} placeholder="Zeig mir die E-Mails zum Projekt Chemnitz"/></label>
    <div className={s.voiceExamples}>{['Lies mir meine neuen E-Mails vor','Fasse die Mail von Mehmet zusammen','Antworte: Vielen Dank, ich melde mich morgen','Erstelle morgen um 14 Uhr einen Termin mit Teams-Link'].map(example=><button key={example} className={s.subtle} disabled={busy||listening} onClick={()=>setText(example)}>{example}</button>)}</div>
    {status&&<p role="status" aria-live="polite">{status}</p>}
    <footer><button className={s.subtle} onClick={()=>{window.speechSynthesis?.cancel();setStatus('Vorlesen beendet.');}}><Square size={15}/> Vorlesen stoppen</button><button className={s.primary} disabled={busy||listening||!text.trim()} onClick={()=>void run()}><Volume2 size={16}/>{busy?'Wird verarbeitet …':'Befehl ausführen'}</button></footer>
  </MailDialog>;
}
