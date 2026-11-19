import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet,onRequestPost} from '../functions/api/resume-layout.js';
const origin='https://preview.hhba.example';
const id='11111111-2222-4333-8444-555555555555';
const sha='f'.repeat(64),pdf=new TextEncoder().encode('%PDF-1.7\n'+'.'.repeat(110));
function setup({enabled=true,role='candidate',hasFile=true}={}){
 const stored=new Map(),attempts=[];
 if(hasFile)stored.set('candidates/test/'+id+'.pdf',pdf);
 const bucket={
  async get(key){
   if(!stored.has(key))return null;
   const value=stored.get(key);
   return {
    arrayBuffer:async()=>new Uint8Array(value).buffer,
    json:async()=>JSON.parse(String(value))
   };
  },
  async put(key,value){stored.set(key,value);},
  async delete(key){stored.delete(key);}
 };
 const row={id,phone:'account-A',media_type:'application/pdf',size_bytes:pdf.length,
  storage_key:'candidates/test/'+id+'.pdf',sha256:sha};
 const db={prepare(sql){return {
  async first(){
   if(sql.includes('sqlite_master'))return {name:'hhba_resume_visual_attempts'};
   throw Error('unexpected unbound SQL: '+sql);
  },
  bind(...args){return {
   async first(){
    if(sql.includes('FROM hhba_auth_sessions'))return {phone:'account-A',revoked:0,
     expires_at:new Date(Date.now()+3600000).toISOString()};
    if(sql.includes('FROM hhba_auth_users'))return {phone:'account-A',role};
    if(sql.includes('FROM hhba_candidate_resumes'))
     return args[0]===id&&args[1]==='account-A'&&hasFile?row:null;
    throw Error('unexpected SQL: '+sql);
   },
   async run(){
    if(sql.includes('UPDATE hhba_auth_sessions'))return {success:true,meta:{changes:1}};
    if(sql.includes('INSERT INTO hhba_resume_visual_attempts')){
     if(attempts.length>=2)return {success:true,meta:{changes:0}};
     attempts.push(args);return {success:true,meta:{changes:1}};
    }
    throw Error('unexpected run SQL: '+sql);
   }
  };}
 }}};
 return {env:{HHBA_AUTH_ROLLOUT:'preview',HHBA_RESUME_VISION_ENABLED:enabled?'1':'0',
  HHBA_MATCH_LIMIT_PEPPER:'x'.repeat(28),HHBA_AI_OPENAI_API_KEY:'synthetic-secret-not-real',
  HHBA_PNVS_AUTH_DB:db,HHBA_PRIVATE_RESUMES:bucket},attempts,stored};
}
function req({auth=true,consent=true,from=origin,overrideId=id}={}){
 return new Request(origin+'/api/resume-layout',{method:'POST',headers:{
  'Content-Type':'application/json',Origin:from,
  ...(auth?{Authorization:'Bearer synthetic-token'}:{})
 },body:JSON.stringify({resume_id:overrideId,consent_ai_vision:consent})});
}
test('vision endpoint fails closed for disabled, wrong origin, no consent and no session',async()=>{
 const s=setup();
 assert.equal((await onRequestPost({env:setup({enabled:false}).env,request:req()})).status,503);
 assert.equal((await onRequestPost({env:s.env,request:req({from:'https://other.example'})})).status,403);
 assert.equal((await onRequestPost({env:s.env,request:req({auth:false})})).status,401);
 assert.equal((await onRequestPost({env:s.env,request:req({consent:false})})).status,400);
 assert.equal((await onRequestPost({env:setup({role:'employer'}).env,request:req()})).status,403);
 assert.equal(s.attempts.length,0);
 const status=await (await onRequestGet({env:s.env})).json();
 assert.equal(status.enabled,true);
 assert.deepEqual(status.formats,['pdf']);
});
test('only the owner can process their stored file, not arbitrary client-supplied URLs',async()=>{
 const s=setup();
 assert.equal((await onRequestPost({env:s.env,request:req({overrideId:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'})})).status,404);
 assert.equal((await onRequestPost({env:setup({hasFile:false}).env,request:req()})).status,404);
 assert.equal(s.attempts.length,0);
});
test('a successful visual layout caches privately; retry skips paid model call',async()=>{
 const s=setup();let calls=0;
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async (url,options)=>{
  calls++;
  assert.equal(url,'https://api.openai.com/v1/responses');
  const body=JSON.parse(options.body);
  assert.equal(body.store,false);
  return {status:200,ok:true,json:async()=>({output:[
   {content:[{type:'output_text',text:JSON.stringify({
    page_count:1,layout_style:'single_column',
    regions:[{page:1,kind:'experience',text:'合成测试工作经历',bbox:[100,180,800,120],confidence:.9}]
   })}]}]})};
 };
 try{
  const first=await onRequestPost({env:s.env,request:req()});
  assert.equal(first.status,200);
  const a=await first.json();
  assert.equal(a.cached,false);
  assert.equal(a.layout.needs_review,true);
  assert.equal(a.layout.regions[0].placement_verified,false);
  assert.equal(calls,1);
  const next=await (await onRequestPost({env:s.env,request:req()})).json();
  assert.equal(next.cached,true);
  assert.equal(calls,1);
  assert.equal(s.attempts.length,1);
  assert.ok(s.stored.has('candidates/test/'+id+'.pdf.hhba-vision-layout-v1.json'));
 }finally{globalThis.fetch=originalFetch;}
});
