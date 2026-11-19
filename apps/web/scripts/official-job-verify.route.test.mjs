import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet,onRequestPost} from '../functions/api/official-job-verify.js';
const origin='https://preview.hhba.example';
const url='https://careers.tencent.com/jobdesc.html?postId=123456789012345';
const html=`<!doctype html><html><body>
<h1>数据分析师</h1><p>工作地点：上海</p><h2>岗位职责</h2>
<p>负责运营指标分析与跨部门协调，推动经营报表建设和分析业务变化。</p>
<h2>任职要求</h2><p>熟悉 Python、SQL，善于与业务团队沟通，有一定项目分析和总结能力。</p>
<button>立即投递</button></body></html>`;
function harness({enabled=true,role='candidate',migrated=true}={}){
 const rows=new Map(),quota=[];
 const db={prepare(sql){
  return {
   async all(){
    if(sql.includes('sqlite_master'))return {results:migrated?[
     {name:'hhba_official_job_evidence'},{name:'hhba_official_verify_requests'}]:[]};
    throw Error('unexpected all query');
   },
   bind(...args){return {
    async first(){
     if(sql.includes('FROM hhba_auth_sessions'))return {phone:'sample-account',
      expires_at:new Date(Date.now()+3600000).toISOString(),revoked:0};
     if(sql.includes('FROM hhba_auth_users'))return {phone:'sample-account',role};
     if(sql.includes('FROM hhba_official_job_evidence'))return rows.get(args[0])||null;
     throw Error('unexpected first query: '+sql);
    },
    async run(){
     if(sql.startsWith('UPDATE hhba_auth_sessions'))return {success:true,meta:{changes:1}};
     if(sql.includes('INSERT INTO hhba_official_verify_requests')){
      if(quota.length>=4)return {success:true,meta:{changes:0}};
      quota.push(args);return {success:true,meta:{changes:1}};
     }
     if(sql.includes('INSERT INTO hhba_official_job_evidence')){
      rows.set(args[1],{id:args[0],canonical_url:args[1],company:args[2],
       title:args[3],location:args[4],requirements:args[5],
       jd_hash:args[6],proof_method:args[7],checked_at:args[8]});
      return {success:true,meta:{changes:1}};
     }
     throw Error('unexpected run: '+sql);
    }
   }}
  };
 }};
 const env={HHBA_OFFICIAL_JOB_VERIFY_ENABLED:enabled?'1':'0',
  HHBA_AUTH_ROLLOUT:'preview',
  HHBA_MATCH_LIMIT_PEPPER:'strong-test-pepper-for-official-job-verification',
  HHBA_PNVS_AUTH_DB:db};
 function request(body={consent_verify:true,official_url:url},from=origin,auth=true){
  return new Request(origin+'/api/official-job-verify',{method:'POST',
   headers:{Origin:from,...(auth?{Authorization:'Bearer sample-session'}:{})},
   body:JSON.stringify(body)});
 }
 return {env,request,rows,quota};
}
test('feature and schema default to fail closed',async()=>{
 const off=harness({enabled:false});
 assert.equal((await (await onRequestGet({env:off.env})).json()).enabled,false);
 assert.equal((await onRequestPost({env:off.env,request:off.request()})).status,503);
 const missing=harness({migrated:false});
 assert.equal((await (await onRequestGet({env:missing.env})).json()).enabled,false);
 assert.equal((await onRequestPost({env:missing.env,request:missing.request()})).status,503);
});
test('reject cross-site, unauthenticated, unconsented, unsupported or noncandidate',async()=>{
 const h=harness();let externalCalls=0,old=globalThis.fetch;
 globalThis.fetch=async()=>{externalCalls++;throw Error('should not reach network')};
 try{
  assert.equal((await onRequestPost({env:h.env,request:h.request(undefined,'https://evil.example')})).status,403);
  assert.equal((await onRequestPost({env:h.env,request:h.request(undefined,origin,false)})).status,401);
  assert.equal((await onRequestPost({env:h.env,request:h.request({consent_verify:false,official_url:url})})).status,400);
  assert.equal((await onRequestPost({env:h.env,request:h.request({consent_verify:true,official_url:'https://example.com/join-us'})})).status,422);
  assert.equal(h.quota.length,0);assert.equal(externalCalls,0);
  const employer=harness({role:'employer'});
  assert.equal((await onRequestPost({env:employer.env,request:employer.request()})).status,403);
 }finally{globalThis.fetch=old;}
});
test('first request performs direct official GET; repeated request uses 24h cache with no new quota',async()=>{
 const h=harness(),old=globalThis.fetch;let externalCalls=0;
 globalThis.fetch=async(url,options)=>{
  assert.equal(url,'https://careers.tencent.com/jobdesc.html?postId=123456789012345');
  assert.equal(options.redirect,'manual');
  externalCalls++;
  return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8'}});
 };
 try{
  const first=await onRequestPost({env:h.env,request:h.request()});
  assert.equal(first.status,200);
  const data=await first.json();
  assert.equal(data.verified,true);assert.equal(data.company,'腾讯');
  assert.match(data.job_id,/^verified-official-[a-f0-9]{32}$/);
  assert.equal(data.from_cache,false);
  assert.equal(externalCalls,1);assert.equal(h.quota.length,1);
  const again=await (await onRequestPost({env:h.env,request:h.request()})).json();
  assert.equal(again.verified,true);
  assert.equal(again.from_cache,true);
  assert.equal(externalCalls,1);assert.equal(h.quota.length,1);
  assert.equal(h.rows.size,1);
 }finally{globalThis.fetch=old;}
});
test('blocked employer page is not stored as verified job or scored',async()=>{
 const h=harness(),old=globalThis.fetch;
 globalThis.fetch=async()=>new Response('请登录后查看',{headers:{'Content-Type':'text/html'}});
 try{
  const r=await onRequestPost({env:h.env,request:h.request()});
  assert.equal(r.status,422);
  const payload=await r.json();
  assert.equal(payload.error,'OFFICIAL_JD_NOT_VERIFIED');
  assert.equal(h.rows.size,0);
 }finally{globalThis.fetch=old;}
});
