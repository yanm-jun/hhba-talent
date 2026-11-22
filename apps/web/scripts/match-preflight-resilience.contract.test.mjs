import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkMatchProviderCapabilities} from '../functions/_lib/match-provider-preflight.js';
import {planAutonomousMainlandSearch} from '../functions/_lib/autonomous-mainland-search.js';
import {runAgentOwnedMainlandMatch} from '../functions/_lib/ai-owned-job-research.js';

function checkable(fetchOverrides={}){
 const calls=[];
 const fetcher=async(url,options={})=>{
  const path=new URL(url).pathname;
  calls.push({path,body:options.body?JSON.parse(options.body):undefined});
  if(fetchOverrides[path])return fetchOverrides[path](options);
  return new Response(JSON.stringify(path==='/user/balance'?{is_available:true}:
   path==='/v1/tools/search'?{results:[]}:
   {status:'completed',output:[{type:'message',content:[{type:'output_text',text:'{"ok":true}'}]}]}),
   {status:200,headers:{'Content-Type':'application/json'}});
 };
 return {calls,fetcher};
}
test('candidate preflight probes balance, real Search and V4 Pro structured response without résumé data',async()=>{
 const {calls,fetcher}=checkable();
 const result=await checkMatchProviderCapabilities('synthetic-key-not-real',{fetcher});
 assert.deepEqual(result.capabilities,['balance','deepseek_search','v4_pro_responses_json']);
 assert.deepEqual(calls.map(x=>x.path).sort(),[
  '/user/balance','/v1/tools/search','/responses'].sort());
 assert.equal(calls.find(x=>x.path==='/v1/tools/search').body.count,1);
 assert.equal(calls.find(x=>x.path==='/v1/tools/search').body.need_content,false);
 assert.ok(calls.every(x=>!JSON.stringify(x.body||'').includes('my private CV')));
 assert.equal(calls.find(x=>x.path==='/responses').body.model,'deepseek-v4-pro');
 assert.equal(calls.find(x=>x.path==='/responses').body.text.format.type,'json_object');
});
test('configured balance is not enough if Search API access is missing or malformed',async()=>{
 for(const [status,code] of [[401,'AI_PROVIDER_KEY_REJECTED'],
  [400,'AI_SEARCH_API_REJECTED'],[429,'AI_PROVIDER_RATE_LIMITED'],
  [502,'AI_PROVIDER_UNAVAILABLE']]){
  const {fetcher}=checkable({'/v1/tools/search':()=>new Response('{}',{status})});
  await assert.rejects(checkMatchProviderCapabilities('synthetic',{fetcher}),
   e=>e.code===code);
 }
 const {fetcher}=checkable({'/v1/tools/search':()=>new Response('{"data":[]}',{status:200})});
 await assert.rejects(checkMatchProviderCapabilities('synthetic',{fetcher}),
  e=>e.code==='AI_SEARCH_RESPONSE_INVALID');
});
test('preflight catches incompatible model Responses config before candidate attempts full job search',async()=>{
 const {fetcher}=checkable({'/responses':()=>new Response('{}',{status:400})});
 await assert.rejects(checkMatchProviderCapabilities('synthetic',{fetcher}),
  e=>e.code==='AI_PROVIDER_REQUEST_REJECTED');
});

test('an HTTP 200 without a completed valid JSON answer must NOT pass provider readiness',async()=>{
 const cases=[
  {status:'incomplete',output:[{type:'message',content:[{type:'output_text',text:'{"ok":true}'}]}]},
  {status:'completed',output:[{type:'reasoning',content:[{type:'reasoning_text',text:'analysis'}]}]},
  {status:'completed',output:[{type:'message',content:[{type:'output_text',text:'not JSON'}]}]},
  {status:'completed',output:[{type:'message',content:[{type:'output_text',text:'{"ok":false}'}]}]},
  {status:'completed',output:[]},
  {status:'failed',output:[{type:'message',content:[{type:'output_text',text:'{"ok":true}'}]}]}
 ];
 for(const payload of cases){
  const {fetcher}=checkable({'/responses':()=>new Response(JSON.stringify(payload),{status:200})});
  await assert.rejects(checkMatchProviderCapabilities('synthetic',{fetcher}),
   err=>err.code==='AI_PROVIDER_RESPONSE_INVALID');
 }
});

test('no balance and unreadable model payload are reported as distinct failures',async()=>{
 const noBalance=checkable({'/user/balance':()=>new Response('{"is_available":false}',{status:200})});
 await assert.rejects(checkMatchProviderCapabilities('synthetic',{fetcher:noBalance.fetcher}),
  e=>e.code==='AI_PROVIDER_BALANCE_INSUFFICIENT');
 const badModel=checkable({'/responses':()=>new Response('{"status":"failed","output":[]}',{status:200})});
 await assert.rejects(checkMatchProviderCapabilities('synthetic',{fetcher:badModel.fetcher}),
  e=>e.code==='AI_PROVIDER_RESPONSE_INVALID');
});
test('planner HTTP 400/401/402/429 rejection retains provider error, never silently becomes keyword fallback',async()=>{
 const cases=[[400,'AI_PROVIDER_REQUEST_REJECTED'],[401,'AI_PROVIDER_KEY_REJECTED'],
  [402,'AI_PROVIDER_BALANCE_INSUFFICIENT'],[429,'AI_PROVIDER_RATE_LIMITED']];
 for(const [status,code] of cases){
  await assert.rejects(planAutonomousMainlandSearch('synthetic','candidate CV','',{
   fetcher:async()=>new Response('{}',{status})}),e=>e.code===code);
  let searched=false;
  await assert.rejects(runAgentOwnedMainlandMatch('synthetic','candidate CV','',10,
   {expandDetailed:false},{
    plan:async()=>{const error=new Error(code);error.code=code;throw error},
    search:async()=>{searched=true;return {hits:[]}}
   }),e=>e.code===code);
  assert.equal(searched,false,'with no recognized target role, a rejected plan does not trigger a preset search');
 }
});
test('agent reflective model permission failure is not disguised as zero valid jobs',async()=>{
 const source={id:'j1',title:'华东汽车公司 渠道督导 上海 招聘',
  source:'华东汽车公司',
  url:'https://careers.chinacorp.cn/jobs/channel-supervisor',
  summary:'华东汽车公司招聘渠道督导。工作地点：上海。岗位职责：分析经销商销售流程、培训一线团队。',
  availability:{status:'UNKNOWN'}};
 await assert.rejects(runAgentOwnedMainlandMatch('synthetic',
  '渠道督导业务培训经验','',10,{
   fetcher:async()=>new Response('{}',{status:402}),expandDetailed:false
  },{
   plan:async()=>({queries:['渠道督导 上海 企业招聘']}),
   search:async()=>({hits:[source],diagnostic:{successful_searches:1,raw_results:1}})
  }),e=>e.code==='AI_PROVIDER_BALANCE_INSUFFICIENT');
});
test('authenticated provider diagnostics remain available without gating a candidate match',()=>{
 const page=readFileSync(new URL('../src/pages/CandidateMatchPage.tsx',import.meta.url),'utf8');
 const route=readFileSync(new URL('../functions/api/match-native/[[path]].js',import.meta.url),'utf8');
 assert.doesNotMatch(page,/checkMatchProviderConnection/);
 assert.match(page,/await submitExtractedResumeText\(/);
 assert.match(route,/candidateSession\(env,request\)/);
 assert.match(route,/await checkMatchProviderCapabilities\(env\.HHBA_MATCH_DEEPSEEK_KEY\)/);
 assert.match(route,/return fail\(code,502\)/);
 assert.ok(!route.includes('providerCheck(env.HHBA_MATCH_DEEPSEEK_KEY)'));
});

test('default authenticated Cloudflare SSE route genuinely runs model-owned plan→Search→decision→shortlist without a legacy-only mock',async()=>{
 const {onRequest}=await import('../functions/api/match-native/[[path]].js');
 const original=globalThis.fetch,calls=[];
 const url='https://careers.xingyuan-auto.cn/jobs/regional-supervisor-2026';
 const job={id:'j1',company:'星源汽车有限公司',title:'区域渠道督导',location:'上海',
  match_score:81,score_basis:'这份简历记载了对经销商日常销售流程的真实管理、客户线索复盘以及区域团队培训经历，可对照企业区域督导岗位职责，但具体任职资格需在官网核实。',
  reason:'简历中的经销商门店督导、销售培训及线索转化复盘经验与岗位的渠道管理职责方向相关。建议重点整理跨店辅导的实际结果，查看企业官网中的任职经验要求并核对是否在招聘。',
  job_basis:'区域经销商管理、门店辅导和销售培训'};
 const modelReply=payload=>new Response(JSON.stringify({status:'completed',
  output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(payload)}]}]}),
  {status:200,headers:{'Content-Type':'application/json'}});
 globalThis.fetch=async(uri,config)=>{
  const path=new URL(uri).pathname;
  calls.push({path,body:config?.body?JSON.parse(config.body):null});
  if(path==='/v1/tools/search')
   return new Response(JSON.stringify({results:[{title:'星源汽车有限公司 区域渠道督导 上海 招聘',
    url,site_name:'星源汽车有限公司',snippet:'星源汽车有限公司区域渠道督导 工作地点：上海',
    summary:'星源汽车有限公司招聘区域渠道督导。工作地点：上海。岗位职责：区域经销商管理、门店培训与线索转化复盘。任职要求具有渠道销售沟通能力。'}]}),
    {status:200});
  if(path==='/responses'){
   const input=String(JSON.parse(config.body).input||'');
   if(JSON.parse(config.body).instructions.includes('HHBA 的简历识别 Agent'))
    return modelReply({facts:[{kind:'work',quote:'负责门店流程改善'}]});
   if(input.includes('已脱敏且用户授权用于分析的简历'))
    return modelReply({queries:['星源汽车 区域渠道督导 上海 企业官网招聘'],strategy:'渠道岗位'});
   if(input.includes('已有真实招聘证据'))
    return modelReply({actions:[{type:'finish'}],shortlist_ids:['j1'],rationale:'已经找到直接岗位证据'});
   if(JSON.parse(config.body).stream===true){
    const rows={jobs:[job]};
    const response={status:'completed',output:[
     {type:'message',content:[{type:'output_text',text:JSON.stringify(rows)}]}]};
    const events=[{type:'response.output_text.delta',delta:JSON.stringify(rows)},
     {type:'response.completed',response}].map(x=>'event: '+x.type+'\ndata: '+JSON.stringify(x)+'\n\n').join('');
    return new Response(events,{status:200,headers:{'Content-Type':'text/event-stream'}});
   }
   return modelReply({jobs:[{id:'search-j1',reason:job.reason}]});
  }
  throw Error('Unexpected outbound URL '+uri);
 };
 const db={prepare(sql){return {bind(){return {
  async first(){
   if(sql.includes('hhba_auth_sessions'))return {phone:'13800000000',revoked:0,
    expires_at:new Date(Date.now()+3600000).toISOString()};
   if(sql.includes('hhba_auth_users'))return {role:'candidate',phone:'13800000000'};
   throw Error('unused D1 lookup');
  },async run(){return {success:true}}
 }}}}};
 const env={HHBA_MATCH_SERVICE_ENABLED:'1',
  HHBA_MATCH_DEEPSEEK_KEY:'synthetic-test-secret-not-production',
  HHBA_AI_OWNED_RESEARCH_ENABLED:'1',
  HHBA_AGENT_CHECKPOINT_ENABLED:'0',
  HHBA_DOMESTIC_EVIDENCE_RESEARCH_ENABLED:'0',
  HHBA_MATCH_JD_ENRICH_ENABLED:'0',HHBA_PNVS_AUTH_DB:db};
 try{
  const request=new Request('https://hhba.example/api/match-native/resume',{
   method:'POST',headers:{Origin:'https://hhba.example',
    Authorization:'Bearer synthetic-client-token',
    Accept:'text/event-stream','Content-Type':'application/json'},
   body:JSON.stringify({text:'经销商区域门店督导，DCC 管理、线索转化数据分析与团队培训。负责门店流程改善。',
    consent:true,options:{country:'CN',remote_only:false,role_hint:'',limit:10}})
  });
  const response=await onRequest({request,env});
  assert.equal(response.status,200);
  const events=await response.text();
  assert.match(events,/event: activity/,'Agent must report actual actions');
  assert.match(events,/event: progress/);
  assert.match(events,/event: complete/);
  assert.doesNotMatch(events,/event: failure/);
  assert.match(events,/星源汽车有限公司/);
  assert.match(events,/HHBA_MAINLAND_AI_OWNED_RESEARCH_V1/);
  assert.ok(calls.some(x=>x.path==='/responses'&&
   String(x.body?.input||'').includes('已有真实招聘证据')));
  assert.ok(calls.some(x=>x.path==='/v1/tools/search'));
  assert.ok(!calls.some(x=>String(x.body?.query||'').includes('经销商区域门店督导')),
   'public query must not leak exact CV text');
 }finally{globalThis.fetch=original}
});
