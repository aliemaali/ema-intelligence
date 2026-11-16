import type {NameContact} from '../mail/contact-names';
export type DirectoryContact = NameContact & {id:string;companyName?:string;businessPhones?:string[];officeHref?:string;readOnly?:boolean;canDelete?:boolean};
export async function officeDirectory(signal:AbortSignal):Promise<DirectoryContact[]> {
  const contacts:DirectoryContact[]=[];let cursor:string|null=null;const seen=new Set<string>();
  for(let page=0;page<100;page++){
    const response:Response=await fetch('/office/api/intelligence/directory'+(cursor?'?'+new URLSearchParams({cursor}):''),{cache:'no-store',signal});
    if(!response.ok || !response.headers.get('content-type')?.includes('application/json'))throw new Error('Office-Kontakte sind derzeit nicht verbunden.');
    const data:{contacts?:DirectoryContact[];next?:string|null}=await response.json();
    for(const item of data.contacts||[])if(typeof item.id==='string' && item.id.startsWith('office:') && /^\/office\/kontakte\/[a-zA-Z0-9_-]+$/.test(item.officeHref||''))contacts.push(item);
    cursor=data.next||null;if(!cursor)return contacts;
    if(seen.has(cursor))throw new Error('Office-Kontaktseiten wiederholen sich.');seen.add(cursor);
  }
  throw new Error('Office-Kontaktverzeichnis ist zu groß.');
}
/** Keep source records in their owning app; merge references by email for display. */
export function mergedDirectory<T extends NameContact>(personal:T[],office:DirectoryContact[]):(T & {officeHref?:string}|DirectoryContact)[]{
  const result:(T & {officeHref?:string}|DirectoryContact)[]=[];
  const emails=new Map<string,number>();
  for(const record of [...personal,...office]){
    const addresses=(record.emailAddresses||[]).map(email=>email.address?.trim().toLowerCase()).filter((value):value is string=>Boolean(value));
    const existing=addresses.map(address=>emails.get(address)).find(index=>index!==undefined);
    if(existing!==undefined){
      const officeHref='officeHref' in record?record.officeHref:undefined;
      const joined=[...(result[existing].emailAddresses||[]),...(record.emailAddresses||[])];
      const unique=[...new Map(joined.filter(email=>email.address).map(email=>[email.address!.trim().toLowerCase(),email])).values()];
      result[existing]={...result[existing],emailAddresses:unique,...(officeHref?{officeHref}:{})} as (typeof result)[number];
      for(const address of addresses)emails.set(address,existing);
      continue;
    }
    const index=result.push({...record})-1;for(const address of addresses)emails.set(address,index);
  }
  return result;
}
