import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import * as nodeModule from 'node:module'
import {createHash} from 'node:crypto'
import {z} from 'zod'
import {EWR_DOCUMENT} from '../src/lib/smart-check/ewr-rules'
import {photoCoverage} from '../src/lib/smart-check/evidence'
import {CABINET_CRITERIA,PV_CHECK_TASK} from '../src/lib/smart-check/criteria'
import {operatorFinding,presentFindings,nextCheckSteps} from '../src/lib/smart-check/operator'
import {inputSchema,assess,sourcesFor} from '../src/lib/smart-check/model'
import {discoverOfficialLinks,reviewOfficialSources,reviewEwrDocument} from '../src/lib/smart-check/source-review'
// Runtime is Node 24; this repository deliberately still uses Node 20 type declarations.
const {stripTypeScriptTypes}=nodeModule as unknown as {stripTypeScriptTypes:(source:string)=>string}
const base={title:'Testanlage Worms',address:'Teststraße 1, 67547 Worms',area:'cabinet',operator:'EWR Netz'}
test('official document discovery rejects external, script and credential URLs',()=>{
 const html='<a href="/tab.pdf">TAB Strom</a><a href="https://evil.example/">TAB</a><a href="javascript:alert(1)">TAB</a><a href="https://user:secret@www.ewr-netz.de/tab">TAB</a><a href="/mess.pdf"><b>Messkonzepte</b></a>';
 assert.deepEqual(discoverOfficialLinks(html,'https://www.ewr-netz.de/partner/').map(d=>d.url),['https://www.ewr-netz.de/tab.pdf','https://www.ewr-netz.de/mess.pdf']);
});
test('publisher retrieval documents provenance but never claims local applicability',async()=>{
 let calls=0;
 const fetcher=(async()=>{calls++;return new Response('<a href="/tab.pdf">TAB Strom</a>',{headers:{'content-type':'text/html'}})}) as typeof fetch;
 const known=await reviewOfficialSources('EWR Netz',fetcher);
 assert.equal(known.status,'retrieved');assert.equal(known.sha256?.length,64);assert.match(known.limitation,/nicht inhaltlich verifiziert/);
 assert.equal((await reviewOfficialSources('Unknown',fetcher)).status,'unconfigured');assert.equal(calls,1);
 assert.equal((await reviewOfficialSources('EWR Netz',(async()=>{throw new Error('timeout')}) as typeof fetch)).status,'unavailable');
});
test('a photo or even affirmative component declarations cannot produce a green release',()=>{const input=inputSchema.parse({...base,attachmentIds:['11111111-1111-4111-8111-111111111111'],sls:'yes',spd:'yes',apz:'yes',rfz:'yes',measurementProof:true,operatorConfirmed:true,operatorEvidence:'Netzanschlussvertrag',rulesConfirmed:true,ruleVersion:'TAB',ruleLocator:'Seite 7'});const report=assess(input);assert.equal(report.status,'grey');assert.ok(report.findings.some(f=>f.id==='rules'&&f.status==='grey'));assert.ok(report.findings.some(f=>f.id==='image'));});
test('thermal heat output never triggers an electrical 14a threshold',()=>{const report=assess(inputSchema.parse({...base,heatKw:12}));assert.ok(report.findings.some(f=>f.id==='hp-electric'));assert.equal(report.findings.some(f=>f.id==='hp14a'),false);const known=assess(inputSchema.parse({...base,heatKw:12,heatElectricKw:3,heaterKw:6}));assert.ok(known.findings.some(f=>f.id==='hp14a'));});
test('PV with battery and wallbox checks remain distinct and measured in appropriate units',()=>{const r=assess(inputSchema.parse({...base,pvKwp:10,storageKwh:10,wallboxKw:11}));for(const id of ['pv','storage','wallbox'])assert.ok(r.findings.some(f=>f.id===id));assert.ok(r.findings.find(f=>f.id==='storage')!.detail.includes('kWh'));});
test('postal address or a checkbox alone cannot prove network operator assignment',()=>{const r=assess(inputSchema.parse({...base,operatorConfirmed:true}));assert.ok(r.findings.some(f=>f.id==='operator'));});
test('critical indications take precedence without being stated as an established defect',()=>{const r=assess(inputSchema.parse({...base,hazard:true,hazardEvidence:'Verfärbungen laut Foto 1'}));assert.equal(r.status,'red');assert.match(r.findings[0].basis,/Verdacht/);assert.match(r.findings[0].action,/nicht öffnen/);});
test('AI cost/data consent, finite powers and documented hazards are validated',()=>{assert.equal(inputSchema.safeParse({...base,mode:'ai',aiConsent:false}).success,false);assert.equal(inputSchema.safeParse({...base,pvKwp:Infinity}).success,false);assert.equal(inputSchema.safeParse({...base,hazard:true}).success,false);assert.equal(inputSchema.safeParse({...base,attachmentIds:Array(9).fill('11111111-1111-4111-8111-111111111111')}).success,false);});
test('unconfigured operators receive no fabricated local requirements',()=>{const sources=sourcesFor('Unbekannt Netz');assert.equal(sources.some(s=>s.id==='operator'),false);const r=assess(inputSchema.parse({...base,operator:'Unbekannt Netz'}));assert.ok(r.findings.some(f=>f.id==='rules'&&f.status==='grey'));});
test('2026 TAR source versions and EWR publication dates remain explicit',()=>{const s=sourcesFor('EWR Netz');assert.match(s.find(x=>x.id==='tar4100')!.version,/2026-04/);assert.match(s.find(x=>x.id==='tar4105')!.version,/2026-03/);assert.match(s.find(x=>x.id==='operator')!.version,/2025/);});
function serverFixture({authenticated=true,active=true,role='admin',mfa=false,foreign=false}={}){
 const calls:any[]=[];const builder:any={select(){return this},eq(key:string,value:any){calls.push({key,value});return this},async maybeSingle(){return {data:foreign?null:{id:'project-a',role,is_active:active}}}};
 const supabase={auth:{async getUser(){return {data:{user:authenticated?{id:'user-a'}:null}}},mfa:{async getAuthenticatorAssuranceLevel(){return {data:{nextLevel:mfa?'aal2':'aal1',currentLevel:'aal1'}}}}},from(table:string){calls.push({table});return builder}};
 const source=readFileSync('src/lib/smart-check/server.ts','utf8').replace(/^import .*\n/gm,'').replaceAll('export ','');
 const api=new Function('createHash','createClient',stripTypeScriptTypes(source)+';return {checkContext,assertProject,assertFolder,sameOrigin,validateFile};')(createHash,async()=>supabase);
 return {api,calls,supabase};
}
test('anonymous, suspended, partner and incomplete-MFA accounts are denied',async()=>{for(const options of [{authenticated:false},{active:false},{role:'partner'},{mfa:true}])await assert.rejects(serverFixture(options).api.checkContext());const f=serverFixture();assert.equal((await f.api.checkContext()).user.id,'user-a');});
test('project/folder references are owner scoped and unavailable references are denied',async()=>{const f=serverFixture();await f.api.assertProject(f.supabase,'user-a','project-a');assert.ok(f.calls.some(c=>c.key==='user_id'&&c.value==='user-a'));const bad=serverFixture({foreign:true});await assert.rejects(bad.api.assertFolder(bad.supabase,'user-a','folder-b'));});
test('same-origin and file content/size guards reject hostile input',()=>{const {api}=serverFixture();assert.throws(()=>api.sameOrigin(new Request('https://app.example/api',{headers:{origin:'https://other.example'}})));assert.throws(()=>api.validateFile('application/pdf',Buffer.from('not-pdf')));assert.throws(()=>api.validateFile('application/pdf',Buffer.from('%PDF-1.7\n/OpenAction /JavaScript')));assert.throws(()=>api.validateFile('image/png',Buffer.alloc(3*1024*1024+1)));assert.doesNotThrow(()=>api.validateFile('application/pdf',Buffer.from('%PDF-1.7\n1 0 obj <<>> endobj')));});

function visionFixture(options:{disabled?:boolean;key?:boolean;fail?:boolean}={}) {
 const calls:any[]=[];
 const response:any={components:[{name:'SLS',manufacturer:'',model:'',evidenceFileId:'image-a',evidence:'Linke Bildhälfte',certainty:'unsicher'},{name:'Invented',manufacturer:'',model:'',evidenceFileId:'not-provided',evidence:'unbekannt',certainty:'unsicher'}],observations:['Typenschild nicht lesbar.'],risks:[],missing:['Scharfes Typenschildfoto'],limitations:['Keine Messwerte']};
 const fetcher=async(url:string,init:any)=>{calls.push({url,body:JSON.parse(init.body)});return options.fail?new Response('',{status:502}):Response.json({choices:[{message:{content:JSON.stringify(response)}}],usage:{prompt_tokens:100,completion_tokens:40}})};
 const source=readFileSync('src/lib/smart-check/vision.ts','utf8').replace(/^import .*\n/gm,'').replaceAll('export ','');
 const fn=new Function('z','createHash','CheckError','process','fetch','CABINET_CRITERIA','PV_CHECK_TASK',stripTypeScriptTypes(source)+';return analyzeVision;')(z,createHash,Error,{env:{OPENAI_API_KEY:options.key===false?'':'test-only',SMART_CHECK_AI_ENABLED:options.disabled?'false':undefined}},fetcher,CABINET_CRITERIA,PV_CHECK_TASK);
 const files=[{id:'image-a',file_name:'test.jpg',mime_type:'image/jpeg',bytes:new Uint8Array([255,216,255,217])}];
 return {calls,fn,files,response};
}
test('existing API can analyze only an explicitly consented request; no real provider call',async()=>{
 const f=visionFixture();const input=inputSchema.parse({...base,mode:'ai',aiConsent:true});const result=await f.fn(input,f.files,'test-user');
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].body.store,false);assert.equal(f.calls[0].body.messages[0].role,'system');assert.equal(result.components.length,1);assert.equal(result.components[0].name,'SLS');assert.equal(result.usage.input,100);
});
test('missing consent, administrative disable and missing key prevent any provider request',async()=>{
 for(const options of [{disabled:true},{key:false},{}]){const f=visionFixture(options);const input={...inputSchema.parse(base),mode:'ai',aiConsent:options.disabled||options.key===false};await assert.rejects(f.fn(input,f.files,'test-user'));assert.equal(f.calls.length,0)}
});
test('provider failures never become a successful visual assessment',async()=>{
 const f=visionFixture({fail:true});await assert.rejects(f.fn(inputSchema.parse({...base,mode:'ai',aiConsent:true}),f.files,'test-user'));assert.equal(f.calls.length,1);
});

test('seven cabinet criteria remain explicit without false EVU or acceptance confirmation',()=>{
 const input=inputSchema.parse({...base,operatorConfirmed:true,operatorEvidence:'Anschlussunterlagen',rulesConfirmed:true,ruleVersion:'TAB',ruleLocator:'Seite 7',sls:'yes',spd:'yes',apz:'yes',rfz:'yes',measurementProof:true});
 const report=assess(input);assert.equal(report.criteria?.length,7);
 for(const id of ['evu','acceptance'])assert.equal(report.criteria?.find(c=>c.id===id)?.status,'grey');
 assert.match(report.criteria!.find(c=>c.id==='evu')!.summary,/nicht bestätigt/);
});
test('older equipment triggers clarification rather than automatic replacement or red risk',()=>{
 const vision:any={components:[],observations:[],risks:[],missing:[],limitations:[],criteria:[{id:'legacy',state:'concern',detail:'Ältere Bauform laut Typenschild',evidenceFileId:'image-a',evidence:'Bild 1: Typenschild',missing:'Herstellernachweis'}]};
 const report=assess(inputSchema.parse(base),vision),legacy=report.criteria!.find(c=>c.id==='legacy')!;
 assert.equal(legacy.status,'yellow');assert.match(legacy.nextStep,/allein begründen keinen Austausch/);assert.notEqual(report.status,'red');
});
test('unseen protection is unknown; declared absence is not an automatic retrofit order',()=>{
 const unknown=assess(inputSchema.parse(base)).criteria!.find(c=>c.id==='protection')!;assert.equal(unknown.status,'grey');
 const absent=assess(inputSchema.parse({...base,sls:'no'})).criteria!.find(c=>c.id==='protection')!;assert.equal(absent.status,'yellow');assert.match(absent.nextStep,/Prüfen, ob/);
});

test('criterion observations require a real attached file; all seven requested scopes are prompted',async()=>{
 const f=visionFixture();f.response.criteria=[{id:'space',state:'observed',detail:'Reserveplatz erkennbar',evidenceFileId:'image-a',evidence:'Rechter Bildbereich',missing:'Maßnachweis'},{id:'protection',state:'concern',detail:'Unbelegter Befund',evidenceFileId:'invented',evidence:'Angeblicher Beleg',missing:'Nachweis'}];
 const result=await f.fn(inputSchema.parse({...base,mode:'ai',aiConsent:true}),f.files,'test-user');
 assert.equal(result.criteria.length,1);assert.equal(result.criteria[0].id,'space');assert.match(result.criteria[0].evidence,/test.jpg/);
 for(const criterion of CABINET_CRITERIA)assert.ok(f.calls[0].body.messages[0].content.includes(criterion.title));
});

test('selected operator is acknowledged separately from unverified local compliance',()=>{
 const input=inputSchema.parse({...base,address:''}),report=assess(input),f=report.findings.find(f=>f.id==='operator')!;
 assert.equal(f.title,'EWR Netz – vom Nutzer angegeben');assert.equal(f.status,'grey');assert.match(f.detail,/nicht unabhängig geprüft/);
 assert.equal(nextCheckSteps(input,report.findings).some(f=>f.id==='operator'),false);
 assert.equal(report.findings.find(f=>f.id==='rules')!.status,'grey');
 const unknown=inputSchema.parse({...base,operator:''});assert.equal(operatorFinding(unknown)!.title,'Netzbetreiber auswählen');
 assert.ok(nextCheckSteps(unknown,assess(unknown).findings).some(f=>f.id==='operator'));
});
test('saved reports retain individual severity and prioritize actual risk over open evidence',()=>{
 const input=inputSchema.parse(base),old=assess(input).findings.map(f=>f.id==='operator'?{...f,title:'Netzbetreiber nicht nachgewiesen'}:f);
 const risk={id:'risk',status:'red' as const,title:'Sicherheitsverdacht',detail:'Bildbeleg',action:'Fachprüfung des konkreten Verdachts',basis:'Bild',sourceIds:[],offer:false};
 const shown=presentFindings(input,[...old,risk]),steps=nextCheckSteps(input,shown);
 assert.equal(old.find(f=>f.id==='operator')!.title,'Netzbetreiber nicht nachgewiesen');
 assert.equal(shown.find(f=>f.id==='operator')!.title,'EWR Netz – vom Nutzer angegeben');
 assert.equal(steps.length,3);assert.equal(steps[0].status,'red');assert.equal(steps[1].status,'grey');assert.equal(steps[2].status,'grey');
});

const imageId='11111111-1111-4111-8111-111111111111'
const otherId='22222222-2222-4222-8222-222222222222'
test('capture assignments reject foreign files and duplicate claims for one image',()=>{
 assert.equal(inputSchema.safeParse({...base,attachmentEvidence:[{fileId:imageId,kind:'overview'}]}).success,false);
 assert.equal(inputSchema.safeParse({...base,attachmentIds:[imageId],attachmentEvidence:[{fileId:imageId,kind:'overview'},{fileId:imageId,kind:'protection'}]}).success,false);
});
test('assigned images are not treated as quality-reviewed or as proof of a component',()=>{
 const input=inputSchema.parse({...base,attachmentIds:[imageId],attachmentEvidence:[{fileId:imageId,kind:'overview'}]});
 assert.equal(photoCoverage(input)[0].state,'assigned');
 const report=assess(input);assert.equal(report.status,'grey');
 assert.ok(report.findings.some(f=>f.id==='photo-protection'));
 assert.equal(report.criteria!.find(c=>c.id==='protection')!.status,'grey');
});
test('legacy reports without assignments remain readable and require no migration',()=>{
 const input=inputSchema.parse(base);const {attachmentEvidence,...old}=input;
 assert.deepEqual(input.attachmentEvidence,[]);assert.equal(photoCoverage(old as typeof input).every(task=>task.state==='missing'),true);
});
test('one usable assigned view does not erase a missing view or produce a release',()=>{
 const input=inputSchema.parse({...base,attachmentIds:[imageId,otherId],attachmentEvidence:[{fileId:imageId,kind:'overview'},{fileId:otherId,kind:'nameplate'}]});
 const vision:any={photoQuality:[{fileId:imageId,state:'usable',reason:'Schrank vollständig erkennbar'},{fileId:otherId,state:'retake',reason:'Typenschild unscharf'}],components:[],risks:[]};
 const views=photoCoverage(input,vision);assert.equal(views[0].state,'reviewed');assert.equal(views[3].state,'retake');assert.equal(views[2].state,'missing');
 const report=assess(input,vision);assert.equal(report.status,'grey');assert.ok(report.findings.some(f=>f.id==='photo-nameplate'&&f.status==='grey'));
});
test('a replacement usable view resolves a retake request for that view only',()=>{
 const input=inputSchema.parse({...base,attachmentIds:[imageId,otherId],attachmentEvidence:[{fileId:imageId,kind:'nameplate'},{fileId:otherId,kind:'nameplate'}]});
 const vision:any={photoQuality:[{fileId:imageId,state:'retake'},{fileId:otherId,state:'usable'}]};
 assert.equal(photoCoverage(input,vision)[3].state,'reviewed');
});
test('missing location stays explicit even when an operator is selected',()=>{
 const report=assess(inputSchema.parse({...base,address:''}));assert.ok(report.findings.some(f=>f.id==='location'));assert.equal(report.status,'grey');
});
test('unreadable images cannot identify components; concrete safety suspicions remain visible',async()=>{
 const f=visionFixture();f.response.photoQuality=[{fileId:'image-a',state:'retake',reason:'Schrift unscharf'},{fileId:'foreign',state:'usable',reason:'invented'}];
 f.response.criteria=[{id:'protection',state:'observed',detail:'SLS erkannt',evidenceFileId:'image-a',evidence:'Linkes Feld',missing:''}];
 f.response.risks=[{detail:'Mögliche Schmorstelle',evidenceFileId:'image-a',evidence:'Unterer Bildbereich'}];
 const result=await f.fn(inputSchema.parse({...base,mode:'ai',aiConsent:true}),f.files,'test-user');
 assert.equal(result.photoQuality.length,1);assert.equal(result.components.length,0);assert.equal(result.criteria[0].state,'unknown');assert.equal(result.risks.length,1);
});
test('criterion evidence retains the original file identity for direct inspection',()=>{
 const vision:any={components:[],risks:[],criteria:[{id:'space',state:'observed',detail:'Reserve sichtbar',evidenceFileId:imageId,evidence:'Rechtes Feld',missing:'Maße'}]};
 assert.equal(assess(inputSchema.parse({...base,attachmentIds:[imageId]}),vision).criteria!.find(c=>c.id==='space')!.evidenceFileId,imageId);
});

const ewrInput=()=>inputSchema.parse({...base,operatorConfirmed:true,operatorEvidence:'Netzanschlussvertrag für Teststandort',pvKwp:10});
const reviewedEwr=(status:'matched'|'changed'|'unavailable'|'not-listed'):import('../src/lib/smart-check/source-review').SourceReview=>({status:'retrieved',publisherUrl:'https://www.ewr-netz.de/partner/installateure/formulare-und-richtlinien/',sha256:null,checkedAt:'2026-10-27T00:00:00Z',documents:[],limitation:'Testzustand; keine Fachfreigabe',ruleDocument:{status,url:EWR_DOCUMENT.url,sha256:status==='matched'?EWR_DOCUMENT.sha256:null,expectedSha256:EWR_DOCUMENT.sha256,checkedAt:'2026-10-27T00:00:00Z'}});
test('EWR rules require confirmed assignment and an unchanged officially listed document',()=>{
 for(const status of ['changed','unavailable','not-listed'] as const){const report=assess(ewrInput(),null,reviewedEwr(status));assert.ok(report.findings.some(f=>f.id==='ewr-document'));assert.equal(report.findings.some(f=>f.id==='ewr-duty'),false)}
 const unconfirmed=assess(inputSchema.parse(base),null,reviewedEwr('matched'));assert.ok(unconfirmed.findings.some(f=>f.id==='ewr-scope'));assert.equal(unconfirmed.findings.some(f=>f.id==='ewr-duty'),false);
 const other=assess(inputSchema.parse({...base,operator:'Westnetz'}),null,reviewedEwr('matched'));assert.equal(other.findings.some(f=>f.id.startsWith('ewr-')),false);
});
test('verified EWR document adds page-specific checks without approving the installation',()=>{
 const report=assess(ewrInput(),null,reviewedEwr('matched'));assert.equal(report.status,'grey');
 for(const id of ['ewr-change','ewr-duty','ewr-process'])assert.ok(report.findings.some(f=>f.id===id));
 assert.match(report.sources.find(s=>s.id==='ewr-duty')!.url,/#page=70$/);
 assert.match(report.findings.find(f=>f.id==='ewr-change')!.detail,/nicht pauschal/);
 assert.equal(report.criteria!.find(c=>c.id==='evu')!.status,'grey');
});
test('EWR disconnect requirement distinguishes new meters from unspecified existing changes',()=>{
 const confirmed=ewrInput(),source=reviewedEwr('matched');
 const existing=assess({...confirmed,meteringChange:'existing_extension',postMeterDisconnect:'no'},null,source);assert.equal(existing.findings.find(f=>f.id==='ewr-disconnect')!.status,'grey');
 const missing=assess({...confirmed,meteringChange:'new_meter_or_position',postMeterDisconnect:'no'},null,source);assert.equal(missing.findings.find(f=>f.id==='ewr-disconnect')!.status,'yellow');
 assert.match(missing.sources.find(s=>s.id==='ewr-disconnect')!.locator,/71/);
 const declared=assess({...confirmed,meteringChange:'new_meter_or_position',postMeterDisconnect:'yes'},null,source);assert.equal(declared.findings.find(f=>f.id==='ewr-disconnect')!.status,'grey');
});
test('EWR table guidance requires a declared construction type, never inferred equipment age',()=>{
 const source=reviewedEwr('matched'),input=ewrInput();
 assert.equal(assess({...input,building:'Altbau 1960'},null,source).findings.find(f=>f.id==='ewr-table')!.status,'grey');
 assert.equal(assess({...input,meterBoardType:'din43853'},null,source).findings.find(f=>f.id==='ewr-table')!.status,'yellow');
 assert.equal(assess({...input,meterBoardType:'cabinet'},null,source).findings.some(f=>f.id==='ewr-table'),false);
});
test('document checking never follows user URLs or silently accepts changed PDF bytes',async()=>{
 let calls=0;const fetcher=(async(url:string)=>{calls++;assert.equal(url,EWR_DOCUMENT.url);return new Response('%PDF-1.7\nchanged test document',{headers:{'content-type':'application/pdf'}})}) as typeof fetch;
 assert.equal((await reviewEwrDocument([{url:'https://evil.example/tab.pdf'}],fetcher)).status,'not-listed');assert.equal(calls,0);
 const changed=await reviewEwrDocument([{url:EWR_DOCUMENT.url}],fetcher);assert.equal(changed.status,'changed');assert.equal(changed.sha256?.length,64);assert.equal(calls,1);
});
test('PDF provenance rejects HTML, wrong signatures, oversized bodies and failed retrieval',async()=>{
 for(const response of [new Response('<html>Login</html>',{headers:{'content-type':'text/html'}}),new Response('not a pdf',{headers:{'content-type':'application/pdf'}}),new Response(Buffer.alloc(3*1024*1024+1),{headers:{'content-type':'application/pdf'}})]){
  assert.equal((await reviewEwrDocument([{url:EWR_DOCUMENT.url}],(async()=>response) as typeof fetch)).status,'unavailable');
 }
 assert.equal((await reviewEwrDocument([{url:EWR_DOCUMENT.url}],(async()=>{throw new Error('timeout')}) as typeof fetch)).status,'unavailable');
});
test('photo evidence requests stay actionable alongside general EWR planning checks',()=>{
 const input=ewrInput(),report=assess(input,null,reviewedEwr('matched'));
 assert.ok(nextCheckSteps(input,report.findings).some(f=>f.id==='photo-overview'));
});
