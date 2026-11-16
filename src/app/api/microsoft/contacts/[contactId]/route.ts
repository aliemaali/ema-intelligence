import {NextResponse} from 'next/server';
// All edits use the canonical contacts API, including shared-address-book checks.
function retired(){return NextResponse.json({error:'Kontakte bitte in EMA Mail bearbeiten.',destination:'/mail?view=contacts'},{status:410,headers:{'Cache-Control':'private, no-store'}});}
export const PATCH=retired;
export const DELETE=retired;
