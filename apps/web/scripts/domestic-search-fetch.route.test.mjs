import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet,onRequestPost} from '../functions/api/match/discover.js';

const origin='https://preview.hhba.example';
function setup({active=true,role='candidate',migrated=true}={}){
 const ledger=[],cache=new Map(),callCount={search:0,fetch:0},phone='13800000000';
 const db={prepare(sql){return {
  async first(){
   if(sql.includes('sqlite_master'))return migrated?{name:sql.includes('hhba_external_search_cache')?'hhba_external_search_cache':'hhba_external_search_requests'}:null;
   throw Error('Unknown unbound first '+sql);
  },
  bind(...args){return {
   async first(){
    if(sql.includes('FROM hhba_external_search_cache')){
     const row=cache.get(args[0]);return row&&row.expires_at>args[1]?row:null;
    }
    if(sql.includes('FROM hhba_auth_sessions'))return {phone,revoked:0,
     expires_at:new Date(Date.now()+3600000).toISOString()};
    if(sql.includes('FROM hhba_auth_users'))return {phone,role};
    if(sql.includes('COUNT(*) AS n FROM hhba_external_search_requests'))return {n:ledger.length};
    throw Error('Unknown bound first '+sql);
   },
   async run(){
    if(sql.startsWith('UPDATE hhba_auth_sessions'))return {success:true,meta:{changes:1}};
    if(sql.startsWith('INSERT OR REPLACE INTO hhba_external_search_cache')){
     cache.set(args[0],{payload_json:args[1],checked_at:args[2],expires_at:args[3]});
     return {success:true,meta:{changes:1}};
    }
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
 return {env,ledger,cache,callCount,request};
}
function mockProvider(counter){
 const original=globalThis.fetch;
 globalThis.fetch=async (url,opts)=>{
  assert.equal(opts.method,'POST');
  assert.equal(opts.redirect,'manual');
  assert.equal(opts.headers.Authorization,'Bearer fake-key-of-adequate-length');
  assert.equal(String(url),'https://api.deepseek.com/v1/tools/search');
  const body=JSON.parse(opts.body);
  assert.ok(body.query.includes('site:')||body.query.includes('中国大陆 招聘'),body.query);
  assert.doesNotMatch(body.query,/site:[^\s]+(?:evil|example|google)/);
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
  assert.equal(h.callCount.search,5);
  assert.equal(h.ledger.length,1);
  assert.equal(h.ledger[0].hash.includes('13800000000'),false);
  assert.doesNotMatch(JSON.stringify(value),/fake-key|13800000000/);
 }finally{restore();}
});
test('public 24h cache returns identical abstract role with no extra provider calls or charges',async()=>{
 const h=setup(),restore=mockProvider(h.callCount);
 try{
  const first=await (await onRequestPost({request:h.request(),env:h.env})).json();
  const second=await (await onRequestPost({request:h.request(),env:h.env})).json();
  assert.equal(first.cache_hit,false);
  assert.equal(second.cache_hit,true);
  assert.deepEqual(second.usage,{search:0,fetch:0});
  assert.deepEqual(second.attempts,{search:0,fetch:0});
  assert.equal(h.callCount.search,5);
  assert.equal(h.ledger.length,1);
  assert.equal(h.cache.size,1);
  assert.doesNotMatch(JSON.stringify([...h.cache.values()]),/13800000000|Python 软件开发|fake-key/);
 }finally{restore();}
});
test('different roles still respect two-per-day search quota',async()=>{
 const h=setup(),restore=mockProvider(h.callCount);
 try{
  assert.equal((await onRequestPost({request:h.request({role_hint:'软件开发工程师'}),env:h.env})).status,200);
  assert.equal((await onRequestPost({request:h.request({role_hint:'数据分析师'}),env:h.env})).status,200);
  const blocked=await onRequestPost({request:h.request({role_hint:'视觉设计师'}),env:h.env});
  assert.equal(blocked.status,429);
  assert.equal((await blocked.json()).error,'EXTERNAL_SEARCH_PERSONAL_LIMIT');
  assert.equal(h.ledger.length,2);
  assert.equal(h.callCount.search,10);
 }finally{restore();}
});
test('production search supports explicit production-only mode without changing live auth rollout',async()=>{
 const h=setup();
 delete h.env.HHBA_AUTH_ROLLOUT;
 assert.equal((await (await onRequestGet({env:h.env})).json()).enabled,false);
 h.env.HHBA_MATCH_RUNTIME_MODE='production';
 assert.equal((await (await onRequestGet({env:h.env})).json()).enabled,true);
 h.env.HHBA_MATCH_SERVICE_ENABLED='0';
 assert.equal((await (await onRequestGet({env:h.env})).json()).enabled,false);
 h.env.HHBA_MATCH_SERVICE_ENABLED='1';
 h.env.HHBA_MATCH_EXTERNAL_SEARCH_ENABLED='0';
 assert.equal((await (await onRequestGet({env:h.env})).json()).enabled,false);
 delete h.env.HHBA_MATCH_EXTERNAL_SEARCH_ENABLED;
 assert.equal((await (await onRequestGet({env:h.env})).json()).enabled,false);
 assert.equal(h.ledger.length,0);
 assert.equal(h.callCount.search,0);
});

test('status advertises maximum 5 Search + 10 Fetch and 24-hour cache',async()=>{
 const h=setup();
 const status=await (await onRequestGet({env:h.env})).json();
 assert.equal(status.enabled,true);
 assert.equal(status.max_search_requests,5);
 assert.equal(status.max_fetch_requests,10);
 assert.equal(status.theoretical_search_fetch_cost_cap_cny,0.075);
 assert.equal(status.cache_ttl_hours,24);
 assert.equal(status.integrated_into_top10,true);
});
