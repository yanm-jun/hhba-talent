import test from 'node:test';
import assert from 'node:assert/strict';
import {safeJobDetailLink,parseJobAnswer,wasWebSearched,outputText,partialJobMatchesFromText,decodeSearchText} from '../functions/_lib/deepseek-native-match.js';
import {runNativeJobMatch,runNativeDualMatch,combineNativeBatches,onRequest} from '../functions/api/match-native/[[path]].js';
import {buildDeepSearchRequest,verifiedDeepSearchMatches,runAutonomousDeepMatch} from '../functions/_lib/deepseek-autonomous-match.js';
const posting='https://careers.examplecorp.com/jobs/brand-supervisor-2026';
const answer={jobs:[
 {company:'示例汽车中国',title:'品牌督导',location:'上海',salary:'15000-20000 元/月',
  reason:'你曾辅导经销商门店，具备终端巡店、DCC 管理和销售顾问培训经历，与该品牌督导岗位的渠道管理工作相关。',
  job_basis:'负责上海经销商终端督导',url:posting},
 {company:'某外资企业中国区',title:'渠道运营',location:'广州',salary:'',
  reason:'具备线索转化及门店运营经验。',url:'https://jobs.ashbyhq.com/china/abcd1234'},
 {company:'海外企业',title:'督导',location:'东京',reason:'不能展示',url:'https://careers.fakecorp.com/jobs/123456'},
 {company:'海外企业',title:'销售顾问',location:'上海 / 香港',reason:'不能展示',url:'https://careers.fakecorp.com/jobs/123457'},
 {company:'示例汽车中国',title:'品牌督导',location:'上海',reason:'重复岗位',url:posting},
 {company:'候选公司',title:'运营',location:'上海',reason:'招聘官网首页不允许',url:'https://companycorp.com/'}
]};

// Simulate the *actual server-side tool trace*, not an unverified model URL.
const deepEvidenceResponse=(jobs,extraSources=[])=>({
 status:'completed',
 output:[
  {type:'web_search_call',kind:'deep_search',status:'completed',
   action:{type:'search',queries:['汽车品牌督导 企业官网 招聘'],sources:[
    {type:'url',url:posting,title:'示例汽车中国 品牌督导 招聘职位',
     snippet:'上海品牌督导招聘，要求经销商渠道管理、区域督导、培训。',
     site_name:'示例汽车中国'},...extraSources]}},
  {type:'message',content:[{type:'output_text',text:JSON.stringify({jobs})}]}
 ],
 usage:{input_tokens:1800,output_tokens:2900,
  server_tool_use:{tool_search:3,tool_fetch:2}}
});
test('DeepSeek autonomous request really enables provider-managed thinking search and risk checks',()=>{
 const body=buildDeepSearchRequest('负责经销商渠道和销售顾问培训。','督导，全国出差',10);
 assert.equal(body.model,'deepseek-flash');
 assert.equal(body.reasoning.effort,'high');
 assert.deepEqual(body.tools,[{type:'deepseek_web_search'}]);
 assert.equal(body.safety_check.level,'high');
 assert.equal(body.text.format.type,'text');
 assert.equal(body.stream,true);
 assert.ok(body.max_output_tokens>=10000);
 assert.ok(!body.tools.some(x=>x.type==='web_search'));
});
test('autonomous deep results require real tool-source URL evidence, reject fabricated, job-board and overseas links',()=>{
 const score='简历中经销商渠道管理和销售顾问培训经验确有对应之处，但必须进一步确认岗位的城市、具体职责和硬性任职条件。';
 const jobs=[
  {url:posting,company:'示例汽车中国',title:'品牌督导',location:'上海',
   match_score:84,score_basis:score,reason:score,job_basis:'渠道管理'},
  {url:'https://careers.examplecorp.com/jobs/invented-2',company:'虚构企业',
   title:'虚构岗位',location:'上海',match_score:96,score_basis:score,reason:score},
  {url:'https://www.zhipin.com/job_detail/abcd0001.html',
   company:'第三方来源',title:'督导',location:'北京',reason:score},
  {url:'https://careers.examplecorp.com/jobs/overseas-8',
   company:'海外企业',title:'督导',location:'东京',reason:score},
 ];
 const response=deepEvidenceResponse(jobs,[
  {type:'url',url:'https://www.zhipin.com/job_detail/abcd0001.html',title:'BOSS直聘 - 督导招聘',snippet:'北京品牌督导招聘'},
  {type:'url',url:'https://careers.examplecorp.com/jobs/overseas-8',title:'海外督导招聘',snippet:'日本东京招聘'}
 ]);
 const verified=verifiedDeepSearchMatches(response,10);
 assert.equal(verified.matches.length,1);
 assert.equal(verified.matches[0].official_url,posting);
 assert.equal(verified.matches[0].platform,'deepseek-deep-thinking');
 assert.equal(verified.model_rows,4);
 assert.equal(verified.source_matched_rows,1,'third-party boards are excluded before source matching');
});
test('autonomous deep model records paid usage and exposes soft spending overrun (no pretend hard cap)',async()=>{
 const score='经销商渠道和终端管理经验与岗位职责相关，还需要核查企业招聘资质、正式工作地点及硬性岗位条件。';
 const response=deepEvidenceResponse([{
  url:posting,company:'示例汽车中国',title:'品牌督导',location:'上海',match_score:85,
  score_basis:score,reason:score,job_basis:'渠道培训',salary:''
 }]);
 response.usage.server_tool_use={tool_search:15,tool_fetch:18};
 const fetcher=async(_url,options)=>{
  assert.equal(options.method,'POST');
  return new Response(JSON.stringify(response),{status:200,headers:{'Content-Type':'application/json'}});
 };
 const result=await runAutonomousDeepMatch('synthetic-secret-not-real','经销商渠道业务和门店培训。','品牌督导',10,{fetcher});
 assert.equal(result.matches.length,1);
 assert.equal(result.diagnostic.mode,'provider-managed-deep-thinking-search');
 assert.equal(result.diagnostic.searches,15);
 assert.equal(result.diagnostic.page_reads,18);
 assert.equal(result.diagnostic.tool_budget_exceeded,true);
 assert.equal(result.diagnostic.tool_budget_enforcement,'SOFT_PROVIDER_MANAGED');
 assert.equal(result.diagnostic.estimated_tool_cost_cny,0.165);
 assert.equal(result.diagnostic.tool_cost_soft_budget_cny,0.13);
});
test('autonomous deep results fail closed without actual web evidence',async()=>{
 const response={status:'completed',output:[{type:'message',content:[{
  type:'output_text',text:JSON.stringify({jobs:answer.jobs.slice(0,1)})
 }]}],usage:{}};
 await assert.rejects(runAutonomousDeepMatch('synthetic-secret-not-real','工作经历中的门店督导与渠道管理。','督导',10,{
  fetcher:async()=>new Response(JSON.stringify(response),{status:200})
 }),/AI_DEEP_SEARCH_NO_WEB_EVIDENCE/);
});
test('autonomous deep search does not fall back to unsafe manually supplied links on provider rejection',async()=>{
 await assert.rejects(runAutonomousDeepMatch('synthetic-secret-not-real','负责渠道管理、门店督导和销售培训。','督导',10,{
  fetcher:async()=>new Response('unsupported tool',{status:400})
 }),/AI_DEEP_SEARCH_API_REJECTED/);
});

const deepseek=jobs=>({id:'resp_test',status:'completed',
 output:[{type:'web_search_call',status:'completed',action:{type:'search'}},
  {type:'message',content:[{type:'output_text',text:JSON.stringify({jobs})}]}],
 usage:{server_tool_use:{tool_search:2,tool_fetch:1}}});
test('official Responses payload parser retains Mainland jobs with reasons and per-position HTTPS links',()=>{
 const out=parseJobAnswer(deepseek(answer.jobs),10);
 assert.equal(out.received,6);
 assert.equal(out.matches.length,2);
 assert.equal(out.matches[0].company,'示例汽车中国');
 assert.match(out.matches[0].recommendation_reason,/经销商/);
 assert.equal(out.matches[0].official_url,posting);
 assert.equal(out.matches[1].location,'广州');
 assert.equal(out.matches[0].source_status,'MODEL_SEARCH_REPORTED');
});
test('no search: never show invented jobs',()=>{
 const r={status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(answer)}]}],
 usage:{server_tool_use:{tool_search:0,tool_fetch:0}}};
 assert.equal(wasWebSearched(r),false);
 assert.match(outputText(r),/"jobs"/);
});
test('job links are broad enough for real ATS but still specific public HTTPS pages',()=>{
 assert.equal(safeJobDetailLink(posting),posting);
 assert.equal(safeJobDetailLink('https://jobs.ashbyhq.com/china/abcd1234'),
  'https://jobs.ashbyhq.com/china/abcd1234');
 assert.equal(safeJobDetailLink('http://careers.examplecorp.com/jobs/12345'),null);
 assert.equal(safeJobDetailLink('https://careers.examplecorp.com/'),null);
 assert.equal(safeJobDetailLink('https://www.google.com/search?q=jobs'),null);
 assert.equal(safeJobDetailLink('https://local/jobs/12345'),null);
 assert.equal(safeJobDetailLink('https://careers.examplecorp.com/jobs/12345?access_token=secret'),null);
});
test('one provider POST does the Search + explanations together and returns no scores',async()=>{
 const calls=[];
 const fetcher=async(url,options)=>{
  calls.push({url,body:JSON.parse(options.body)});
  return new Response(JSON.stringify(deepseek(answer.jobs)),{status:200,headers:{'Content-Type':'application/json'}});
 };
 const r=await runNativeJobMatch('synthetic-secret-not-real','上海品牌督导。负责经销商管理。','品牌督导',10,{fetcher});
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,'https://api.deepseek.com/responses');
 assert.equal(calls[0].body.model,'deepseek-v4-pro');
 assert.deepEqual(calls[0].body.tools,[{type:'web_search'}]);
 assert.equal(calls[0].body.tool_choice,'required');
 assert.equal(calls[0].body.text.format.type,'json_object');
 assert.equal(calls[0].body.reasoning.effort,'none');
 assert.equal(r.matches.length,2);
 assert.equal(r.diagnostic.searches,2);
 assert.equal(r.diagnostic.visible_jobs,2);
});
test('a provider response without actual web search fails instead of pretending to have found jobs',async()=>{
 const fixture=deepseek(answer.jobs);
 fixture.output.shift();fixture.usage.server_tool_use.tool_search=0;
 await assert.rejects(runNativeJobMatch('synthetic-secret-not-real','上海经销商督导', '',10,
  {fetcher:async()=>new Response(JSON.stringify(fixture),{status:200})}),/AI_WEB_SEARCH_NOT_USED/);
});
test('wrong API key or model permission is clearly classified, not shown as no jobs',async()=>{
 await assert.rejects(runNativeJobMatch('synthetic-secret-not-real','上海经销商督导', '',10,
  {fetcher:async()=>new Response('not authorized',{status:401})}),/AI_PROVIDER_KEY_REJECTED/);
 await assert.rejects(runNativeJobMatch('synthetic-secret-not-real','上海经销商督导', '',10,
  {fetcher:async()=>new Response('bad request',{status:400})}),/AI_PROVIDER_REQUEST_REJECTED/);
});
test('API rejects unauthenticated and cross-origin requests before sending CV to the provider',async()=>{
 const env={
  HHBA_MATCH_SERVICE_ENABLED:'1',
  HHBA_MATCH_DEEPSEEK_KEY:'synthetic-secret-not-real',
  HHBA_PNVS_AUTH_DB:{prepare:()=>({bind:()=>({first:async()=>null})})}
 };
 const req=new Request('https://hhba.example/api/match-native/resume',{method:'POST',
  headers:{Origin:'https://attacker.example','Content-Type':'application/json'},body:JSON.stringify({})});
 const r=await onRequest({request:req,env});
 assert.equal(r.status,403);
 assert.equal((await r.json()).error,'ORIGIN_REQUIRED');
});
test('new upload UI uses native endpoint and native results, not legacy multi-stage APIs',async()=>{
 const {readFile}=await import('node:fs/promises');
 const svc=await readFile(new URL('../src/services/resumeMatch.ts',import.meta.url),'utf8');
 const page=await readFile(new URL('../src/pages/CandidateMatchPage.tsx',import.meta.url),'utf8');
 assert.match(svc,/const API='\/api\/match-native'/);
 assert.match(page,/CandidateMatchNativeDialog/);
 assert.doesNotMatch(page,/CandidateMatchResultDialog/);
});


test('V4 Pro search receives SSE events and safely assembles the completed result',async()=>{
 const fixture=deepseek(answer.jobs),progress=[],calls=[];
 const providerEvents=[
  {type:'response.created',response:{status:'in_progress'}},
  {type:'response.web_search_call.searching'},
  {type:'response.web_search_call.completed'},
  {type:'response.completed',response:fixture}
 ];
 const all=providerEvents.map(e=>'event: '+e.type+'\ndata: '+JSON.stringify(e)+'\n\n').join('');
 const bytes=new TextEncoder().encode(all);
 const fetcher=async(_url,options)=>{
  calls.push(JSON.parse(options.body));
  return new Response(new ReadableStream({
   start(controller){
    for(let i=0;i<bytes.length;i+=39)controller.enqueue(bytes.slice(i,i+39));
    controller.close();
   }
  }),{status:200,headers:{'Content-Type':'text/event-stream; charset=utf-8'}});
 };
 const out=await runNativeJobMatch('synthetic-secret-not-real',
  '上海品牌督导，负责经销商运营、销售漏斗和培训。','品牌督导',10,{
   fetcher,onProgress:stage=>progress.push(stage)
  });
 assert.equal(calls.length,1);
 assert.equal(calls[0].stream,true);
 assert.equal(calls[0].max_output_tokens,3600);
 assert.equal(out.matches.length,2);
 assert.ok(progress.includes('searching'));
 assert.ok(progress.includes('writing'));
 assert.equal(out.diagnostic.searches,2);
});
test('frontend fetches one native SSE stream and maps stages without restarting model',async()=>{
 const {readFile}=await import('node:fs/promises');
 const svc=await readFile(new URL('../src/services/resumeMatch.ts',import.meta.url),'utf8');
 const page=await readFile(new URL('../src/pages/CandidateMatchPage.tsx',import.meta.url),'utf8');
 assert.match(svc,/'Accept':'text\/event-stream'/);
 assert.match(svc,/consumeNativeMatchStream/);
 assert.match(svc,/event==='complete'/);
 assert.match(svc,/event==='failure'/);
 assert.match(page,/setStage/);
 assert.match(page,/DeepSeek 深度思考搜索正在核实中国大陆招聘岗位/);
});


test('authenticated SSE route uses one autonomous deep-thinking request and validates its sources',async()=>{
 const realFetch=globalThis.fetch,calls=[];
 globalThis.fetch=async(url,options)=>{
  calls.push({url,body:JSON.parse(options.body)});
  assert.equal(url,'https://api.deepseek.com/responses');
  const body=JSON.parse(options.body);
  assert.equal(body.model,'deepseek-flash');
  assert.equal(body.reasoning.effort,'high');
  assert.deepEqual(body.tools,[{type:'deepseek_web_search'}]);
  assert.equal(body.safety_check.level,'high');
  assert.equal(body.text.format.type,'text');
  const response=deepEvidenceResponse([{
   url:posting,company:'示例汽车中国',title:'品牌督导',location:'上海',
   match_score:88,score_basis:'简历里有真实经销商督导和门店培训经历，能够对应岗位所需的渠道协同和终端运营能力，但仍需现场确认企业的岗位任职门槛。',
   reason:'简历中的经销商管理和 DCC 培训经历与该品牌督导岗位职责有相关性，建议核对完整招聘公告以及现场出差要求，不能把当前的匹配分当作录用概率。',
   job_basis:'上海经销商渠道管理与销售培训',salary:''
  }]);
  const events=[
   {type:'response.created',response:{status:'in_progress'}},
   {type:'response.web_search_call.searching'},
   {type:'response.output_item.done',item:response.output[0]},
   {type:'response.completed',response}
  ].map(e=>'event: '+e.type+'\ndata: '+JSON.stringify(e)+'\n\n').join('');
  return new Response(events,{status:200,headers:{'Content-Type':'text/event-stream'}});
 };
 const db={prepare(sql){return {bind(){return {
  async first(){
   if(sql.includes('hhba_auth_sessions'))return {phone:'13800000000',revoked:0,
    expires_at:new Date(Date.now()+3600000).toISOString()};
   if(sql.includes('hhba_auth_users'))return {role:'candidate',phone:'13800000000'};
   throw Error('unexpected database read');
  },async run(){return {success:true}}
 }}}}};
 const env={HHBA_MATCH_SERVICE_ENABLED:'1',
  HHBA_MATCH_DEEPSEEK_KEY:'synthetic-secret-not-real',
  HHBA_PNVS_AUTH_DB:db};
 const request=new Request('https://hhba.example/api/match-native/resume',{
  method:'POST',headers:{Origin:'https://hhba.example',
   Authorization:'Bearer synthetic-client-token',
   Accept:'text/event-stream','Content-Type':'application/json'},
  body:JSON.stringify({text:'上海经销商运营培训，DCC管理，AI产品设计，还管理团队和渠道经营分析能力。',
   consent:true,options:{country:'CN',remote_only:false,role_hint:'品牌督导',limit:10}})
 });
 try{
  const result=await onRequest({request,env});
  assert.equal(result.status,200);
  const events=await result.text();
  assert.match(events,/event: progress/);
  assert.match(events,/event: complete/);
  assert.doesNotMatch(events,/event: failure/);
  assert.match(events,/示例汽车中国/);
  assert.doesNotMatch(events,/东京/);
  assert.equal(calls.length,1,'one DeepSeek-managed search request, no standalone Search/Fetch');
  assert.ok(calls.every(x=>!x.url.endsWith('/v1/tools/search')));
 }finally{globalThis.fetch=realFetch;}
});

test('streaming JSON returns Mainland jobs as soon as each full object is written',async()=>{
 const all=JSON.stringify({jobs:answer.jobs});
 const boundary=all.indexOf('},{"company"');
 assert.ok(boundary>0);
 const first=partialJobMatchesFromText(all.slice(0,boundary+1));
 assert.equal(first.length,1);
 assert.equal(first[0].location,'上海');
 assert.equal(first[0].official_url,posting);
 const end=partialJobMatchesFromText(all,10);
 assert.equal(end.length,2,'overseas, mixed-location and duplicate posts never appear even temporarily');
 const noClosing=partialJobMatchesFromText('{"jobs":[{"company":"深圳示例","title":"销售经理"');
 assert.equal(noClosing.length,0);
});
test('native SSE forwards validated partial jobs before terminal response',async()=>{
 const body=JSON.stringify({jobs:answer.jobs.slice(0,2)});
 const mid=body.indexOf('},{"company"')+1;
 const payload=[
  {type:'response.created',response:{status:'in_progress'}},
  {type:'response.web_search_call.completed'},
  {type:'response.output_text.delta',delta:body.slice(0,mid)},
  {type:'response.output_text.delta',delta:body.slice(mid)},
  {type:'response.completed',response:deepseek(answer.jobs)}
 ].map(x=>'event: '+x.type+'\ndata: '+JSON.stringify(x)+'\n\n').join('');
 const seen=[];
 const out=await runNativeJobMatch('synthetic-secret-not-real','国内品牌督导', '品牌督导',10,{
  fetcher:async()=>new Response(payload,{status:200,headers:{'Content-Type':'text/event-stream'}}),
  onPartial:matches=>seen.push(matches.map(j=>j.location).join(','))
 });
 assert.deepEqual(seen,['上海','上海,广州']);
 assert.equal(out.matches.length,2);
});
test('frontend shows partial results without pretending network completion',async()=>{
 const {readFile}=await import('node:fs/promises');
 const svc=await readFile(new URL('../src/services/resumeMatch.ts',import.meta.url),'utf8');
 const page=await readFile(new URL('../src/pages/CandidateMatchPage.tsx',import.meta.url),'utf8');
 const dialog=await readFile(new URL('../src/components/CandidateMatchNativeDialog.tsx',import.meta.url),'utf8');
 assert.match(svc,/event==='partial'/);
 assert.match(svc,/onPartial\?\./);
 assert.match(page,/result\|\|partialJobs\.length>0/);
 assert.match(page,/setPartialJobs/);
 assert.match(dialog,/pending\?'（继续搜索中）'/);
});


test('encoded Chinese characters and spaces are normalized in job reasons',()=>{
 assert.equal(decodeSearchText('&#x610F;向城市聊城本地&#x20;、岗位方向匹配'), '意向城市聊城本地 、岗位方向匹配');
 const fixture=deepseek([{company:'某企业',title:'AI 产品经理',location:'聊城',
  url:'https://careers.samplecorp.com/jobs/ai-manager-2026',
  reason:'经历里的&#x610F;向分析能力&#x20;与岗位匹配。'}]);
 const p=parseJobAnswer(fixture,10);
 assert.match(p.matches[0].recommendation_reason,/意向分析能力 与岗位匹配/);
 assert.doesNotMatch(p.matches[0].recommendation_reason,/&#x/);
});
test('dual native DeepSeek searches run concurrently and merge ten unique roles',async()=>{
 let active=0,peak=0,requests=0;
 const partial=[];
 const fetcher=async(_url,options)=>{
  requests++;active++;peak=Math.max(peak,active);
  const body=JSON.parse(options.body);
  const adjacent=body.input.includes('优先发掘简历能力可迁移');
  assert.equal(body.model,'deepseek-v4-pro');
  assert.equal(body.max_output_tokens,3600);
  assert.equal(body.stream,true);
  const jobs=Array.from({length:6},(_,i)=>({
   company:adjacent&&i===0?'直接企业1':(adjacent?'迁移企业':'直接企业')+(i+1),
   title:adjacent&&i===0?'品牌督导':(adjacent?'运营经理':'品牌督导')+(i+1),
   location:'上海',salary:'',
   reason:'简历中的区域门店督导、DCC 管理和销售培训可以支撑该岗位的实务工作；岗位更重视客户经营、经销商协调和过程复盘，可用具体数字展示改善成果；如转岗需补充行业知识。',
   url:'https://careers.syntheticcorp.com/jobs/'+(adjacent?'transfer':'direct')+'-'+i+'-2026'
  }));
  await new Promise(resolve=>setTimeout(resolve,9));
  active--;
  return new Response(JSON.stringify(deepseek(jobs)),{status:200,headers:{'Content-Type':'application/json'}});
 };
 const res=await runNativeDualMatch('synthetic-secret-not-real',
  '意向上海区域运营与品牌督导。经销商经营、DCC管理、培训和销售漏斗优化。','品牌督导',10,
  {fetcher,onPartial:jobs=>partial.push(jobs.length)});
 assert.equal(requests,2);
 assert.equal(peak,2,'not two sequential 65-second searches');
 assert.equal(res.matches.length,10);
 assert.equal(new Set(res.matches.map(j=>j.company+'|'+j.title)).size,10);
 assert.equal(res.diagnostic.parallel_requests,2);
 assert.equal(res.diagnostic.failed_requests,0);
 assert.ok(res.matches.every(j=>j.location==='上海'&&j.recommendation_reason.length>70));
 assert.ok(partial.includes(6));
 assert.ok(partial.includes(10));
});
test('duplicate company and title across cities do not consume two Top10 slots',()=>{
 const first={company:'某公司',title:'渠道经理',title_zh:'渠道经理',location:'北京',
  official_url:'https://careers.foo.cn/jobs/role-001'};
 const second={...first,location:'上海',official_url:'https://careers.foo.cn/jobs/role-002'};
 const third={...first,company:'另一家公司',official_url:'https://careers.bar.cn/jobs/role-003'};
 assert.deepEqual(combineNativeBatches([[first],[second,third]],10).map(x=>x.company),['某公司','另一家公司']);
});


test('a stalled second DeepSeek request cannot block completed real job cards for 65 seconds',async()=>{
 let calls=0,aborted=false;
 const one={...answer.jobs[0],company:'真实测试企业'};
 const fetcher=async(_url,options)=>{
  calls++;
  if(calls===1)return new Response(JSON.stringify(deepseek([one])),{status:200});
  return new Promise((resolve,reject)=>{
   options.signal.addEventListener('abort',()=>{
    aborted=true;const e=new Error('abort');e.name='AbortError';reject(e);
   },{once:true});
  });
 };
 const shown=[];
 const start=Date.now();
 const result=await runNativeDualMatch('synthetic-secret-not-real','上海区域督导工作经验',
  '品牌督导',10,{fetcher,timeBudgetMs:60,onPartial:x=>shown.push(x.length)});
 assert.equal(calls,2);
 assert.ok(Date.now()-start<1800,'one stalled search must never gate returned jobs');
 assert.deepEqual(shown,[1]);
 assert.equal(result.matches.length,1);
 assert.equal(result.incomplete,true);
 assert.equal(result.diagnostic.finished_early,true);
 assert.equal(result.diagnostic.deadline_reached,true);
 assert.equal(aborted,true);
});
test('when ten distinct job objects have streamed, stop waiting for final provider events',async()=>{
 let cancelled=0;
 const jobsFor=i=>Array.from({length:5},(_,j)=>({
  company:'企业'+i+'-'+j,title:'区域督导'+i+'-'+j,location:'上海',
  url:'https://careers.enterprisechina.com/jobs/region-'+i+'-'+j+'-2026',
  reason:'有经销商经营与培训方面可对应岗位的真实工作经历，需要确认行业招聘要求。'
 }));
 let count=0;
 const fetcher=async(_url,options)=>{
  const i=count++;
  const output='{"jobs":'+JSON.stringify(jobsFor(i))+']';
  const events=[
   {type:'response.created',response:{status:'in_progress'}},
   {type:'response.web_search_call.completed'},
   {type:'response.output_text.delta',delta:output}
  ].map(x=>'event: '+x.type+'\ndata: '+JSON.stringify(x)+'\n\n').join('');
  return new Response(new ReadableStream({
   start(controller){
    controller.enqueue(new TextEncoder().encode(events));
    options.signal.addEventListener('abort',()=>{
     cancelled++;controller.close();
    },{once:true});
   }
  }),{status:200,headers:{'Content-Type':'text/event-stream'}});
 };
 const snapshots=[];
 const result=await runNativeDualMatch('synthetic-secret-not-real','上海品牌督导工作经历',
  '品牌督导',10,{fetcher,timeBudgetMs:1000,onPartial:jobs=>snapshots.push(jobs.length)});
 assert.equal(result.matches.length,10);
 assert.equal(count,2);
 assert.equal(cancelled,2);
 assert.equal(result.incomplete,false);
 assert.ok(snapshots.includes(10));
 assert.equal(result.diagnostic.finished_early,true);
});
