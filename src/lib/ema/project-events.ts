import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { mailboxAccess, type MailSession } from '../mail/server';
import { mailboxRoot } from '../mail/model';
import { MailError, mailGraph } from '../mail/graph';
import { visibleProject } from '../mail/extensions';
import { EVENT_TITLE_EXPAND, personalEventTitle } from '../mail/event-title';

export const EVENT_PROJECT_PROPERTY='String {f057e11b-f0ac-48af-8fd7-d1efbba98d90} Name EMAProjectId';
const expand=`singleValueExtendedProperties($filter=id eq '${EVENT_PROJECT_PROPERTY}')`;
const reply=(data:unknown)=>NextResponse.json(data,{headers:{'Cache-Control':'private, no-store'}});
export async function projectEventsEndpoint(request:NextRequest,action:string,input:Record<string,unknown>,session:MailSession){
  if(!['project-options','event-project','project-events'].includes(action))return null;
  const post=request.method==='POST';
  if(action==='project-options'){
    if(post)throw new MailError(405,'Nur Lesen erlaubt.');
    const {data,error}=await session.db.from('projects').select('id,project_name').eq('user_id',session.user.id).eq('is_archived',false).order('project_name').limit(500);
    if(error)throw new MailError(503,'Projekte konnten nicht geladen werden.');
    return reply({projects:data||[]});
  }
  if(action==='project-events'){
    if(post)throw new MailError(405,'Nur Lesen erlaubt.');
    const project=await visibleProject(session,request.nextUrl.searchParams.get('projectId'));
    const {token}=await mailboxAccess(session,'me');
    const params=new URLSearchParams({$filter:`singleValueExtendedProperties/Any(ep: ep/id eq '${EVENT_PROJECT_PROPERTY}' and ep/value eq '${project.id}')`,$expand:EVENT_TITLE_EXPAND,$select:'id,subject,start,end,isCancelled,responseStatus,type',$top:'100'});
    const data=await mailGraph<{value:{id:string;subject:string;start:{dateTime:string};end:{dateTime:string};isCancelled?:boolean;responseStatus?:{response:string};singleValueExtendedProperties?:{id:string;value:string}[]}[];'@odata.nextLink'?:string}>(token,`/me/events?${params}`);
    return reply({events:(data.value||[]).map(personalEventTitle).filter(e=>!e.isCancelled&&e.responseStatus?.response!=='declined'),more:Boolean(data['@odata.nextLink'])});
  }
  const id=z.string().min(1).max(1500).parse(post?input.id:request.nextUrl.searchParams.get('id'));
  const {mailbox,token}=await mailboxAccess(session,post?input.mailbox:request.nextUrl.searchParams.get('mailbox')||'me',post?'write':'read');
  const path=`${mailboxRoot(mailbox)}/events/${encodeURIComponent(id)}`;
  if(!post){
    const event=await mailGraph<{singleValueExtendedProperties?:{id:string;value:string}[]}>(token,`${path}?$select=id&$expand=${encodeURIComponent(expand)}`);
    const value=event.singleValueExtendedProperties?.find(p=>p.id===EVENT_PROJECT_PROPERTY)?.value;
    if(!value)return reply({projectId:null});
    try{const project=await visibleProject(session,value);return reply({projectId:project.id});}catch{return reply({projectId:null});}
  }
  if(input.confirmed!==true)throw new MailError(409,'Bitte die Projektzuordnung bestätigen.');
  const project=input.projectId?await visibleProject(session,input.projectId):null;
  await mailGraph(token,path,{method:'PATCH',body:JSON.stringify({singleValueExtendedProperties:[{id:EVENT_PROJECT_PROPERTY,value:project?.id||''}]})});
  return reply({ok:true,projectId:project?.id||null});
}
