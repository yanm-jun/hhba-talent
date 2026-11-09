import test from 'node:test';
import assert from 'node:assert/strict';
import {safeJobDetailLink,parseJobAnswer,wasWebSearched,outputText,partialJobMatchesFromText,decodeSearchText} from '../functions/_lib/deepseek-native-match.js';
import {runNativeJobMatch,runNativeDualMatch,combineNativeBatches,onRequest} from '../functions/api/match-native/[[path]].js';
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
 assert.match(page,/DeepSeek 正在搜索中国大陆的真实岗位/);
});


test('authenticated HHBA route streams progress and final Top10 without blocking until DeepSeek finishes',async()=>{
 const realFetch=globalThis.fetch;
 let calls=0;
 globalThis.fetch=async (_url,options)=>{
  calls++;
  const fixture=deepseek(answer.jobs);
  const body=[
   {type:'response.created',response:{status:'in_progress'}},
   {type:'response.web_search_call.searching'},
   {type:'response.web_search_call.completed'},
   {type:'response.completed',response:fixture}
  ].map(x=>'event: '+x.type+'\ndata: '+JSON.stringify(x)+'\n\n').join('');
  return new Response(body,{status:200,headers:{'Content-Type':'text/event-stream'}});
 };
 const db={prepare(sql){
  return {bind(){return {
   async first(){
    if(sql.includes('hhba_auth_sessions'))return {phone:'13800000000',revoked:0,
     expires_at:new Date(Date.now()+3600000).toISOString()};
    if(sql.includes('hhba_auth_users'))return {role:'candidate',phone:'13800000000'};
    throw Error('unexpected database read');
   },
   async run(){return {success:true}}
  }}};
 }};
 const env={HHBA_MATCH_SERVICE_ENABLED:'1',
  HHBA_MATCH_DEEPSEEK_KEY:'synthetic-secret-not-real',
  HHBA_PNVS_AUTH_DB:db};
 const request=new Request('https://hhba.example/api/match-native/resume',{
  method:'POST',headers:{Origin:'https://hhba.example',
   Authorization:'Bearer synthetic-client-token',
   Accept:'text/event-stream','Content-Type':'application/json'},
  body:JSON.stringify({text:'上海品牌督导。负责经销商运营、销售培训、DCC客户管理和门店改善。',
   consent:true,options:{country:'CN',remote_only:false,role_hint:'品牌督导',limit:10}})
 });
 try{
  const response=await onRequest({request,env});
  assert.equal(response.status,200);
  assert.match(response.headers.get('content-type'),/text\/event-stream/);
  const stream=await response.text();
  assert.match(stream,/event: progress/);
  assert.match(stream,/event: complete/);
  assert.doesNotMatch(stream,/event: failure/);
  assert.match(stream,/示例汽车中国/);
  assert.doesNotMatch(stream,/东京/);
  assert.equal(calls,2,'two autonomous web searches run in parallel');
 }finally{globalThis.fetch=realFetch}
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
