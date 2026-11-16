export type ReviewDocument={id:string;display_name:string;file_name:string;file_size_bytes:number|null;sha256:string|null;created_at:string;source_app:string};
export type DuplicateGroup<T>={key:string;exact:boolean;items:T[]};
/** Hash matches are exact. Equal names/sizes are suggestions only, never merge instructions. */
export function documentDuplicates(documents:ReviewDocument[]):DuplicateGroup<ReviewDocument>[] {
  const hashes=new Map<string,ReviewDocument[]>(),names=new Map<string,ReviewDocument[]>();
  for(const d of documents){
    if(d.sha256&&/^[a-f0-9]{64}$/i.test(d.sha256)){const key=d.sha256.toLowerCase();hashes.set(key,[...(hashes.get(key)||[]),d]);}
    const name=d.file_name?.normalize('NFKC').trim().toLocaleLowerCase('de-DE');
    if(name&&d.file_size_bytes){const key=`${name}:${d.file_size_bytes}`;names.set(key,[...(names.get(key)||[]),d]);}
  }
  const exact=[...hashes].filter(([,rows])=>rows.length>1).map(([key,items])=>({key,exact:true,items}));
  const assigned=new Set(exact.flatMap(group=>group.items.map(d=>d.id)));
  const similar=[...names].flatMap(([key,items])=>{
    const rows=items.filter(d=>!assigned.has(d.id));
    // Different known hashes prove these files differ, even if names match.
    if(rows.length<2||rows.every(d=>d.sha256)&&new Set(rows.map(d=>d.sha256)).size>1)return [];
    return [{key,exact:false,items:rows}];
  });
  return [...exact,...similar];
}
export type ReviewContact={id:string;displayName?:string|null;emailAddresses?:{address?:string|null}[]|null;officeHref?:string;businessPhones?:string[]};
export function contactDuplicates(contacts:ReviewContact[]):DuplicateGroup<ReviewContact>[] {
  const groups=new Map<string,Map<string,ReviewContact>>();
  for(const c of contacts){
    const source=c.id.startsWith('office:')?'office':c.id.startsWith('ema-shared-contact:')?'shared':'personal';
    for(const email of c.emailAddresses||[]){const address=email.address?.trim().toLowerCase();if(!address)continue;const key=`${source}:${address}`;if(!groups.has(key))groups.set(key,new Map());groups.get(key)!.set(c.id,c);}
  }
  return [...groups].filter(([,rows])=>rows.size>1).map(([key,rows])=>({key,exact:false,items:[...rows.values()]}));
}
