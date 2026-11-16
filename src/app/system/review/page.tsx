import Link from 'next/link';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {documentDuplicates,type ReviewDocument} from '@/lib/ema/duplicates';
import {DuplicateReview} from '@/components/control/DuplicateReview';
export const dynamic='force-dynamic';
export const metadata={title:'Dubletten prüfen'};
export default async function ReviewPage(){
  const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');
  const documents:ReviewDocument[]=[];let error=false,truncated=false;
  for(let page=0;page<5;page++){
    const result=await db.from('documents').select('id,display_name,file_name,file_size_bytes,sha256,created_at,source_app').eq('user_id',user.id).eq('is_archived',false).order('id').range(page*1000,page*1000+999);
    if(result.error){error=true;break;}documents.push(...(result.data||[]));if((result.data?.length||0)<1000)break;if(page===4)truncated=true;
  }
  return <div className="page-container max-w-3xl space-y-5 py-6"><Link href="/dashboard" className="inline-block py-2 text-sm underline">← Zur Zentrale</Link><div><h1 className="text-2xl font-bold">Dubletten prüfen</h1><p className="mt-2 text-sm text-muted-foreground">Originale vergleichen und Einträge in der zuständigen App prüfen.</p></div><DuplicateReview groups={documentDuplicates(documents)} truncated={truncated} documentError={error}/></div>;
}
