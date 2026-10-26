'use client'

import Link from 'next/link'
import {useEffect, useRef, useState} from 'react'
import {ArrowLeft, ArrowUpRight, Camera, ChevronRight, FileText, FolderOpen, History, ImagePlus, ScanLine, ShieldAlert, X} from 'lucide-react'
import {AREAS, OPERATORS, type Assessment, type CheckInput} from '@/lib/smart-check/model'
import {CABINET_CRITERIA,buildCabinetCriteria} from '@/lib/smart-check/criteria'
import s from './photo-check.module.css'

type Asset = {id:string; file_name:string; mime_type:string}
type Pending = {key:string; file:File; preview:string|null}
type Report = {id:string; version:number; input:CheckInput; result:Assessment; attachments:Asset[]}
type PastCheck = {id:string; display_name:string; version:number; created_at:string}
const initial = ():CheckInput => ({title:'',projectId:null,area:'cabinet',address:'',building:'',operator:'',operatorConfirmed:false,operatorEvidence:'',rulesConfirmed:false,ruleVersion:'',ruleLocator:'',pvKwp:null,inverterKw:null,storageKwh:null,storageChargeKw:null,heatKw:null,heatElectricKw:null,heaterKw:null,wallboxKw:null,deviceModel:'',notes:'',sls:'unknown',spd:'unknown',apz:'unknown',rfz:'unknown',measurementProof:false,hazard:false,hazardEvidence:'',attachmentIds:[],folderId:null,mode:'rules',aiConsent:false,previousReportId:null})

async function readResponse(response:Response) {
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Bitte erneut anmelden und Smart Check öffnen.')
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Der Vorgang konnte nicht abgeschlossen werden.')
  return data
}
async function preparePhoto(file:File) {
  if (!file.type.startsWith('image/')) {
    if (file.type !== 'application/pdf') throw new Error('Bitte ein Foto als JPG/PNG oder eine PDF auswählen.')
    return file
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image(); img.src = url; await img.decode()
    const scale = Math.min(1, 2000 / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Bildverarbeitung nicht verfügbar.')
    context.fillStyle = '#ffffff'; context.fillRect(0,0,canvas.width,canvas.height)
    context.drawImage(img,0,0,canvas.width,canvas.height)
    const blob = await new Promise<Blob|null>(resolve => canvas.toBlob(resolve,'image/jpeg',.88))
    if (!blob) throw new Error('Bild konnte nicht vorbereitet werden.')
    return new File([blob],file.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg'})
  } catch {throw new Error('Dieses Foto ist nicht lesbar. Bitte erneut aufnehmen oder als JPG/PNG auswählen.')}
  finally {URL.revokeObjectURL(url)}
}

export default function PhotoCheck({officePreparationUrl='/office/vertrieb/smart-check'}:{officePreparationUrl?:string}) {
  const [input,setInput] = useState<CheckInput>(initial)
  const [assets,setAssets] = useState<Asset[]>([]), [pending,setPending] = useState<Pending[]>([])
  const [report,setReport] = useState<Report|null>(null), [history,setHistory] = useState<PastCheck[]>([])
  const [aiAvailable,setAiAvailable] = useState(false), [consent,setConsent] = useState(false)
  const [loading,setLoading] = useState(true), [busy,setBusy] = useState(false)
  const [error,setError] = useState(''), [message,setMessage] = useState(''), [selected,setSelected] = useState<string[]>([])
  const camera = useRef<HTMLInputElement>(null), files = useRef<HTMLInputElement>(null), resultPanel = useRef<HTMLElement>(null)
  const urls = useRef(new Set<string>()), operation = useRef(false)
  const count = assets.length + pending.length
  const update = <K extends keyof CheckInput>(key:K,value:CheckInput[K]) => setInput(old => ({...old,[key]:value}))
  useEffect(() => {
    const controller = new AbortController(), localUrls = urls.current
    fetch('/api/smart-check',{signal:controller.signal}).then(readResponse).then(data => {
      setHistory(data.reports || []); setAiAvailable(data.aiAvailable === true)
    }).catch(cause => {if (!controller.signal.aborted) setError(cause.message)})
      .finally(() => {if (!controller.signal.aborted) setLoading(false)})
    return () => {controller.abort(); localUrls.forEach(url => URL.revokeObjectURL(url)); localUrls.clear()}
  },[])
  async function addFiles(list:FileList|null) {
    if (!list?.length || operation.current) return
    if (count + list.length > 8) {setError('Du kannst bis zu 8 Aufnahmen oder PDFs hinzufügen.'); return}
    operation.current = true; setBusy(true); setError(''); setMessage('Aufnahmen vorbereiten …')
    try {for (const original of Array.from(list)) {
      const file = await preparePhoto(original)
      if (file.size > 3*1024*1024) throw new Error('Diese Datei ist zu groß. PDFs dürfen höchstens 3 MB haben.')
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null
      if (preview) urls.current.add(preview)
      setPending(old => [...old,{key:crypto.randomUUID(),file,preview}])
    }} catch (cause) {setError(cause instanceof Error ? cause.message : 'Aufnahme konnte nicht vorbereitet werden.')}
    finally {operation.current=false; setBusy(false); setMessage(''); if(camera.current)camera.current.value=''; if(files.current)files.current.value=''}
  }
  function removePending(item:Pending) {
    if(item.preview){URL.revokeObjectURL(item.preview);urls.current.delete(item.preview)}
    setPending(old=>old.filter(asset=>asset.key!==item.key))
  }
  async function run(mode:'rules'|'ai') {
    if (operation.current) return
    if (!count) {setError('Füge zuerst ein Foto oder eine technische Unterlage hinzu.');return}
    if (mode==='ai' && (!aiAvailable || !consent)) {setError('Bitte die KI-Auswertung einschließlich Verbrauchskosten ausdrücklich bestätigen.');return}
    operation.current=true;setBusy(true);setError('')
    try {
      const uploaded=[...assets]
      for(const item of pending){
        setMessage('Unterlage speichern: '+item.file.name)
        const form=new FormData();form.set('file',item.file)
        if(input.projectId)form.set('projectId',input.projectId)
        if(input.folderId)form.set('folderId',input.folderId)
        const response=await readResponse(await fetch('/api/smart-check/upload',{method:'POST',body:form}))
        const asset=response.document as Asset
        if(!uploaded.some(existing=>existing.id===asset.id))uploaded.push(asset)
        setAssets([...uploaded]);removePending(item)
      }
      setMessage(mode==='ai'?'Aufnahmen auswerten und technische Hinweise prüfen …':'Unterlagen-Check erstellen – ohne Bildanalyse …')
      const payload={...input,title:input.title.trim()||('Smart Check · '+AREAS[input.area]),attachmentIds:uploaded.map(asset=>asset.id),mode,aiConsent:mode==='ai'&&consent}
      const data=await readResponse(await fetch('/api/smart-check/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})) as Report
      setReport(data);setInput({...data.input,mode:'rules',aiConsent:false,previousReportId:data.id});setConsent(false);setSelected([])
      setHistory(old=>[{id:data.id,display_name:data.input.title,version:data.version,created_at:data.result.createdAt},...old].slice(0,30))
      requestAnimationFrame(()=>resultPanel.current?.scrollIntoView({behavior:'smooth',block:'start'}))
    }catch(cause){setError(cause instanceof Error?cause.message:'Der Check konnte nicht abgeschlossen werden.')}
    finally{operation.current=false;setBusy(false);setMessage('')}
  }
  async function openReport(id:string){
    if(operation.current)return
    operation.current=true;setBusy(true);setError('')
    try{setReport(await readResponse(await fetch('/api/smart-check?id='+encodeURIComponent(id))));setSelected([]);requestAnimationFrame(()=>resultPanel.current?.scrollIntoView({behavior:'smooth',block:'start'}))}
    catch(cause){setError(cause instanceof Error?cause.message:'Bericht konnte nicht geladen werden.')}
    finally{operation.current=false;setBusy(false)}
  }
  function clearLocal(){urls.current.forEach(url=>URL.revokeObjectURL(url));urls.current.clear();setPending([])}
  function reset(){clearLocal();setInput(initial());setAssets([]);setReport(null);setSelected([]);setConsent(false);setError('');window.scrollTo({top:0,behavior:'smooth'})}
  const numberField=(key:'pvKwp'|'storageKwh'|'heatKw'|'heatElectricKw'|'heaterKw'|'wallboxKw',label:string)=><label className={s.field}>{label}<input type="number" min="0" max="100000" step="any" value={input[key]??''} placeholder="Nicht bekannt" disabled={busy} onChange={e=>update(key,e.target.value===''?null:Number(e.target.value))}/></label>
  const measures=report?.result.findings.filter(f=>f.offer)||[]
  const offerPayload=report?JSON.stringify({title:report.input.title,reportId:report.id,measures:measures.filter(f=>selected.includes(f.id)).slice(0,8).map(f=>(f.title+': '+f.action).slice(0,400))}):''
  const vision=report?.result.vision
  const critical=report?.result.findings.filter(f=>f.status==='red')||[]
  const criteria=report?(report.result.criteria||buildCabinetCriteria(report.input,report.result.vision,report.result.findings)):[]

  return <main className={s.workspace}><div className={s.container}>
    <header className={s.header}><Link href="/apps"><ArrowLeft size={18}/>EMA</Link><strong><ScanLine size={19}/>Smart Check</strong><Link href="/dms" aria-label="DMS öffnen"><FolderOpen size={19}/></Link></header>
    {!report?<>
      <section className={s.intro}><p className={s.eyebrow}>Fotografieren · Verstehen · Vorprüfen</p><h1>Zeig uns deine Anlage.</h1><p>Mit einem Foto starten. Technische Hinweise und nächste Schritte erhalten.</p></section>
      <section className={s.capture} aria-label="Aufnahmen hinzufügen">
        <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={e=>addFiles(e.target.files)}/>
        <input ref={files} type="file" accept="image/jpeg,image/png,application/pdf" multiple hidden onChange={e=>addFiles(e.target.files)}/>
        {!count?<div className={s.empty}><div className={s.scanFrame}><Camera size={42} strokeWidth={1.4}/></div><h2>Mit einem Foto starten</h2><p>Eine Übersicht und ein lesbares Typenschild helfen am meisten.</p><button type="button" className={s.primary} disabled={busy} onClick={()=>camera.current?.click()}><Camera size={19}/>Foto aufnehmen</button><button type="button" className={s.textButton} disabled={busy} onClick={()=>files.current?.click()}><ImagePlus size={17}/>Aus Fotos oder Dateien wählen</button></div>:<>
          <div className={s.heading}><h2>Deine Aufnahmen</h2><span>{count}/8</span></div>
          <div className={s.files}>{assets.map(asset=><div className={s.file} key={asset.id}>{asset.mime_type.startsWith('image/')?<img src={'/api/dms/documents/'+asset.id+'/open'} alt={asset.file_name}/>:<FileText size={34}/>}<span>{asset.file_name}</span><button type="button" disabled={busy} aria-label={asset.file_name+' entfernen'} onClick={()=>setAssets(old=>old.filter(item=>item.id!==asset.id))}><X size={15}/></button></div>)}{pending.map(asset=><div className={s.file} key={asset.key}>{asset.preview?<img src={asset.preview} alt={asset.file.name}/>:<FileText size={34}/>}<span>{asset.file.name}</span><button type="button" disabled={busy} aria-label={asset.file.name+' entfernen'} onClick={()=>removePending(asset)}><X size={15}/></button></div>)}</div>
          <div className={s.actions}><button type="button" className={s.secondary} disabled={busy||count>=8} onClick={()=>camera.current?.click()}><Camera size={17}/>Weiteres Foto</button><button type="button" className={s.secondary} disabled={busy||count>=8} onClick={()=>files.current?.click()}><ImagePlus size={17}/>Datei hinzufügen</button></div>
        </>}
        <details className={s.details}><summary>Diese sieben Kriterien prüft Smart Check</summary>{CABINET_CRITERIA.map(c=><p key={c.id}>{c.title}</p>)}</details><p className={s.hint}>Bis zu 8 Fotos oder PDFs. Keine Abdeckungen oder Plomben öffnen.</p>
      </section>
      {count>0?<section className={s.panel}>
        <h2>Worum geht es?</h2><div className={s.choices}>{Object.entries(AREAS).map(([key,label])=><button type="button" key={key} disabled={busy} aria-pressed={input.area===key} className={input.area===key?s.selected:s.choice} onClick={()=>update('area',key as CheckInput['area'])}>{label}</button>)}</div>
        <label className={s.field}>Was möchtest du wissen oder erweitern?<textarea value={input.notes} maxLength={2500} disabled={busy} onChange={e=>update('notes',e.target.value)} placeholder="Zum Beispiel: Kann ich hier PV, einen Speicher und eine Wärmepumpe anschließen?"/></label>
        <label className={s.field}>Dein Netzbetreiber<select value={OPERATORS.some(op=>op.name===input.operator)?input.operator:'other'} disabled={busy} onChange={e=>{update('operator',e.target.value==='other'?'':e.target.value);update('operatorConfirmed',false);update('operatorEvidence','')}}><option value="other">Noch nicht bekannt / anderer Betreiber</option>{OPERATORS.map(op=><option key={op.name}>{op.name}</option>)}</select></label>
        {!OPERATORS.some(op=>op.name===input.operator)?<label className={s.field}>Anderer Netzbetreiber (optional)<input value={input.operator} maxLength={120} disabled={busy} onChange={e=>update('operator',e.target.value)}/></label>:null}
        <p className={s.muted}>Die Auswahl allein bestätigt keine adressgenaue Zuständigkeit. Unbekannte lokale Vorgaben bleiben als offene Prüfung gekennzeichnet.</p>
        <details className={s.details}><summary>Technische Angaben ergänzen <span>optional</span></summary><p>Nur bekannte Werte eintragen. Fehlende Daten werden nicht geschätzt.</p><div className={s.grid}>{numberField('pvKwp','PV-Leistung (kWp)')}{numberField('storageKwh','Speicherkapazität (kWh)')}{numberField('heatKw','Wärmepumpe: Heizleistung (kW)')}{numberField('heatElectricKw','Wärmepumpe: max. elektrisch ohne Heizstab (kW)')}{numberField('heaterKw','Zusatzheizung / Heizstab (kW)')}{numberField('wallboxKw','Wallbox (kW)')}</div></details>
        <details className={s.details}><summary>Einen konkreten Sicherheitsverdacht melden</summary><p>Zum Beispiel sichtbare Schmorstellen oder eine beschädigte Abdeckung. Anlage nicht öffnen oder berühren.</p><label className={s.field}>Beobachtung<textarea value={input.hazardEvidence} maxLength={400} disabled={busy} onChange={e=>{update('hazardEvidence',e.target.value);update('hazard',e.target.value.trim().length>0)}}/></label></details>
        <div className={s.analyze}>
          <h3>{loading?'KI-Verfügbarkeit wird geprüft …':aiAvailable?'Aufnahmen technisch auswerten':'KI-Anbindung momentan nicht verfügbar'}</h3>
          <p>{aiAvailable?'Verwendet die vorhandene OpenAI-Anbindung. Bilder und auslesbare PDF-Texte werden ausgewertet. Unlesbare Stellen bleiben offen.':'Ohne erreichbare KI-Schnittstelle wird keine Bildauswertung behauptet.'}</p>
          {aiAvailable?<label className={s.check}><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/>Ich beauftrage diese Analyse und bestätige die Datenübertragung sowie verbrauchsabhängige API-Kosten.</label>:null}
          <button type="button" className={s.primary} disabled={busy||loading||!aiAvailable||!consent} onClick={()=>run('ai')}><ScanLine size={19}/>Aufnahmen analysieren<ChevronRight size={18}/></button>
          <details className={s.fallback}><summary>Ohne KI einen Unterlagen-Check erstellen</summary><p>Prüft nur deine Angaben. Fotos und Typenschilder werden dabei nicht inhaltlich ausgewertet.</p><button type="button" className={s.secondary} disabled={busy||loading} onClick={()=>run('rules')}>Unterlagen-Check starten</button></details>
        </div>
      </section>:<p className={s.localHint}>Die Aufnahmen bleiben zunächst auf deinem Gerät. Erst beim Start des Checks werden sie hochgeladen und privat im DMS gespeichert.</p>}
    </>:null}
    {busy?<p role="status" className={s.notice}>{message||'Bericht laden …'}</p>:null}{error?<p role="alert" className={s.error}>{error}</p>:null}
    {report?<section className={s.panel} ref={resultPanel} style={{scrollMarginTop:20}}>
      <p className={s.eyebrow}>{vision?'Technische Vorprüfung':'Unterlagen-Check · ohne Bildanalyse'} · Version {report.version}</p>
      <div className={report.result.status==='red'?s.redLight:report.result.status==='yellow'?s.yellowLight:s.greyLight} role="img" aria-label={report.result.status==='red'?'Roter Prüfstatus':report.result.status==='yellow'?'Anpassung prüfen':'Grauer Prüfstatus'}>{report.result.status==='red'?'!':'?'}</div><h1 className={s.resultTitle}>{report.result.status==='red'?'Fachprüfung erforderlich':report.result.status==='yellow'?'Anpassung prüfen':'Noch nicht beurteilbar'}</h1>
      <p className={report.result.status==='red'?s.red:s.badge}>{report.result.decision}</p>
      <div className={s.criteriaList}>{criteria.map(c=><details key={c.id} className={s.criterion}><summary><span className={c.status==='red'?s.dotRed:c.status==='yellow'?s.dotYellow:s.dotGrey}/><strong>{c.title}</strong><span>{c.status==='red'?'Verdacht':c.status==='yellow'?'Prüfen':c.observationState==='observed'?'Erkannt':'Offen'}</span></summary><p>{c.summary}</p><p><strong>Beleg:</strong> {c.evidence}</p><p><strong>Nächster Schritt:</strong> {c.nextStep}</p></details>)}</div>
      <p className={s.muted}>Grün erst nach ausreichenden geprüften Nachweisen. Ein Foto allein bestätigt weder EVU-Konformität noch eine Abnahme.</p>
      <details className={s.details}><summary>Ausführliche Befunde & Quellen anzeigen</summary>
      {!vision?<p className={s.notice}>Die Fotos wurden zugeordnet, aber nicht inhaltlich analysiert. Diese Hinweise beruhen auf deinen Angaben und fehlenden Nachweisen.</p>:null}
      {critical.map(f=><article className={s.critical} key={f.id}><ShieldAlert size={21}/><div><h3>{f.title}</h3><p>{f.detail}</p><p><strong>Jetzt:</strong> {f.action}</p><small>{f.basis}</small></div></article>)}
      {vision?<section className={s.resultSection}><h2>Was ist erkennbar?</h2>{vision.components.length?vision.components.map((c,i)=><article className={s.component} key={i}><strong>{c.name}</strong><p>{c.manufacturer||'Hersteller nicht lesbar'} · {c.model||'Modell nicht lesbar'}</p><small>{c.evidence} · {c.certainty}</small></article>):<p>Keine Komponente zuverlässig identifiziert.</p>}{vision.observations.map((item,i)=><p key={i}>{item}</p>)}<p className={s.muted}>Automatisch erkannt, noch fachlich zu bestätigen.</p></section>:null}
      <section className={s.resultSection}><h2>Was fehlt für eine belastbare Aussage?</h2>{vision?.missing.map((item,i)=><p key={i}>{item}</p>)}{report.result.findings.filter(f=>f.status==='grey'&&f.id!=='image').map(f=><details className={s.details} key={f.id}><summary>{f.title}</summary><p>{f.detail}</p><p><strong>Benötigt:</strong> {f.action}</p></details>)}</section>
      <section className={s.resultSection}><h2>Was ist der nächste Schritt?</h2>{report.result.findings.filter(f=>f.status==='yellow').map(f=><article className={s.component} key={f.id}><h3>{f.title}</h3><p>{f.action}</p><small>{f.basis}</small></article>)}{report.result.alternatives.map((item,i)=><p key={i}>{item}</p>)}<p className={s.muted}>Mögliche Prüf- und Planungswege. Daraus folgt noch keine bestätigte Nachrüstpflicht.</p></section>
      <details className={s.details}><summary>Netzbetreiber, Quellen und Prüfgrenzen</summary><p>Netzbetreiber: {report.input.operator||'Noch nicht bekannt'}. Zuständigkeit und Anwendbarkeit bleiben projektbezogen zu prüfen.</p>{report.result.sourceReview?<><p>Quellenabruf: {report.result.sourceReview.status} · {new Date(report.result.sourceReview.checkedAt).toLocaleString('de-DE')}</p><p>{report.result.sourceReview.limitation}</p>{report.result.sourceReview.documents.map(d=><p key={d.url}><a href={d.url} target="_blank" rel="noopener noreferrer">{d.title} ↗</a></p>)}</>:null}{report.result.sources.map(source=><div className={s.source} key={source.id}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a><br/>{source.version}<br/>{source.locator}<br/>{source.scope}</div>)}{report.result.limitations.map(item=><p key={item}>{item}</p>)}{vision?.limitations.map((item,i)=><p key={i}>{item}</p>)}{vision?.pdfTextStatus.map((item,i)=><p key={i}>{item}</p>)}{vision?<p>Rechnerische API-Kosten: ca. {vision.usage.estimatedUsd.toFixed(4)} USD; tatsächliche Abrechnung beim Anbieter.</p>:null}</details>
      </details>
      <div className={s.actions}><a className={s.primary} href={'/api/dms/documents/'+report.id+'/open'} target="_blank" rel="noopener noreferrer"><FileText size={18}/>PDF-Bericht öffnen</a><Link className={s.secondary} href="/dms"><FolderOpen size={18}/>DMS</Link></div>
      <details className={s.details}><summary>Maßnahmen für ein Angebot auswählen</summary><p>Erst fachlich prüfen, dann Leistungsumfang und Preise im Office-Entwurf ergänzen.</p>{measures.map(f=><label className={s.check} key={f.id}><input type="checkbox" checked={selected.includes(f.id)} onChange={e=>setSelected(old=>e.target.checked?[...old,f.id].slice(0,8):old.filter(id=>id!==f.id))}/>{f.title}</label>)}{selected.length?<a className={s.secondary} href={officePreparationUrl+'?data='+encodeURIComponent(offerPayload)}>Angebot vorbereiten<ArrowUpRight size={16}/></a>:null}</details>
      <div className={s.actions}><button type="button" className={s.primary} disabled={busy} onClick={()=>{clearLocal();setInput({...report.input,mode:'rules',aiConsent:false,previousReportId:report.id});setAssets(report.attachments);setConsent(false);setReport(null);window.scrollTo({top:0,behavior:'smooth'})}}>Unterlagen ergänzen & erneut prüfen</button><button type="button" className={s.secondary} disabled={busy} onClick={reset}>Neuer Check</button></div>
    </section>:null}
    {!report&&!count?<details className={s.historyPanel}><summary><History size={17}/>Bisherige Checks<ChevronRight size={16}/></summary>{loading?<p>Wird geladen …</p>:history.length?history.slice(0,10).map(item=><div className={s.history} key={item.id}><div>{item.display_name}<small>Version {item.version} · {new Date(item.created_at).toLocaleDateString('de-DE')}</small></div><button type="button" disabled={busy} onClick={()=>openReport(item.id)}>Öffnen ↗</button></div>):<p className={s.muted}>Hier findest du später deine gespeicherten Checks.</p>}</details>:null}
    <footer className={s.footer}><ShieldAlert size={14}/>Technische Vorprüfung. Keine Sicherheitsfreigabe oder Abnahme.</footer>
  </div></main>
}
