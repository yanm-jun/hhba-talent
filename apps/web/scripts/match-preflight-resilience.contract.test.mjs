import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planAutonomousMainlandSearch} from '../functions/_lib/autonomous-mainland-search.js';
import {runAgentOwnedMainlandMatch} from '../functions/_lib/ai-owned-job-research.js';


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
 const route=readFileSync(new URL('../functions/api/match-v4/[[path]].js',import.meta.url),'utf8');
 assert.doesNotMatch(page,/checkMatchProviderConnection/);
 assert.match(page,/await submitExtractedResumeText\(/);
 assert.match(route,/sessionOfBearer\(db,request,Date\.now\(\)\)/);
 assert.match(route,/v4JobProvider\(env\)/);
 assert.doesNotMatch(route,/HHBA_MATCH_DEEPSEEK_KEY|checkMatchProviderCapabilities/);
});

