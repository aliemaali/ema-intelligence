const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {stripTypeScriptTypes} = require('node:module');
// Tests run with Node 24; no production connection or storage credentials are used.
const {z} = require('zod');
function fixture({owned=true, fail=false, signedIn=true}={}) {
  const calls=[];
  const query={delete(){calls.push(['delete']);return this},eq(k,v){calls.push(['eq',k,v]);return this},select(){return this},async maybeSingle(){return {data:owned?{id:'11111111-1111-4111-8111-111111111111'}:null,error:fail?{message:'fixture'}:null}}};
  const db={auth:{async getUser(){return {data:{user:signedIn?{id:'owner-a'}:null}}}},from(table){calls.push(['from',table]);return query}};
  const source=fs.readFileSync(path.join(__dirname,'../src/lib/actions/dms.actions.ts'),'utf8').replace(/^import .*\n/gm,'').replaceAll('export ','');
  const fn=new Function('z','createClient','redirect','revalidatePath',stripTypeScriptTypes(source)+';return deleteDmsFolder;')(z,async()=>db,()=>{throw Error('login required')},()=>{});
  return {fn,calls};
}
test('folder removal is restricted to the signed-in owner and never deletes document or storage records',async()=>{
 const f=fixture();assert.deepEqual(await f.fn('11111111-1111-4111-8111-111111111111'),{success:true});
 assert.deepEqual(f.calls.filter(c=>c[0]==='from'),[['from','document_folders']]);assert.ok(f.calls.some(c=>c[0]==='eq'&&c[1]==='user_id'&&c[2]==='owner-a'));
});
test('invalid, foreign and failed folder deletions never report success',async()=>{
 const invalid=fixture();assert.ok((await invalid.fn('all')).error);assert.equal(invalid.calls.length,0);
 for(const options of [{owned:false},{fail:true}]){const f=fixture(options);assert.ok((await f.fn('11111111-1111-4111-8111-111111111111')).error)}
 const f=fixture({signedIn:false});await assert.rejects(f.fn('11111111-1111-4111-8111-111111111111'),/login required/);assert.equal(f.calls.length,0);
});
