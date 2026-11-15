"use client";
import { useRef, useState } from 'react';
import type { ContactNames } from '@/lib/mail/contact-names';
import { applyRecipientContact, recipientSegment, suggestRecipientContacts } from '@/lib/mail/recipient-contacts';
import s from './mail.module.css';

export function MailRecipientInput({id,label,values,contacts,disabled,onChange}: {
  id:string;label:string;values:string[];contacts:ContactNames;disabled:boolean;onChange:(addresses:string[])=>void;
}) {
  const [open,setOpen]=useState(false), [segment,setSegment]=useState(0), [active,setActive]=useState(0);
  const input=useRef<HTMLInputElement>(null);
  const index=Math.min(segment,Math.max(0,values.length-1));
  const choices=suggestRecipientContacts(contacts,values[index]||'',values.filter((_,i)=>i!==index));
  const visible=open&&!disabled&&choices.length>0;
  const highlighted=Math.min(active,choices.length-1);
  function select(address:string) {
    const next=applyRecipientContact(values,index,address);
    onChange(next);setOpen(false);setActive(0);
    requestAnimationFrame(()=>{input.current?.focus();const end=next.join('; ').length;input.current?.setSelectionRange(end,end);});
  }
  return <div className={s.recipientInput}>
    <input ref={input} id={id} aria-label={label} role="combobox" aria-autocomplete="list"
      aria-expanded={visible} aria-controls={visible?`${id}-contacts`:undefined}
      aria-activedescendant={visible?`${id}-contact-${highlighted}`:undefined}
      disabled={disabled} value={values.join('; ')}
      autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}
      onFocus={event=>{setSegment(recipientSegment(event.currentTarget.value,event.currentTarget.selectionStart));setOpen(true);}}
      onSelect={event=>setSegment(recipientSegment(event.currentTarget.value,event.currentTarget.selectionStart))}
      onBlur={()=>{setOpen(false);const trimmed=values.map(value=>value.trim());if(trimmed.some((value,i)=>value!==values[i]))onChange(trimmed);}}
      onChange={event=>{
        const selected=recipientSegment(event.currentTarget.value,event.currentTarget.selectionStart);
        setSegment(selected);setActive(0);setOpen(true);
        // Preserve spaces inside an unfinished contact name while normalizing separators.
        onChange(event.currentTarget.value.split(/[;,]/).map((value,i)=>i===selected?value.trimStart():value.trim()));
      }}
      onKeyDown={event=>{
        if(event.key==='Escape'){setOpen(false);return;}
        if(!choices.length)return;
        if(event.key==='ArrowDown'||event.key==='ArrowUp') {
          event.preventDefault();setOpen(true);
          setActive(value=>!open?0:(value+(event.key==='ArrowDown'?1:-1)+choices.length)%choices.length);
        } else if(event.key==='Enter'&&visible){event.preventDefault();select(choices[highlighted].address);}
      }} />
    {visible&&<div id={`${id}-contacts`} className={s.recipientSuggestions} role="listbox" aria-label={`Kontaktvorschläge für ${label}`}>
      {choices.map((choice,i)=><button key={choice.address} id={`${id}-contact-${i}`} type="button" role="option" tabIndex={-1}
        aria-selected={i===highlighted} className={s.recipientSuggestion}
        onPointerDown={event=>event.preventDefault()} onMouseEnter={()=>setActive(i)} onClick={()=>select(choice.address)}>
        <strong>{choice.name}</strong><small>{choice.address}</small>
      </button>)}
    </div>}
  </div>;
}
