"use client";
import {useEffect} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {listenForEmaChanges} from '@/lib/ema/updates';
export function SharedDataRefresh(){
  const router=useRouter(),pathname=usePathname();
  useEffect(()=>{
    if(pathname?.startsWith('/mail'))return; // Mail has its own incremental readers.
    let timer:ReturnType<typeof setTimeout>|undefined;
    const stop=listenForEmaChanges(()=>{clearTimeout(timer);timer=setTimeout(()=>router.refresh(),150);});
    return()=>{stop();clearTimeout(timer);};
  },[router,pathname]);
  return null;
}
