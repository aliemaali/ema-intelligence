import {NextRequest,NextResponse} from 'next/server';
import {mailSession,mailboxAccess} from '@/lib/mail/server';
import {emaContactsPage} from '@/lib/ema/contacts';
import {MailError} from '@/lib/mail/graph';
export async function GET(request:NextRequest){
  try{
    const session=await mailSession();const {token}=await mailboxAccess(session,'me');
    const result=await emaContactsPage(session,token,request.nextUrl.searchParams.get('cursor'));
    const contacts=(result.value||[]).map((raw:unknown)=>{
      const item=raw as {id:string;displayName?:string;companyName?:string;emailAddresses?:{address:string}[];businessPhones?:string[]};
      const name=item.displayName||item.emailAddresses?.[0]?.address||'Kontakt';
      return {id:item.id,name,company:item.companyName||'',role:'',email:item.emailAddresses?.[0]?.address||'',phone:item.businessPhones?.[0]||'',initials:name.split(/\s+/).slice(0,2).map(part=>part[0]||'').join('')};
    });
    return NextResponse.json({contacts,next:result['@odata.nextLink']||null},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return NextResponse.json({error:error instanceof MailError?error.message:'Kontakte konnten nicht geladen werden.'},{status:error instanceof MailError?error.status:502,headers:{'Cache-Control':'private, no-store'}});}
}
