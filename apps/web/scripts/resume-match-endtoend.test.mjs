// End-to-end synthetic contract: Cloudflare Pages route -> real-auth DB contract
// -> audited assets -> platform-owned DeepSeek HTTP -> conservative Top 10.
import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest} from '../functions/api/match/[[path]].js';
const origin='https://hhba.example';
function setup({role='candidate',open=true,stale=false,hasSecrets=true,allowResume=true}={}){
 const iso=new Date().toISOString(),callCounts={provider:0,asset:0};
 const id='11111111-1111-4111-8111-111111111111';
 const phone='13800000000',ledger=[];
 const job={id:'ashby-acme-a1b2c3d4',company:'Acme Inc',title:'Python Data Analyst',location:'Singapore',
  url:'https://jobs.ashbyhq.com/acme/a1b2c3d4',source:'acme',platform:'ashby',remote:true};
 const auditRow={job_id:job.id,platform:job.platform,status:'OFFICIAL_JD_AND_REQUIREMENTS_FOUND',
  full_original_jd_verified:true,requirements_evidence:true,jd_sha256:'testhash'};
 const jobs={updated:stale?'2020-01-01T00:00:00.000Z':iso,jobs:[job],total:1};
 const audit={summary:{kind:'HHBA_OFFICIAL_FULL_JOB_JD_AUDIT_V1',indexed_as_of:jobs.updated,
  checked_at:iso},jobs:[auditRow]};
 const facets={indexed_as_of:jobs.updated,verified_at:iso,jobs:[{
  id:job.id,original_source_hash:'testhash',countryCode:'SG',skills:['python'],
  education:null,experienceMinYears:null}]};
 const documents={'/data/jobs.json':jobs,'/data/job-sync-status.json':audit,'/data/job-search-facets.json':facets};
 const db={prepare(sql){
  return {bind(...args){return {
   async first(){
    if(sql.includes("sqlite_master"))return {name:'hhba_resume_match_requests'};
    if(sql.includes('FROM hhba_auth_sessions'))return {phone,revoked:0,expires_at:new Date(Date.now()+3600000).toISOString()};
    if(sql.includes('FROM hhba_auth_users'))return {phone,role};
    if(sql.includes('FROM hhba_candidate_resumes'))return allowResume?{id}:null;
    if(sql.includes('COUNT(*) AS n FROM hhba_resume_match_requests'))return {n:ledger.length};
    throw Error('unexpected first statement');
   },
   async run(){
    if(sql.startsWith('UPDATE hhba_auth_sessions'))return {success:true,meta:{changes:1}};
    if(sql.startsWith('INSERT INTO hhba_resume_match_requests')){
     const day=args[1],hash=args[2];
     if(ledger.filter(x=>x.day===day).length>=60||ledger.filter(x=>x.day===day&&x.hash===hash).length>=2)
      return {success:true,meta:{changes:0}};
     ledger.push({day,hash});
     return {success:true,meta:{changes:1}};
    }
    throw Error('unexpected run statement');
   }
  }}}
 }};
 const env={
  HHBA_MATCH_SERVICE_ENABLED:open?'1':'0',
  HHBA_MATCH_DEEPSEEK_KEY:hasSecrets?'synthetic-secret-0123456789':undefined,
  HHBA_MATCH_LIMIT_PEPPER:hasSecrets?'synthetic-pepper-with-32-chars-123456789':undefined,
  HHBA_PNVS_AUTH_DB:db,
  ASSETS:{async fetch(request){
   callCounts.asset++;
   const path=new URL(request.url).pathname;
   const body=documents[path];
   if(!body)return new Response('missing',{status:404});
   return new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});
  }}
 };
 const text='姓名：测试用户，手机 13812345678，邮箱 test.person@example.com。技能：Python。目标职位 Data Analyst。';
 function request({agree=true,resume=id,options={},textValue=text,targetOrigin=origin}={}){
  const body=JSON.stringify({resume_id:resume,text:textValue,consent:agree,
   options:{country:'SG',remote_only:false,role_hint:'Data Analyst',limit:10,...options}});
  return new Request(origin+'/api/match/resume',{method:'POST',
   headers:{Origin:targetOrigin,Authorization:'Bearer synthetic-client-token',
    'Content-Type':'application/json'},body});
 }
 const status=()=>new Request(origin+'/api/match/status');
 return {request,status,env,callCounts,ledger,id,text};
}
function mockedAI(counter,{fail=false}={}){
 const original=globalThis.fetch;
 globalThis.fetch=async (input,opts)=>{
  counter.provider++;
  assert.equal(String(input),'https://api.deepseek.com/chat/completions');
  const body=JSON.parse(opts.body);
  assert.equal(body.model,'deepseek-flash');
  assert.equal(body.thinking.type,'disabled');
  const submitted=body.messages[1].content;
  assert.doesNotMatch(submitted,/13812345678|test\.person@example\.com/);
  if(fail)return new Response('provider unavailable',{status:503});
  return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({
   education:null,education_evidence:null,experience_years:null,experience_evidence:null,
   skills:[{name:'Python',evidence:'技能：Python'}],target_roles:['Data Analyst']
  })}}]}),{status:200,headers:{'Content-Type':'application/json'}});
 };
 return ()=>{globalThis.fetch=original;};
}
test('synthetic logged-in candidate gets grounded live snapshot match',async()=>{
 const h=setup(),restore=mockedAI(h.callCounts);
 try{
  const health=await onRequest({request:h.status(),env:h.env});
  assert.equal((await health.json()).enabled,true);
  const response=await onRequest({request:h.request(),env:h.env});
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.status,'COMPLETE');
  assert.equal(data.matches.length,1);
  assert.equal(data.matches[0].id,'ashby-acme-a1b2c3d4');
  assert.equal(data.matches[0].source_type,'HHBA站内岗位');
  assert.equal(data.profile.skills[0].name,'Python');
  assert.ok(!JSON.stringify(data).includes('13812345678'));
  assert.equal(h.ledger.length,1);
  assert.equal(h.callCounts.provider,1);
 }finally{restore();}
});
test('consent, cross-origin, wrong owner and blocked role stop before provider',async()=>{
 const h=setup(),restore=mockedAI(h.callCounts);
 try{
  assert.equal((await onRequest({request:h.request({agree:false}),env:h.env})).status,400);
  assert.equal((await onRequest({request:h.request({targetOrigin:'https://evil.example'}),env:h.env})).status,403);
  assert.equal((await onRequest({request:h.request({resume:'22222222-2222-4222-8222-222222222222'}),env:{
   ...h.env,HHBA_PNVS_AUTH_DB:setup({allowResume:false}).env.HHBA_PNVS_AUTH_DB
  }})).status,404);
  const employer=setup({role:'employer'});
  assert.equal((await onRequest({request:employer.request(),env:employer.env})).status,403);
  assert.equal(h.callCounts.provider,0);
  assert.equal(h.ledger.length,0);
 }finally{restore();}
});
test('stale official evidence and disabled config fail closed and never spend',async()=>{
 const stale=setup({stale:true}),disabled=setup({open:false}),restore=mockedAI(stale.callCounts);
 try{
  assert.equal((await onRequest({request:stale.request(),env:stale.env})).status,503);
  assert.equal((await onRequest({request:disabled.request(),env:disabled.env})).status,503);
  assert.equal(stale.ledger.length,0);
  assert.equal(stale.callCounts.provider,0);
 }finally{restore();}
});
test('quota rejects the third account request with no provider invocation',async()=>{
 const h=setup(),restore=mockedAI(h.callCounts);
 try{
  assert.equal((await onRequest({request:h.request(),env:h.env})).status,200);
  assert.equal((await onRequest({request:h.request(),env:h.env})).status,200);
  const third=await onRequest({request:h.request(),env:h.env});
  assert.equal(third.status,429);
  assert.equal((await third.json()).error,'MATCH_PERSONAL_LIMIT');
  assert.equal(h.ledger.length,2);
  assert.equal(h.callCounts.provider,2);
 }finally{restore();}
});
test('provider errors return no false recommendation and keep budget reserved',async()=>{
 const h=setup(),restore=mockedAI(h.callCounts,{fail:true});
 try{
  const response=await onRequest({request:h.request(),env:h.env});
  assert.equal(response.status,502);
  assert.equal((await response.json()).error,'AI_PROVIDER_UNAVAILABLE');
  assert.equal(h.ledger.length,1);
 }finally{restore();}
});
