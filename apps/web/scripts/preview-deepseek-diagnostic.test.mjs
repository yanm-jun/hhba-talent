import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet,onRequestPost} from '../functions/api/preview-deepseek-diagnostic.js';
const host='https://e7870a6e.hhba-talent.pages.dev';
function setup(){
 const records=[];
 const db={prepare(sql){return{bind(...args){return{async run(){
  if(!sql.includes('hhba_resume_optimization_attempts'))throw Error('WRONG_TABLE');
  if(records.length>=3)return {success:true,meta:{changes:0}};
  records.push(args);return {success:true,meta:{changes:1}};
 }}}}}};
 const env={HHBA_AUTH_ROLLOUT:'preview',HHBA_PREVIEW_AI_DIAG_ENABLED:'1',
  HHBA_PNVS_AUTH_DB:db,HHBA_MATCH_DEEPSEEK_KEY:'synthetic-test-key'};
 const request=(origin=host,url=host+'/api/preview-deepseek-diagnostic')=>
  new Request(url,{method:'POST',headers:{Origin:origin,'Sec-Fetch-Site':'same-origin'}});
 return {env,request,records};
}
test('diagnostic is disabled by default and cannot run on production domains',async()=>{
 const s=setup();
 assert.equal((await onRequestGet()).status,404);
 assert.equal((await onRequestPost({env:{...s.env,HHBA_PREVIEW_AI_DIAG_ENABLED:'0'},request:s.request()})).status,404);
 assert.equal((await onRequestPost({env:s.env,request:s.request('https://evil.example')})).status,404);
 assert.equal((await onRequestPost({env:s.env,request:s.request('https://hhba.work','https://hhba.work/api/preview-deepseek-diagnostic')})).status,404);
 assert.equal(s.records.length,0);
});
test('balance probe reveals only coarse status, never credentials or balance numbers',async()=>{
 const s=setup(),prior=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{
  assert.equal(url,'https://api.deepseek.com/user/balance');
  assert.equal(options.headers.Authorization,'Bearer synthetic-test-key');
  assert.equal(options.redirect,'error');
  return Response.json({is_available:true,balance_infos:[{total_balance:'9876.54',currency:'CNY'}]});
 };
 try{
  const res=await onRequestPost({env:s.env,request:s.request()});
  assert.equal(res.status,200);
  const value=await res.json();
  assert.deepEqual(value,{kind:'HHBA_PREVIEW_DEEPSEEK_DIAGNOSTIC_V1',ok:true,code:'PROVIDER_BALANCE_AVAILABLE'});
  assert.doesNotMatch(JSON.stringify(value),/9876|synthetic-test-key/);
 }finally{globalThis.fetch=prior;}
});
test('invalid key, empty funds, missing balance and repeated probes fail safely',async()=>{
 const s=setup(),prior=globalThis.fetch;
 const examples=[[401,'PROVIDER_KEY_REJECTED'],[402,'PROVIDER_BALANCE_EMPTY']];
 try{
  for(const [status,code] of examples){
   globalThis.fetch=async()=>new Response('sensitive',{status});
   const data=await (await onRequestPost({env:s.env,request:s.request()})).json();
   assert.equal(data.code,code);
   assert.doesNotMatch(JSON.stringify(data),/sensitive/);
  }
  globalThis.fetch=async()=>Response.json({is_available:false});
  const empty=await (await onRequestPost({env:s.env,request:s.request()})).json();
  assert.equal(empty.code,'PROVIDER_BALANCE_EMPTY');
  const last=await onRequestPost({env:s.env,request:s.request()});
  assert.equal(last.status,429);
  assert.equal(s.records.length,3);
 }finally{globalThis.fetch=prior;}
});

test('synthetic generation self-check never forwards client provided content',async()=>{
 const s=setup(),old=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{
  assert.equal(url,'https://api.deepseek.com/chat/completions');
  const input=JSON.parse(JSON.parse(options.body).messages[1].content);
  assert.deepEqual(input.blocks.map(b=>b.id),['qa-source']);
  assert.match(input.blocks[0].text,/示例门店/);
  assert.doesNotMatch(input.blocks[0].text,/untrusted-client-content/);
  return Response.json({choices:[{message:{content:'{"suggestions":[]}'}}]});
 };
 try{
  const response=await onRequestPost({env:s.env,
   request:s.request(host,host+'/api/preview-deepseek-diagnostic?mode=synthetic')});
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.code,'SYNTHETIC_AI_GENERATION_OK');
  assert.equal(data.suggestion_count,0);
 }finally{globalThis.fetch=old;}
});
test('synthetic generation errors expose only fixed codes',async()=>{
 const s=setup(),old=globalThis.fetch;
 globalThis.fetch=async()=>new Response('provider-private-debug-info',{status:401});
 try{
  const r=await onRequestPost({env:s.env,
   request:s.request(host,host+'/api/preview-deepseek-diagnostic?mode=synthetic')});
  const data=await r.json();
  assert.equal(data.code,'AI_PROVIDER_KEY_REJECTED');
  assert.doesNotMatch(JSON.stringify(data),/provider-private-debug-info/);
 }finally{globalThis.fetch=old;}
});
