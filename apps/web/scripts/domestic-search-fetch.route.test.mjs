import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet,onRequestPost} from '../functions/api/match/discover.js';

const origin='https://preview.hhba.example';
function setup({active=true,role='candidate',migrated=true}={}){
 const ledger=[],callCount={search:0,fetch:0},phone='13800000000';
 const db={prepare(sql){return {
  async first(){
   if(sql.includes('sqlite_master'))return migrated?{name:'hhba_external_search_requests'}:null;
   throw Error('Unknown unbound first '+sql);
  },
  bind(...args){return {
   async first(){
    if(sql.includes('FROM hhba_auth_sessions'))return {phone,revoked:0,
     expires_at:new Date(Date.now()+3600000).toISOString()};
    if(sql.includes('FROM hhba_auth_users'))return {phone,role};
    if(sql.includes('COUNT(*) AS n FROM hhba_external_search_requests'))return {n:ledger.length};
    throw Error('Unknown bound first '+sql);
   },
   async run(){
    if(sql.startsWith('UPDATE hhba_auth_sessions'))return {success:true,meta:{changes:1}};
    if(sql.startsWith('INSERT INTO hhba_external_search_requests')){
     const day=args[1],hash=args[2];
     if(ledger.filter(x=>x.day===day).length>=12||
        ledger.filter(x=>x.day===day&&x.hash===hash).length>=2)
      return {success:true,meta:{changes:0}};
     ledger.push({id:args[0],day,hash});
     return {success:true,meta:{changes:1}};
    }
    throw Error('Unknown D1 operation '+sql);
   }
  }}
 }}};
 const env={
  HHBA_AUTH_ROLLOUT:'preview',HHBA_MATCH_SERVICE_ENABLED:'1',
  HHBA_MATCH_EXTERNAL_SEARCH_ENABLED:active?'1':'0',
  HHBA_MATCH_DEEPSEEK_KEY:'fake-key-of-adequate-length',
  HHBA_MATCH_LIMIT_PEPPER:'synthetic-pepper-with-32-chars-123456789',
  HHBA_PNVS_AUTH_DB:db
 };
 function request({role_hint='Python 软件开发',consent=true,originHeader=origin,
  token=true,payload=null}={}){
  return new Request(origin+'/api/match/discover',{method:'POST',
   headers:{Origin:originHeader,'Content-Type':'application/json',
    ...(token?{Authorization:'Bearer fake-token'}:{})},
   body:JSON.stringify(payload||{role_hint,consent_search:consent})});
 }
 return {env,ledger,callCount,request};
}
function mockProvider(counter){
 const original=globalThis.fetch;
 globalThis.fetch=async (url,opts)=>{
  assert.equal(opts.method,'POST');
  assert.equal(opts.redirect,'manual');
  assert.equal(opts.headers.Authorization,'Bearer fake-key-of-adequate-length');
  assert.equal(String(url),'https://api.deepseek.com/v1/tools/search');
  const body=JSON.parse(opts.body);
  assert.match(body.query,/^site:/);
  assert.doesNotMatch(JSON.stringify(body),/13800000000|fake-token|person@example\.com/);
  counter.search++;
  return Response.json({results:[]});
 };
 return ()=>{globalThis.fetch=original;};
}
test('disabled or un-migrated Preview returns safe status and never calls provider',async()=>{
 const disabled=setup({active:false}),missing=setup({migrated:false});
 assert.equal((await (await onRequestGet({env:disabled.env})).json()).enabled,false);
 assert.equal((await (await onRequestGet({env:missing.env})).json()).enabled,false);
 assert.equal((await onRequestPost({request:disabled.request(),env:disabled.env})).status,503);
 assert.equal((await onRequestPost({request:missing.request(),env:missing.env})).status,503);
 assert.equal(disabled.ledger.length,0);
});
test('origin, role, auth and explicit consent enforced before usage',async()=>{
 const h=setup(),restore=mockProvider(h.callCount);
 try{
  assert.equal((await onRequestPost({request:h.request({originHeader:'https://evil.example'}),env:h.env})).status,403);
  assert.equal((await onRequestPost({request:h.request({token:false}),env:h.env})).status,401);
  assert.equal((await onRequestPost({request:h.request({consent:false}),env:h.env})).status,400);
  assert.equal((await onRequestPost({request:h.request({payload:{
   role_hint:'Python 软件开发',resume:'private',consent_search:true}}),env:h.env})).status,400);
  assert.equal((await onRequestPost({request:h.request({role_hint:'13812345678'}),env:h.env})).status,400);
  const employer=setup({role:'employer'});
  assert.equal((await onRequestPost({request:employer.request(),env:employer.env})).status,403);
  assert.equal(h.callCount.search,0);
  assert.equal(h.ledger.length,0);
 }finally{restore();}
});
test('role-only candidate discovery is separate from matching quota',async()=>{
 const h=setup(),restore=mockProvider(h.callCount);
 try{
  const res=await onRequestPost({request:h.request(),env:h.env});
  assert.equal(res.status,200);
  const value=await res.json();
  assert.equal(value.ok,true);
  assert.equal(value.kind,'HHBA_DOMESTIC_DISCOVERY_V1');
  assert.deepEqual(value.candidates,[]);
  assert.deepEqual(value.usage,{search:0,fetch:0});
  assert.equal(h.callCount.search,2);
  assert.equal(h.ledger.length,1);
  assert.equal(h.ledger[0].hash.includes('13800000000'),false);
  assert.doesNotMatch(JSON.stringify(value),/fake-key|13800000000/);
 }finally{restore();}
});
test('personal quota caps paid Search even after repeated submissions',async()=>{
 const h=setup(),restore=mockProvider(h.callCount);
 try{
  assert.equal((await onRequestPost({request:h.request(),env:h.env})).status,200);
  assert.equal((await onRequestPost({request:h.request(),env:h.env})).status,200);
  const denied=await onRequestPost({request:h.request(),env:h.env});
  assert.equal(denied.status,429);
  assert.equal((await denied.json()).error,'EXTERNAL_SEARCH_PERSONAL_LIMIT');
  assert.equal(h.ledger.length,2);
  assert.equal(h.callCount.search,4);
 }finally{restore();}
});
