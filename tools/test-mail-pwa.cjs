const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('public/mail/sw.js','utf8');
function fixture(response){const handlers={},badges=[],notifications=[],opened=[];
const self={navigator:{setAppBadge:async n=>badges.push(n)},location:{origin:'https://ema.example'},skipWaiting(){},clients:{claim:async()=>{},matchAll:async()=>[],openWindow:async url=>opened.push(url)},registration:{showNotification:async(t,o)=>notifications.push([t,o])},addEventListener:(n,f)=>handlers[n]=f};
vm.runInNewContext(source,{self,URL,fetch:async()=>response});
return {handlers,badges,notifications,opened,async push(){let promise;handlers.push({data:{json:()=>({url:'/mail?message=test',tag:'same'})},waitUntil:p=>promise=p});await promise;}};}
test('worker uses absolute count on repeated pushes and shows every notification',async()=>{const f=fixture({ok:true,status:200,json:async()=>({count:7})});await f.push();await f.push();assert.deepEqual(f.badges,[7,7]);assert.equal(f.notifications.length,2);});
test('worker clears zero and revoked-session badge, retains count on outage/invalid values',async()=>{for(const [response,expected] of [[{ok:true,status:200,json:async()=>({count:0})},[0]],[{ok:false,status:401},[0]],[{ok:false,status:503},[]],[{ok:true,status:200,json:async()=>({count:-4})},[]]]){const f=fixture(response);await f.push();assert.deepEqual(f.badges,expected);}});
test('notification click never opens an external origin',async()=>{const f=fixture({ok:false});let waited=false;f.handlers.notificationclick({notification:{close(){},data:{url:'https://evil.example/mail'}},waitUntil(){waited=true}});assert.equal(waited,false);assert.deepEqual(f.opened,[]);});
test('separate Mail manifest preserves platform identity and valid icon dimensions',async()=>{const sharp=require('sharp'),manifest=JSON.parse(fs.readFileSync('public/mail/manifest.webmanifest'));assert.equal(manifest.id,'/mail');assert.equal(manifest.start_url,'/mail');assert.notEqual(JSON.parse(fs.readFileSync('public/manifest.json')).id,manifest.id);for(const icon of manifest.icons){const meta=await sharp('public'+icon.src).metadata();assert.equal(`${meta.width}x${meta.height}`,icon.sizes);}});
test('middleware serves only exact public install assets without authentication',async()=>{
const esbuild=require('esbuild');await esbuild.build({entryPoints:['src/middleware.ts'],bundle:true,platform:'node',format:'cjs',outfile:'.tmp/mail-pwa-middleware.cjs',plugins:[{name:'no-auth-for-assets',setup(build){build.onResolve({filter:/^@supabase\/ssr$/},()=>({path:'auth',namespace:'mock'}));build.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export function createServerClient(){throw new Error("Authentication required")}',loader:'js'}));}}]});
const {middleware}=require('../.tmp/mail-pwa-middleware.cjs');
for(const pathname of ['/mail/manifest.webmanifest','/mail/sw.js']){const response=await middleware({nextUrl:{pathname}});assert.equal(response.status,200);assert.equal(response.headers.get('location'),null);}
for(const pathname of ['/mail','/mail/sw.js/private','/mail/manifest.webmanifest/private','/mail/messages'])await assert.rejects(middleware({nextUrl:{pathname}}),/Authentication required/);
});
test('new Mail home-screen icons are opaque full-bleed images without white outer padding',async()=>{
  const sharp=require('sharp');
  for(const name of ['icon-192-v2.png','icon-512-v2.png','apple-touch-icon-v2.png']) {
    const {data,info}=await sharp('public/mail/icons/'+name).removeAlpha().raw().toBuffer({resolveWithObject:true});
    for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(x===0||y===0||x===info.width-1||y===info.height-1){const i=(y*info.width+x)*info.channels;assert.ok(!(data[i]>230&&data[i+1]>230&&data[i+2]>230),`${name}: white edge`);}
    assert.equal((await sharp('public/mail/icons/'+name).metadata()).hasAlpha,false);
  }
});
