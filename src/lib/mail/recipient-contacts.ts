import type { ContactNames } from './contact-names';
export type RecipientContact = {name:string;address:string};
const fold = (value:string) => value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().trim();
export function recipientSegment(text:string,caret:number|null) {
  return text.slice(0,caret ?? text.length).split(/[;,]/).length-1;
}
export function suggestRecipientContacts(names:ContactNames,query:string,existing:string[]=[],limit=8):RecipientContact[] {
  const needle=fold(query);
  if(!needle)return [];
  const used=new Set(existing.map(address=>address.trim().toLowerCase()));
  const matches: (RecipientContact & {rank:number})[]=[];
  for(const [address,name] of names) {
    if(used.has(address.trim().toLowerCase()))continue;
    const person=fold(name), email=fold(address);
    const terms=needle.split(/\s+/).filter(Boolean);
    if(!terms.every(term=>person.includes(term)||email.includes(term)))continue;
    const rank=person===needle?0:person.startsWith(needle)?1:person.split(/\s+/).some(word=>word.startsWith(needle))?2:email.startsWith(needle)?3:4;
    matches.push({name,address,rank});
  }
  return matches.sort((a,b)=>a.rank-b.rank||a.name.localeCompare(b.name)||a.address.localeCompare(b.address))
    .slice(0,limit).map(({name,address})=>({name,address}));
}
export function applyRecipientContact(values:string[],segment:number,address:string) {
  const next=[...values];
  const index=Math.max(0,Math.min(segment,next.length));
  const email=address.trim();
  if(next.some((value,i)=>i!==index&&value.trim().toLowerCase()===email.toLowerCase()))next.splice(index,1);
  else next[index]=email;
  return next;
}
