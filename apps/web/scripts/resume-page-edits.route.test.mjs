import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet,onRequestPost,onRequestDelete} from '../functions/api/resume-page-edits.js';
const origin='https://preview.hhba.example';
const id='11111111-2222-4333-8444-555555555555',sha='a'.repeat(64);
const key='candidates/test/'+id+'.pdf';
const layout={schema:'HHBA_RESUME_VISUAL_LAYOUT_V1',source_sha256:sha,regions:[
 {id:'p1-r1',page:1,text:'ORIGINAL RESUME VIEW',kind:'experience',bbox:[100,120,400,80]},
 {id:'p1-r2',page:1,text:'真实项目经历与工作成果',kind:'projects',bbox:[100,240,500,140]}
]};
function setup({enabled=true,role='candidate',owner='account-A'}={}){
 const stored=new Map([[key+'.hhba-vision-layout-v1.json',JSON.stringify(layout)]]);
 const bucket={
  async get(k){const data=stored.get(k);return data===undefined?null:{json:async()=>JSON.parse(data)};},
  async put(k,bytes){stored.set(k,String(bytes));},
  async delete(k){stored.delete(k);}
 };
 const row={id,phone:owner,media_type:'application/pdf',storage_key:key,sha256:sha};
 const db={prepare(sql){
  return {bind(...args){return {
   async first(){
    if(sql.includes('FROM hhba_auth_sessions'))return {phone:'account-A',revoked:0,
     expires_at:new Date(Date.now()+3600000).toISOString()};
    if(sql.includes('FROM hhba_auth_users'))return {phone:'account-A',role};
    if(sql.includes('FROM hhba_candidate_resumes'))
     return args[0]===id&&args[1]===owner?row:null;
    throw Error('unexpected SQL: '+sql);
   },
   async run(){
    if(sql.includes('UPDATE hhba_auth_sessions'))return {success:true,meta:{changes:1}};
    throw Error('unexpected SQL run: '+sql);
   }
  };}};
 }};
 return {stored,env:{
  HHBA_AUTH_ROLLOUT:'preview',HHBA_RESUME_VISION_ENABLED:enabled?'1':'0',
  HHBA_PNVS_AUTH_DB:db,HHBA_PRIVATE_RESUMES:bucket
 }};
}
function req(method='GET',{auth=true,from=origin,body=null,query='?resume_id='+id}={}){
 return new Request(origin+'/api/resume-page-edits'+query,{
  method,headers:{
   Origin:from,
   ...(auth?{Authorization:'Bearer synthetic-token'}:{}),
   ...(body?{'Content-Type':'application/json'}:{})
  },...(body?{body:JSON.stringify(body)}:{})
 });
}
const change={id:'p1-r1',original:'ORIGINAL RESUME VIEW',text:'A confirmed new explanation',confirmed:true};
test('only the owner can create and read edits; no edit is written into original PDF',async()=>{
 const s=setup();
 const body={resume_id:id,confirmed_real:true,changes:[change]};
 const p=await onRequestPost({env:s.env,request:req('POST',{body})});
 assert.equal(p.status,200);
 assert.equal((await p.json()).changes[0].text,change.text);
 assert.equal(s.stored.has(key+'.hhba-page-edits-v1.json'),true);
 assert.equal(s.stored.has(key),false,'no PDF source write ever occurs');
 const g=await onRequestGet({env:s.env,request:req()});
 assert.equal(g.status,200);
 assert.deepEqual((await g.json()).changes[0],{...change,page:1});
 const cleared=await onRequestDelete({env:s.env,request:req('DELETE')});
 assert.equal(cleared.status,200);
 assert.deepEqual((await (await onRequestGet({env:s.env,request:req()})).json()).changes,[]);
});
test('stale, invented, unconfirmed, duplicate or oversized revisions are denied',async()=>{
 const s=setup();
 for(const changes of [
  [{...change,id:'p9-r9'}],
  [{...change,original:'WRONG ORIGINAL'}],
  [{...change,confirmed:false}],
  [{...change,text:''}],
  [change,change],
  [{...change,text:'a'.repeat(1601)}]
 ]){
  const r=await onRequestPost({env:s.env,request:req('POST',{
   body:{resume_id:id,confirmed_real:true,changes}
  })});
  assert.equal(r.status,400);
 }
 assert.equal((await onRequestPost({env:s.env,request:req('POST',{
  body:{resume_id:id,confirmed_real:false,changes:[change]}
 })})).status,400);
 assert.equal(s.stored.has(key+'.hhba-page-edits-v1.json'),false);
});
test('does not leak edits across accounts, to employers or across origins',async()=>{
 const s=setup();
 assert.equal((await onRequestGet({env:s.env,request:req('GET',{auth:false})})).status,401);
 assert.equal((await onRequestPost({env:s.env,request:req('POST',{
  from:'https://attacker.example',body:{resume_id:id,confirmed_real:true,changes:[change]}
 })})).status,403);
 assert.equal((await onRequestGet({env:setup({owner:'another-account'}).env,
  request:req()})).status,404);
 assert.equal((await onRequestGet({env:setup({role:'employer'}).env,
  request:req()})).status,403);
 assert.equal((await onRequestPost({env:setup({enabled:false}).env,
  request:req('POST',{body:{resume_id:id,confirmed_real:true,changes:[change]}})})).status,503);
});
test('never saves revised text without an existing visual source map',async()=>{
 const s=setup();
 s.stored.delete(key+'.hhba-vision-layout-v1.json');
 const r=await onRequestPost({env:s.env,request:req('POST',{
  body:{resume_id:id,confirmed_real:true,changes:[change]}
 })});
 assert.equal(r.status,409);
 assert.equal(s.stored.has(key+'.hhba-page-edits-v1.json'),false);
});
