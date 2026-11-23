import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {redactQaDiagnostic} from '../functions/_lib/clean-match-v2-qa-log.js';
import {onRequest} from '../functions/api/match-next/[[path]].js';

const KEY='synthetic-provider-key-never-real';
const PHONE='13911110000';
const QA_TOKEN='fixture-preview-operator-secret-longer-than-40-characters-123';
const QA_HASH=createHash('sha256').update(QA_TOKEN).digest('hex');
const JD_URL='https://careers.tencent.com/jobdesc.html?postId=2097166275703910400';
const QUOTE='负责汽车区域门店运营监督、渠道培训及销售漏斗复盘';
const JD=[
 '腾讯社会招聘','招聘单位：腾讯','职位名称：销售运营主管',
 '工作地点：上海','岗位职责：负责渠道运营和销售数据复盘工作',
 '任职要求：具有销售数据分析经验和跨团队协作能力',
 '申请说明：职位信息请以腾讯企业官方页面为准，实际开放状态待核验'
].join('\n');
const reply=data=>Response.json({status:'completed',output:[
 {type:'message',content:[{type:'output_text',text:JSON.stringify(data)}]}
]});

function fixtureEnv(flags={}){
 const writes=[],requests=[];
 const db={prepare(sql){
  return {async first(){
   if(sql.includes('sqlite_master')&&sql.includes('hhba_resume_match_requests'))
    return {name:'hhba_resume_match_requests'};
   return null;
  },bind(...args){
   return {
    async first(){
     if(sql.includes('FROM hhba_auth_sessions'))
      return {phone:PHONE,revoked:0,expires_at:new Date(Date.now()+60000).toISOString()};
     if(sql.includes('FROM hhba_auth_users'))return {phone:PHONE,role:'candidate'};
     if(sql.includes('sqlite_master')&&sql.includes('hhba_resume_match_requests'))
      return {name:'hhba_resume_match_requests'};
     if(sql.includes('FROM hhba_match_qa_tokens'))return args[0]===QA_HASH?{enabled:1}:null;
     return null;
    },
    async all(){return {results:[]}},
    async run(){
     writes.push({sql,args});return {success:true,meta:{changes:1}};
    }
   };
  }};
 }};
 return {env:{
  HHBA_MATCH_DEEPSEEK_KEY:KEY,
  HHBA_MATCH_SERVICE_ENABLED:'1',
  HHBA_PNVS_AUTH_DB:db,...flags
 },writes,requests};
}
function request(tail,options={}){
 return new Request('https://hhba.work/api/match-next'+tail,{
  ...options,headers:{Authorization:'Bearer test-candidate-token',
   Origin:'https://hhba.work',...options.headers}
 });
}
function previewRequest(tail,options={}){
 const origin='https://5f88e175.hhba-talent.pages.dev';
 return new Request(origin+'/api/match-next'+tail,{
  ...options,headers:{Authorization:'Bearer test-candidate-token',
   Origin:origin,...options.headers}
 });
}
function installProviderMock(){
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async (url,options={})=>{
  const path=new URL(url).pathname,body=options.body?JSON.parse(options.body):{};
  calls.push({path,body});
  if(path==='/user/balance')return Response.json({is_available:true});
  if(path==='/v1/tools/search')return Response.json({results:[{
   url:JD_URL,title:'腾讯 销售运营主管 上海职位',
   summary:'上海销售运营主管，渠道运营和销售数据复盘',
   site_name:'腾讯招聘'
  }]});
  if(path==='/v1/tools/fetch')return Response.json({content:JD,
   title:'腾讯销售运营主管'});
  if(path==='/responses'){
   const prompt=body.instructions||'';
   if(prompt.includes('健康检查'))return reply({ok:true});
   if(prompt.includes('简历识别 Agent'))return reply({
    facts:[{kind:'work',quote:QUOTE}],skills:[{name:'门店运营',evidence:QUOTE}],
    target_roles:['区域运营'],education:null,education_evidence:null,
    experience_years:null,experience_evidence:null
   });
   if(prompt.includes('检索策略'))return reply({queries:['区域督导 上海 职位详情 企业官网']});
   if(prompt.includes('提取真实公司'))return reply({jobs:[{
    id:'p1',company:'腾讯',title:'销售运营主管',
    duties_quote:'负责渠道运营和销售数据复盘工作',
    requirements_quote:'具有销售数据分析经验和跨团队协作能力'
   }]});
   if(prompt.includes('求职匹配分析师'))return reply({jobs:[{
    id:'p1',score:82,resume_fact_ids:['CV-1'],
    alignments:[{jd_quote:'负责渠道运营和销售数据复盘工作',
     resume_fact_id:'CV-1'}],
    gaps:[{jd_quote:'具有销售数据分析经验和跨团队协作能力'}],
    reason:'这份简历记载了区域门店运营、渠道培训和销售漏斗复盘的实际工作，与渠道运营和销售数据复盘职责存在明确的对应关系，但仍需核实其他岗位要求。',
    score_basis:'岗位职责要求渠道运营和销售数据复盘，而简历有门店管理及渠道培训的真实经历，但其他技能条件尚待核对。'
   }]});
   throw Error('unexpected model prompt');
  }
  throw Error('unexpected provider path '+path);
 };
 return {calls,restore(){globalThis.fetch=original}};
}

test('preview-only opt-in permits authenticated live preflight while matching stays disabled',async()=>{
 const {env}=fixtureEnv({HHBA_PREVIEW_AI_DIAG_ENABLED:'1'});
 const status=await (await onRequest({request:previewRequest('/status'),env})).json();
 assert.equal(status.enabled,false);
 assert.equal(status.preflight_available,true);
 let probeCalls=0;
 const previous=globalThis.fetch;
 globalThis.fetch=async(url,opts={})=>{
  probeCalls++;
  const path=new URL(url).pathname;
  if(path==='/user/balance')return Response.json({is_available:true});
  if(path==='/v1/tools/search')return Response.json({results:[]});
  if(path==='/responses')return reply({ok:true});
  if(path==='/v1/tools/fetch')return Response.json({content:
   'Provider Fetch returned verified public documentation content. '.repeat(3)});
  throw Error('unexpected '+path);
 };
 try{
  const unauthorized=await onRequest({request:new Request(
   'https://5f88e175.hhba-talent.pages.dev/api/match-next/provider-check'),env});
  assert.equal(unauthorized.status,401);
  assert.equal(probeCalls,0,'unauthenticated traffic must not incur provider spend');
  const preflight=await onRequest({request:previewRequest('/provider-check'),env});
  assert.equal(preflight.status,200);
  const data=await preflight.json();
  assert.equal(data.status,'READY');
  assert.equal(data.fetch_content_verified,true);
  assert.deepEqual(data.capabilities.sort(),[
   'balance','deepseek_fetch','deepseek_search','v4_pro_responses_json'].sort());
  assert.equal(probeCalls,4);
  const denied=await onRequest({request:previewRequest('/resume',{
   method:'POST',body:'{}'}),env});
  assert.equal(denied.status,503,'preflight can never unlock the public match API');
  assert.equal((await denied.json()).error,'MATCH_NOT_ENABLED');
 }finally{globalThis.fetch=previous}
});

test('production cannot opt into pre-launch probe without the real release gate',async()=>{
 for(const branch of ['main',undefined]){
  const {env}=fixtureEnv({CF_PAGES_BRANCH:branch,
   HHBA_PREVIEW_AI_DIAG_ENABLED:'1'});
  const status=await (await onRequest({request:request('/status'),env})).json();
  assert.equal(status.enabled,false);
  assert.equal(status.preflight_available,false);
  const res=await onRequest({request:request('/provider-check'),env});
  assert.equal(res.status,503);
  assert.equal((await res.json()).error,'MATCH_PREFLIGHT_NOT_ENABLED');
 }
});

test('authenticated synthetic résumé travels across actual V2 HTTP handler, Search, Fetch, evidence and private history',async()=>{
 const {env,writes}=fixtureEnv({CF_PAGES_BRANCH:'main',
  HHBA_MATCH_CLEAN_V2_ENABLED:'1'});
 const mocked=installProviderMock();
 try{
  const body={consent:true,
   text:'求职意向城市：上海\n工作经历：'+QUOTE+
    '\n联系邮箱：candidate@example.com，手机：13812345678',
   options:{country:'CN',remote_only:false,role_hint:'区域督导',limit:1}
  };
  const res=await onRequest({request:request('/resume',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify(body)
  }),env});
  assert.equal(res.status,200);
  const data=await res.json();
  assert.equal(data.status,'COMPLETE');
  assert.equal(data.native_search.visible_jobs,1);
  assert.equal(data.native_search.page_reads,1);
  assert.equal(data.matches.length,1);
  assert.equal(data.matches[0].official_url,JD_URL);
  assert.equal(data.matches[0].location,'上海');
  assert.equal(data.matches[0].match_score,82);
  assert.match(data.matches[0].matched[0],/岗位原文.*简历原文/);
  assert.equal(data.matches[0].jd_source_status,undefined,
   'unverified JD must never unlock Word editing');
  assert.equal(data.matched_official_jobs,0);
  assert.equal(data.history_status,'SAVED');
  const saved=writes.find(x=>x.sql.includes('INSERT INTO hhba_ai_match_history'));
  assert.ok(saved,'private recommendations are saved only after a real candidate session');
  assert.doesNotMatch(JSON.stringify(saved.args),/candidate@example\.com|13812345678|工作经历：/);
  assert.deepEqual([...new Set(mocked.calls.map(x=>x.path))].sort(),[
   '/responses','/v1/tools/fetch','/v1/tools/search'].sort());
  assert.doesNotMatch(JSON.stringify(mocked.calls),/candidate@example\.com|13812345678/);
  assert.ok(mocked.calls.some(x=>JSON.stringify(x.body).includes('邮箱已隐藏')),
   'model receives redacted résumé, not contact details');
 }finally{mocked.restore()}
});

test('provider credential failures never forge a vacancy or save a history entry',async()=>{
 const {env,writes}=fixtureEnv({CF_PAGES_BRANCH:'main',
  HHBA_MATCH_CLEAN_V2_ENABLED:'1'});
 const previous=globalThis.fetch;
 globalThis.fetch=async()=>new Response('invalid key',{status:401});
 try{
  const response=await onRequest({request:request('/resume',{
   method:'POST',body:JSON.stringify({consent:true,
    text:'求职意向城市：上海\n工作经历：'+QUOTE,
    options:{country:'CN',remote_only:false,role_hint:'区域督导',limit:1}})
  }),env});
  assert.equal(response.status,502);
  assert.equal((await response.json()).error,'AI_PROVIDER_KEY_REJECTED');
  assert.equal(writes.some(x=>x.sql.includes('hhba_ai_match_history')),false);
 }finally{globalThis.fetch=previous}
});
test('preview provider diagnostic requires explicit click and existing authorized candidate session',()=>{
 const page=readFileSync(new URL('../src/pages/CandidateMatchPage.tsx',import.meta.url),'utf8');
 const service=readFileSync(new URL('../src/services/resumeMatch.ts',import.meta.url),'utf8');
 assert.match(page,/preflightAvailable&&<div className="hhba-ai-preview-diagnostic">/);
 assert.match(page,/user&&getRealAuthToken\(\)\?<button/);
 assert.match(page,/onClick=\{\(\)=>void runPreviewPreflight\(\)\}/);
 assert.match(service,/window\.location\.hostname\.endsWith\('\.hhba-talent\.pages\.dev'\)/);
 assert.match(service,/data\.enabled===false&&data\.preflight_available===true/);
 assert.match(service,/fetch\(API\+'\/provider-check'/);
 assert.match(service,/headers:\{Authorization:'Bearer '\+token\}/);
 const probe=service.slice(service.indexOf('export async function runMatchPreviewProviderCheck'),
  service.indexOf('/** Best-effort browser redaction'));
 assert.doesNotMatch(probe,/resume_id|resume_facts|\bbody:JSON\.stringify/);
});


test('preview-only synthetic acceptance runs the actual search route and never stores a candidate history row',async()=>{
 const {env,writes}=fixtureEnv({HHBA_PREVIEW_AI_DIAG_ENABLED:'1'});
 const provider=installProviderMock();
 try{
  const response=await onRequest({request:previewRequest('/synthetic-check',{
   method:'POST',headers:{Accept:'text/event-stream','Content-Type':'application/json'},
   body:JSON.stringify({consent:true,scenario:'automotive_operations_v1'})
  }),env});
  assert.equal(response.status,200);
  assert.match(response.headers.get('content-type')||'',/text\/event-stream/);
  const body=await response.text();
  assert.match(body,/event: complete/);
  assert.match(body,/event: activity/);
  const complete=body.split('\n\n').filter(x=>x.startsWith('event: complete'))[0];
  assert.ok(complete,'the actual search workflow must complete');
  const result=JSON.parse(complete.slice(complete.indexOf('data: ')+6));
  assert.equal(result.preview_synthetic,true);
  assert.equal(result.status,'COMPLETE');
  assert.equal(result.history_status,'EMPTY');
  assert.equal(result.history_id,null);
  assert.ok(result.profile.facts.some(x=>x.quote===QUOTE));
  assert.equal(result.matches.length,1);
  assert.equal(result.matches[0].official_url,JD_URL);
  assert.equal(result.native_search.visible_jobs,1);
  assert.equal(result.native_search.jd_verification.not_ready,true);
  assert.ok(result.native_search.searches>=1);
  assert.ok(result.native_search.page_reads>=1);
  assert.ok(provider.calls.some(x=>x.path==='/v1/tools/search'));
  assert.ok(provider.calls.some(x=>x.path==='/v1/tools/fetch'));
  assert.equal(writes.some(x=>x.sql.includes('hhba_ai_match_history')),false,
   'preview-only synthetic test must never write private match history');
  assert.equal(writes.some(x=>x.sql.includes('hhba_resume_match_requests')),false,
   'preview QA must not depend on any per-account or global daily quota');
  assert.doesNotMatch(JSON.stringify(provider.calls),/candidate@example\.com|13812345678/);
 }finally{provider.restore()}
});

test('synthetic acceptance rejects no login, missing consent, unexpected payloads and production access without invoking paid provider',async()=>{
 const {env}=fixtureEnv({HHBA_PREVIEW_AI_DIAG_ENABLED:'1'});
 const old=globalThis.fetch;let paidCalls=0;
 globalThis.fetch=async()=>{paidCalls++;throw Error('unexpected paid call')};
 try{
  const noLogin=await onRequest({request:new Request(
   'https://5f88e175.hhba-talent.pages.dev/api/match-next/synthetic-check',{
    method:'POST',headers:{Origin:'https://5f88e175.hhba-talent.pages.dev'},
    body:JSON.stringify({consent:true,scenario:'automotive_operations_v1'})
   }),env});
  assert.equal(noLogin.status,401);
  const noConsent=await onRequest({request:previewRequest('/synthetic-check',{
   method:'POST',body:JSON.stringify({consent:false,scenario:'automotive_operations_v1'})
  }),env});
  assert.equal(noConsent.status,400);
  assert.equal((await noConsent.json()).error,'EXPLICIT_AI_SHARING_CONSENT_REQUIRED');
  for(const invalid of [{consent:true,scenario:'automotive_operations_v1',text:'real candidate CV'},
   {consent:true,scenario:'malicious'},{consent:true,scenario:'automotive_operations_v1',resume_id:'secret'}]){
   const denied=await onRequest({request:previewRequest('/synthetic-check',{
    method:'POST',body:JSON.stringify(invalid)
   }),env});
   assert.equal(denied.status,400);
   assert.equal((await denied.json()).error,'INVALID_SYNTHETIC_CHECK_REQUEST');
  }
  const production=await onRequest({request:request('/synthetic-check',{
   method:'POST',body:JSON.stringify({consent:true,scenario:'automotive_operations_v1'})
  }),env});
  assert.equal(production.status,503);
  assert.equal((await production.json()).error,'MATCH_SYNTHETIC_NOT_ENABLED');
  const wrongMethod=await onRequest({request:previewRequest('/synthetic-check'),env});
  assert.equal(wrongMethod.status,404);
  assert.equal(paidCalls,0);
 }finally{globalThis.fetch=old}
});

test('preview synthetic acceptance UI is clearly labeled and never sends a user résumé',()=>{
 const page=readFileSync(new URL('../src/pages/CandidateMatchPage.tsx',import.meta.url),'utf8');
 const service=readFileSync(new URL('../src/services/resumeMatch.ts',import.meta.url),'utf8');
 const route=readFileSync(new URL('../functions/api/match-next/[[path]].js',import.meta.url),'utf8');
 assert.match(page,/用虚构简历验证真实岗位搜索/);
 assert.match(page,/不是你的岗位推荐/);
 assert.match(page,/未达到 10 条目标/);
 assert.match(page,/syntheticResult\.native_search\?\.jd_verification\?\.verified/);
 assert.match(service,/isCleanV2PreviewHost\(\)/);
 assert.match(service,/body:JSON\.stringify\(\{consent:true,scenario:'automotive_operations_v1'\}\)/);
 assert.match(route,/preview_synthetic=true/);
 assert.match(route,/if\(!persistHistory\)/);
 assert.match(route,/if\(!previewPreflight\(env,request\)\)return fail\('MATCH_SYNTHETIC_NOT_ENABLED',503\)/);
 const fn=service.slice(service.indexOf('export async function runMatchPreviewSyntheticAcceptance'),
  service.indexOf('export async function submitExtractedResumeText'));
 assert.doesNotMatch(fn,/\bresumeId\b|resume_id|privateResume|file\.arrayBuffer/);
});



test('synthetic preview reruns are allowed without rate quota table, salt or calendar-day budget',async()=>{
 const {env,writes}=fixtureEnv({HHBA_PREVIEW_AI_DIAG_ENABLED:'1'});
 delete env.HHBA_MATCH_LIMIT_PEPPER;
 const originalPrepare=env.HHBA_PNVS_AUTH_DB.prepare.bind(env.HHBA_PNVS_AUTH_DB);
 env.HHBA_PNVS_AUTH_DB.prepare=sql=>{
  if(/hhba_resume_match_requests|quota|daily|v2qa:/i.test(sql))
   throw Error('synthetic preview must not touch any quota table');
  return originalPrepare(sql);
 };
 const provider=installProviderMock();
 try{
  for(let attempt=0;attempt<3;attempt++){
   const response=await onRequest({request:previewRequest('/synthetic-check',{
    method:'POST',headers:{Accept:'text/event-stream','Content-Type':'application/json'},
    body:JSON.stringify({consent:true,scenario:'automotive_operations_v1'})
   }),env});
   assert.equal(response.status,200,'same candidate may rerun synthetic QA repeatedly');
   const text=await response.text();
   const complete=text.split('\n\n').find(x=>x.startsWith('event: complete'));
   assert.ok(complete);
   const result=JSON.parse(complete.slice(complete.indexOf('data: ')+6));
   assert.equal(result.preview_synthetic,true);
   assert.equal(result.history_status,'EMPTY');
   assert.equal(result.matches.length,1);
  }
  assert.ok(provider.calls.filter(x=>x.path==='/v1/tools/search').length>=3);
  assert.equal(writes.some(x=>/hhba_ai_match_history|hhba_resume_match_requests/.test(x.sql)),false,
   'repeated synthetic QA may archive JD evidence but must not write candidate history or quota');
 }finally{provider.restore()}
});

test('synthetic QA UI re-enables its one-click button after a completed or failed run',()=>{
 const page=readFileSync(new URL('../src/pages/CandidateMatchPage.tsx',import.meta.url),'utf8');
 const route=readFileSync(new URL('../functions/api/match-next/[[path]].js',import.meta.url),'utf8');
 assert.doesNotMatch(page,/syntheticStarted|setSyntheticStarted/);
 assert.match(page,/disabled=\{syntheticBusy\}/);
 assert.match(page,/重新运行虚构简历岗位搜索/);
 assert.doesNotMatch(route,/reserveSyntheticAcceptance|MATCH_SYNTHETIC_LIMIT|MATCH_SYNTHETIC_QUOTA_UNAVAILABLE/);
 assert.match(route,/if\(!previewPreflight\(env,request\)\)return fail\('MATCH_SYNTHETIC_NOT_ENABLED',503\)/);
});


test('operator-run can independently execute the real matching pipeline and persist only anonymous QA stage logs',async()=>{
 const {env,writes}=fixtureEnv({HHBA_PREVIEW_AI_DIAG_ENABLED:'1'});
 const mock=installProviderMock();
 const origin='https://5f88e175.hhba-talent.pages.dev';
 try{
  const request=new Request(origin+'/api/match-next/operator-run',{
   method:'POST',headers:{Origin:origin,'X-HHBA-QA-Token':QA_TOKEN,
    'Content-Type':'application/json'},
   body:JSON.stringify({consent:true,scenario:'automotive_operations_v1'})
  });
  const response=await onRequest({request,env});
  assert.equal(response.status,200);
  const result=await response.json();
  assert.match(result.run_id,/^[0-9a-f-]{36}$/i);
  assert.equal(result.status,'COMPLETED_PARTIAL');
  assert.equal(result.summary.visible_jobs,1);
  assert.equal(result.summary.page_reads,1);
  assert.equal(result.matches[0].official_url,JD_URL);
  assert.ok(mock.calls.some(x=>x.path==='/v1/tools/search'));
  assert.ok(mock.calls.some(x=>x.path==='/v1/tools/fetch'));
  assert.ok(writes.some(x=>x.sql.includes('INSERT INTO hhba_match_qa_runs')));
  assert.ok(writes.some(x=>x.sql.includes('INSERT INTO hhba_match_qa_events')));
  assert.ok(writes.some(x=>x.sql.includes('UPDATE hhba_match_qa_runs')));
  assert.equal(writes.some(x=>x.sql.includes('hhba_ai_match_history')),false);
  assert.doesNotMatch(JSON.stringify(writes),/求职意向城市|岗位职责|候选人|手机号|QQ|candidate@example.com/);
  assert.equal(writes.some(x=>x.sql.includes('hhba_resume_match_requests')),false);
 }finally{mock.restore()}
});

test('operator routes cannot be invoked without operator token, on production, or with CV input',async()=>{
 const {env}=fixtureEnv({HHBA_PREVIEW_AI_DIAG_ENABLED:'1'});
 const origin='https://5f88e175.hhba-talent.pages.dev';
 const old=globalThis.fetch;let paid=0;
 globalThis.fetch=async()=>{paid++;throw Error('unauthorized paid request')};
 const post=(hostname,headers,body)=>new Request(
  hostname+'/api/match-next/operator-run',{method:'POST',
   headers:{Origin:hostname,'Content-Type':'application/json',...headers},
   body:JSON.stringify(body??{consent:true,scenario:'automotive_operations_v1'})});
 try{
  for(const headers of [{},{'X-HHBA-QA-Token':'short'},
   {'X-HHBA-QA-Token':'wrong-key-key-key-key-key-key-key-key-key-key-key-key'}]){
   const response=await onRequest({request:post(origin,headers),env});
   assert.equal(response.status,404);
  }
  const prod=await onRequest({request:post('https://hhba.work',
   {'X-HHBA-QA-Token':QA_TOKEN}),env});
  assert.equal(prod.status,404);
  const unauthorizedPayload=await onRequest({request:post(origin,
   {'X-HHBA-QA-Token':QA_TOKEN},{
    consent:true,scenario:'automotive_operations_v1',resume_id:'real-candidate-CV'
   }),env});
  assert.equal(unauthorizedPayload.status,400);
  const wrongOrigin=await onRequest({request:new Request(origin+'/api/match-next/operator-run',{
   method:'POST',headers:{Origin:'https://evil.example','X-HHBA-QA-Token':QA_TOKEN},
   body:JSON.stringify({consent:true,scenario:'automotive_operations_v1'})
  }),env});
  assert.equal(wrongOrigin.status,403);
  assert.equal(paid,0);
 }finally{globalThis.fetch=old}
});

test('QA audit sanitization rejects URLs, raw page text, names and malicious provider error strings',()=>{
 const x=redactQaDiagnostic({searches:16,search_raw_results:333,
  page_reads:20,fetch_failures:16,visible_jobs:0,
  user_phone:'13911110000',resume_text:'个人简历：秘密信息',url:'https://example.com',
  search_rejection_counts:{no_url:2,memo:'x',evil_label:'secret'},
  extraction_page_rejections:{work_city_missing:12},
  provider_error_codes:['AI_PROVIDER_TIMEOUT','https://secret.example/a','SECRET=KEY']});
 assert.equal(x.searches,16);
 assert.equal(x.search_raw_results,333);
 assert.equal(x.page_reads,20);
 assert.equal(x.rejection_counts.work_city_missing,12);
 assert.deepEqual(x.error_codes,['AI_PROVIDER_TIMEOUT']);
 assert.doesNotMatch(JSON.stringify(x),/13911110000|个人简历|example.com|secret/);
});


test('focused operator QA uses real Search/Fetch/JD extraction but not private history or unsupported score claims',async()=>{
 const {env,writes}=fixtureEnv({HHBA_PREVIEW_AI_DIAG_ENABLED:'1'});
 const mock=installProviderMock();
 const origin='https://5f88e175.hhba-talent.pages.dev';
 try{
  const response=await onRequest({request:new Request(origin+'/api/match-next/operator-run',{
   method:'POST',headers:{Origin:origin,'X-HHBA-QA-Token':QA_TOKEN,
    'Content-Type':'application/json'},
   body:JSON.stringify({consent:true,scenario:'automotive_operations_v1',
    mode:'focused',request_id:'d96592c5-f571-4f35-bddf-4d256fa4d1f5'})
  }),env});
  assert.equal(response.status,200);
  const output=await response.json();
  assert.equal(output.mode,'focused');
  assert.equal(output.status,'COMPLETED_PARTIAL');
  assert.equal(output.summary.searches,6);
  assert.equal(output.summary.page_reads,1);
  assert.equal(output.summary.extracted_jobs,1);
  assert.equal(output.summary.visible_jobs,1);
  assert.equal(output.matches[0].jd_source_status,'PARTIAL_SOURCE');
  assert.equal(output.matches[0].match_score,undefined);
  assert.ok(mock.calls.some(x=>x.path==='/v1/tools/search'));
  assert.ok(mock.calls.some(x=>x.path==='/v1/tools/fetch'));
  assert.equal(mock.calls.filter(x=>x.path==='/responses').length,1);
  assert.equal(writes.some(x=>x.sql.includes('hhba_ai_match_history')),false);
 }finally{mock.restore()}
});

test('operator retries with identical request_id cannot invoke the paid pipeline twice',async()=>{
 const {env}=fixtureEnv({HHBA_PREVIEW_AI_DIAG_ENABLED:'1'});
 const original=env.HHBA_PNVS_AUTH_DB.prepare.bind(env.HHBA_PNVS_AUTH_DB);
 const id='d96592c5-f571-4f35-bddf-4d256fa4d1f5';
 let begun=0;
 env.HHBA_PNVS_AUTH_DB.prepare=sql=>{
  if(sql.includes('INSERT INTO hhba_match_qa_runs'))return {
   bind(){return {async run(){
    begun++;if(begun>1)throw Error('UNIQUE constraint');
    return {success:true,meta:{changes:1}};
   }}}
  };
  if(sql.includes('SELECT id FROM hhba_match_qa_runs WHERE id=?'))return{
   bind(x){return{async first(){return{id:x}}}}
  };
  return original(sql);
 };
 const mock=installProviderMock();
 const origin='https://5f88e175.hhba-talent.pages.dev';
 const request=()=>new Request(origin+'/api/match-next/operator-run',{
  method:'POST',headers:{Origin:origin,'X-HHBA-QA-Token':QA_TOKEN,
   'Content-Type':'application/json'},
  body:JSON.stringify({consent:true,scenario:'automotive_operations_v1',
   mode:'focused',request_id:id})
 });
 try{
  assert.equal((await onRequest({request:request(),env})).status,200);
  const before=mock.calls.length;
  const replay=await onRequest({request:request(),env});
  assert.equal(replay.status,409);
  assert.deepEqual(await replay.json(),{run_id:id,status:'ALREADY_STARTED'});
  assert.equal(mock.calls.length,before);
 }finally{mock.restore()}
});
