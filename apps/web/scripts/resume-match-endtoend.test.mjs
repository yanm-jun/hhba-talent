// End-to-end synthetic contract: Cloudflare Pages route -> real-auth DB contract
// -> audited assets -> platform-owned DeepSeek HTTP -> conservative Top 10.
import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest} from '../functions/api/match/[[path]].js';
const origin='https://hhba.example';
function setup({role='candidate',open=true,stale=false,hasSecrets=true,allowResume=true,liveSearch=false}={}){
 const iso=new Date().toISOString(),callCounts={provider:0,asset:0};
 const id='11111111-1111-4111-8111-111111111111';
 const phone='13800000000',ledger=[];
 const job={id:'ashby-acme-a1b2c3d4',company:'Acme Inc',title:'Python Data Analyst',location:'Shanghai, China',
  url:'https://jobs.ashbyhq.com/acme/a1b2c3d4',source:'acme',platform:'ashby',remote:true};
 const auditRow={job_id:job.id,platform:job.platform,status:'OFFICIAL_JD_AND_REQUIREMENTS_FOUND',
  full_original_jd_verified:true,requirements_evidence:true,jd_sha256:'testhash'};
 const jobs={updated:stale?'2020-01-01T00:00:00.000Z':iso,jobs:[job],total:1};
 const audit={summary:{kind:'HHBA_OFFICIAL_FULL_JOB_JD_AUDIT_V1',indexed_as_of:jobs.updated,
  checked_at:iso},jobs:[auditRow]};
 const facets={indexed_as_of:jobs.updated,verified_at:iso,jobs:[{
  id:job.id,original_source_hash:'testhash',countryCode:'CN',cityKey:'shanghai',skills:['python'],
  education:null,experienceMinYears:null}]};
 const documents={'/data/jobs.json':jobs,'/data/job-sync-status.json':audit,'/data/job-search-facets.json':facets};
 const db={prepare(sql){
  return {async first(){
   if(sql.includes('sqlite_master'))return {name:sql.includes('hhba_external_search_requests')?'hhba_external_search_requests':'hhba_resume_match_requests'};
   throw Error('unexpected unbound first statement');
  },bind(...args){return {
   async first(){
    if(sql.includes("sqlite_master"))return {name:sql.includes('hhba_external_search_requests')?'hhba_external_search_requests':'hhba_resume_match_requests'};
    if(sql.includes('FROM hhba_auth_sessions'))return {phone,revoked:0,expires_at:new Date(Date.now()+3600000).toISOString()};
    if(sql.includes('FROM hhba_auth_users'))return {phone,role};
    if(sql.includes('FROM hhba_candidate_resumes'))return allowResume?{id}:null;
    if(sql.includes('COUNT(*) AS n FROM hhba_resume_match_requests'))return {n:ledger.length};
    throw Error('unexpected first statement');
   },
   async run(){
    if(sql.startsWith('UPDATE hhba_auth_sessions'))return {success:true,meta:{changes:1}};
    if(sql.startsWith('DELETE FROM hhba_resume_match_requests')){
     const n=ledger.findIndex(x=>x.id===args[0]&&x.day===args[1]&&x.hash===args[2]);
     if(n>=0)ledger.splice(n,1);
     return {success:true,meta:{changes:n>=0?1:0}};
    }
    if(sql.startsWith('INSERT INTO hhba_external_search_requests'))return {success:true,meta:{changes:1}};
    if(sql.startsWith('INSERT INTO hhba_resume_match_requests')){
     const day=args[1],hash=args[2];
     if(ledger.filter(x=>x.day===day).length>=240||ledger.filter(x=>x.day===day&&x.hash===hash).length>=8)
      return {success:true,meta:{changes:0}};
     ledger.push({id:args[0],day,hash});
     return {success:true,meta:{changes:1}};
    }
    throw Error('unexpected run statement');
   }
  }}}
 }};
 const env={
  HHBA_MATCH_SERVICE_ENABLED:open?'1':'0',
  HHBA_MATCH_EXTERNAL_SEARCH_ENABLED:liveSearch?'1':'0',
  HHBA_AUTH_ROLLOUT:liveSearch?'preview':'disabled',
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
   options:{country:'CN',remote_only:false,role_hint:'Data Analyst',limit:10,...options}});
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
  if(String(input)==='https://api.deepseek.com/v1/tools/search'){
   return new Response(JSON.stringify({results:[{
    title:'AI产品经理 - 示例科技',
    url:'https://careers.examplecorp.com/jobs/ai-product-2026-001',
    summary:'工作地点：济南。岗位职责：AI 产品设计、任务流程与项目验收。'
   }]}),{status:200,headers:{'Content-Type':'application/json'}});
  }
  if(String(input)==='https://api.deepseek.com/v1/tools/fetch'){
   return new Response(JSON.stringify({
    title:'AI产品经理 | 示例科技',
    content:'# AI产品经理\n工作地点：济南\n岗位职责：负责 AI Agent 产品需求、原型设计、测试与上线验收。\n任职要求：本科及以上学历。'
   }),{status:200,headers:{'Content-Type':'application/json'}});
  }
  assert.equal(String(input),'https://api.deepseek.com/chat/completions');
  const body=JSON.parse(opts.body);
  assert.equal(body.model,'deepseek-flash');
  assert.equal(opts.redirect,'manual','Cloudflare Workers rejects redirect:error');
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
  assert.equal(h.callCounts.provider,2,'one resume analysis and one batched explanation');
  assert.ok(typeof data.matches[0].recommendation_reason==='string');
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
test('quota rejects the ninth account request without a ninth provider invocation',async()=>{
 const h=setup(),restore=mockedAI(h.callCounts);
 try{
  for(let i=0;i<8;i++)assert.equal(
   (await onRequest({request:h.request(),env:h.env})).status,200);
  const ninth=await onRequest({request:h.request(),env:h.env});
  assert.equal(ninth.status,429);
  assert.equal((await ninth.json()).error,'MATCH_PERSONAL_LIMIT');
  assert.equal(h.ledger.length,8);
  assert.equal(h.callCounts.provider,16,'eight successful matches, eight explanation calls');
 }finally{restore();}
});
test('provider errors return no false recommendation and keep budget reserved',async()=>{
 const h=setup(),restore=mockedAI(h.callCounts,{fail:true});
 try{
  const response=await onRequest({request:h.request(),env:h.env});
  assert.equal(response.status,502);
  assert.equal((await response.json()).error,'AI_PROVIDER_UPSTREAM_ERROR');
  assert.equal(h.ledger.length,1);
 }finally{restore();}
});

test('chunked JSON above 100 KB is rejected before the asset index and provider',async()=>{
 const h=setup(),restore=mockedAI(h.callCounts);
 try{
  const stream=new ReadableStream({start(ctrl){ctrl.enqueue(new TextEncoder().encode('{"text":"'+ 'Z'.repeat(110000)+'"}'));ctrl.close();}});
  const req=new Request(origin+'/api/match/resume',{method:'POST',
   headers:{Origin:origin,Authorization:'Bearer synthetic-client-token','Content-Type':'application/json'},
   body:stream,duplex:'half'});
  const response=await onRequest({request:req,env:h.env});
  assert.equal(response.status,413);
  assert.equal((await response.json()).error,'INVALID_RESUME_TEXT');
  assert.equal(h.callCounts.asset,0);
  assert.equal(h.callCounts.provider,0);
  assert.equal(h.ledger.length,0);
 }finally{restore();}
});
test('invalid UTF-8 request never touches the AI provider',async()=>{
 const h=setup(),restore=mockedAI(h.callCounts);
 try{
  const stream=new ReadableStream({start(ctrl){ctrl.enqueue(new Uint8Array([255,254,253]));ctrl.close();}});
  const req=new Request(origin+'/api/match/resume',{method:'POST',
   headers:{Origin:origin,Authorization:'Bearer synthetic-client-token','Content-Type':'application/json'},
   body:stream,duplex:'half'});
  const response=await onRequest({request:req,env:h.env});
  assert.equal(response.status,400);
  assert.equal(h.callCounts.provider,0);
  assert.equal(h.ledger.length,0);
 }finally{restore();}
});


test('wrong DeepSeek key is classified and cannot consume a user trial',async()=>{
 const h=setup(),original=globalThis.fetch;
 globalThis.fetch=async()=>{h.callCounts.provider++;return new Response('not authorized',{status:401});};
 try{
  const response=await onRequest({request:h.request(),env:h.env});
  assert.equal(response.status,502);
  assert.equal((await response.json()).error,'AI_PROVIDER_KEY_REJECTED');
  assert.equal(h.ledger.length,0);
  assert.equal(h.callCounts.provider,1);
 }finally{globalThis.fetch=original;}
});
test('insufficient DeepSeek balance is a distinct error and refunds unbilled attempt',async()=>{
 const h=setup(),original=globalThis.fetch;
 globalThis.fetch=async()=>new Response('balance',{status:402});
 try{
  const response=await onRequest({request:h.request(),env:h.env});
  assert.equal(response.status,502);
  assert.equal((await response.json()).error,'AI_PROVIDER_BALANCE_INSUFFICIENT');
  assert.equal(h.ledger.length,0);
 }finally{globalThis.fetch=original;}
});
test('DeepSeek rejects request settings: safe diagnostic without leaking body',async()=>{
 const h=setup(),original=globalThis.fetch;
 globalThis.fetch=async()=>new Response('SECRET_RAW_PROVIDER_BODY',{status:400});
 try{
  const response=await onRequest({request:h.request(),env:h.env});
  assert.equal(response.status,502);
  const raw=await response.text();
  assert.match(raw,/AI_PROVIDER_REQUEST_REJECTED/);
  assert.doesNotMatch(raw,/SECRET_RAW_PROVIDER_BODY/);
  assert.equal(h.ledger.length,0);
 }finally{globalThis.fetch=original;}
});
test('provider timeout and throttling have safe separate codes, retain quota for uncertain calls',async()=>{
 const scenarios=[
  {status:429,code:'AI_PROVIDER_RATE_LIMITED',http:429},
  {status:503,code:'AI_PROVIDER_UPSTREAM_ERROR',http:502}
 ];
 for(const scenario of scenarios){
  const h=setup(),old=globalThis.fetch;
  globalThis.fetch=async()=>new Response('PRIVATE_PROVIDER_MESSAGE',{status:scenario.status});
  try{
   const response=await onRequest({request:h.request(),env:h.env});
   assert.equal(response.status,scenario.http);
   const body=await response.json();
   assert.equal(body.error,scenario.code);
   assert.equal(h.ledger.length,1);
  }finally{globalThis.fetch=old;}
 }
});


test('Preview authenticated provider diagnostic checks key and balance without quota or PII',async()=>{
 const h=setup(),old=globalThis.fetch;
 h.env.HHBA_AUTH_ROLLOUT='preview';
 let calls=0;
 globalThis.fetch=async (url,opts)=>{
  calls++;
  assert.equal(String(url),'https://api.deepseek.com/user/balance');
  assert.equal(opts.method,'GET');
  assert.equal(opts.redirect,'manual');
  return new Response(JSON.stringify({is_available:true,balance_infos:[{total_balance:'22.22'}]}),
   {status:200,headers:{'Content-Type':'application/json'}});
 };
 try{
  const unauthed=await onRequest({request:new Request(origin+'/api/match/provider-check'),env:h.env});
  assert.equal(unauthed.status,401);
  const req=new Request(origin+'/api/match/provider-check',
   {headers:{Authorization:'Bearer synthetic-client-token'}});
  const response=await onRequest({request:req,env:h.env});
  assert.equal(response.status,200);
  const raw=await response.text();
  assert.match(raw,/PROVIDER_BALANCE_AVAILABLE/);
  assert.doesNotMatch(raw,/22\.22/);
  assert.equal(calls,1);
  assert.equal(h.ledger.length,0);
 }finally{globalThis.fetch=old;}
});
test('Preview provider diagnostic reports 401 key and empty balance but not secrets',async()=>{
 const h=setup(),old=globalThis.fetch;
 h.env.HHBA_AUTH_ROLLOUT='preview';
 const req=()=>new Request(origin+'/api/match/provider-check',
  {headers:{Authorization:'Bearer synthetic-client-token'}});
 try{
  globalThis.fetch=async()=>new Response('RAW_SECRET_PROVIDER_MESSAGE',{status:401});
  const auth=await onRequest({request:req(),env:h.env});
  assert.equal(auth.status,502);
  const raw=await auth.text();
  assert.match(raw,/AI_PROVIDER_KEY_REJECTED/);
  assert.doesNotMatch(raw,/RAW_SECRET_PROVIDER_MESSAGE/);
  globalThis.fetch=async()=>new Response(JSON.stringify({is_available:false}),
   {status:200,headers:{'content-type':'application/json'}});
  const balance=await onRequest({request:req(),env:h.env});
  assert.equal((await balance.json()).error,'AI_PROVIDER_BALANCE_INSUFFICIENT');
  assert.equal(h.ledger.length,0);
  const prod=setup();prod.env.HHBA_AUTH_ROLLOUT='production';
  const disabled=await onRequest({request:req(),env:prod.env});
  assert.equal(disabled.status,404);
 }finally{globalThis.fetch=old;}
});


test('Workers-compatible fetch options prevent accidental outgoing secret redirects',async()=>{
 const {readFile}=await import('node:fs/promises');
 const source=await readFile(new URL('../functions/api/match/[[path]].js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/redirect\s*:\s*['"]error['"]/);
 assert.equal((source.match(/redirect:'manual'/g)||[]).length,2);
 const h=setup(),original=globalThis.fetch;
 globalThis.fetch=async (_url,options)=>{
  // Cloudflare Workers throws TypeError for redirect:error; fail if regression happens.
  if(options.redirect==='error')throw new TypeError('Unsupported redirect mode');
  assert.equal(options.redirect,'manual');
  return new Response(null,{status:302,headers:{Location:'https://unknown.example/steal'}});
 };
 try{
  const balanceEnv={...h.env,HHBA_AUTH_ROLLOUT:'preview'};
  const check=new Request(origin+'/api/match/provider-check',{
   headers:{Authorization:'Bearer synthetic-client-token'}});
  const response=await onRequest({request:check,env:balanceEnv});
  assert.equal(response.status,502);
  assert.equal((await response.json()).error,'AI_PROVIDER_REDIRECT_BLOCKED');
  assert.equal(h.ledger.length,0,'No quota should be used for free key status check');
  const match=await onRequest({request:h.request(),env:h.env});
  assert.equal((await match.json()).error,'AI_PROVIDER_REDIRECT_BLOCKED');
  assert.equal(h.ledger.length,0,'Never consume quota for provider redirects');
 }finally{globalThis.fetch=original;}
});


test('foreign-only job index blocks AI use and consumes no quota',async()=>{
 const h=setup(),old=globalThis.fetch;
 h.env.ASSETS.fetch=async req=>{
  const path=new URL(req.url).pathname;
  const at=new Date().toISOString();
  if(path==='/data/jobs.json')return new Response(JSON.stringify({updated:at,jobs:[]}),
   {headers:{'content-type':'application/json'}});
  return new Response('{}',{headers:{'content-type':'application/json'}});
 };
 try{
  const res=await onRequest({request:h.request(),env:h.env});
  assert.equal(res.status,503);
  assert.equal((await res.json()).error,'OFFICIAL_JOB_INDEX_UNAVAILABLE');
  assert.equal(h.ledger.length,0);
 }finally{globalThis.fetch=old;}
});
test('API rejects any country override before charging or model calls',async()=>{
 const h=setup(),old=globalThis.fetch;
 try{
  for(const country of ['US','SG','']){
   const res=await onRequest({request:h.request({options:{country}}),env:h.env});
   assert.equal(res.status,400);
  }
  assert.equal(h.ledger.length,0);
  assert.equal(h.callCounts.provider,0);
 }finally{globalThis.fetch=old;}
});


test('audited foreign-only index cannot spend AI quota or produce foreign jobs',async()=>{
 const h=setup(),oldAsset=h.env.ASSETS.fetch,oldFetch=globalThis.fetch;
 h.env.ASSETS.fetch=async req=>{
  const res=await oldAsset(req),path=new URL(req.url).pathname;
  if(!['/data/jobs.json','/data/job-search-facets.json'].includes(path))return res;
  const body=await res.json();
  if(path==='/data/jobs.json')body.jobs[0].location='San Francisco, USA';
  else body.jobs[0].countryCode='US';
  return new Response(JSON.stringify(body),{headers:{'content-type':'application/json'}});
 };
 globalThis.fetch=async()=>{h.callCounts.provider++;throw Error('Provider must not be used');};
 try{
  const response=await onRequest({request:h.request(),env:h.env});
  assert.equal(response.status,503);
  assert.equal((await response.json()).error,'NO_VERIFIED_DOMESTIC_JOBS');
  assert.equal(h.callCounts.provider,0);
  assert.equal(h.ledger.length,0);
 }finally{globalThis.fetch=oldFetch;}
});


test('one user action discovers a new company and returns job link and reason',async()=>{
 const h=setup({liveSearch:true}),restore=mockedAI(h.callCounts);
 try{
  const response=await onRequest({request:h.request({
   options:{role_hint:'AI产品经理'},
   textValue:'我负责 HHBA AI Agent 产品的需求分析、原型设计、工作流搭建、测试验收和产品上线，正在寻找 AI 产品经理职位。'
  }),env:h.env});
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.status,'COMPLETE');
  const found=body.matches.find(job=>job.source_type==='站外官方招聘');
  assert.ok(found,'searched external company should appear directly in Top10');
  assert.equal(found.official_url,'https://careers.examplecorp.com/jobs/ai-product-2026-001');
  assert.equal(found.location,'济南');
  assert.ok(found.recommendation_reason.length>5);
  assert.ok(h.callCounts.provider>=4);
  assert.equal(body.discovery_status,'COMPLETE');
 }finally{restore();}
});
