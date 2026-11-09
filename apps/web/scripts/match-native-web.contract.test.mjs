import test from 'node:test';
import assert from 'node:assert/strict';
import {safeJobDetailLink,parseJobAnswer,wasWebSearched,outputText} from '../functions/_lib/deepseek-native-match.js';
import {runNativeJobMatch,onRequest} from '../functions/api/match-native/[[path]].js';
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
