import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TALENT_BENCHMARK_QUERIES,
  summarizeDiscoveryBenchmark,
  runLiveDiscoveryBenchmark,
} from './talent-search-live-benchmark.mjs';

const key='synthetic-key-abcdefghijklmnopqrstuvwxyz';
const response=()=>({
  providers:[
    {provider:'deepseek',status:'success',latency_ms:200,results:[
      {url:'https://careers.example.cn/jobs/regional-ops-1234'}]},
    {provider:'baidu_web',status:'success',latency_ms:180,results:[
      {url:'https://careers.example.cn/jobs/regional-ops-1234'}]},
  ],
  results:[
    {title:'公司官方职位详情候选',url:'https://careers.example.cn/jobs/regional-ops-1234',providers:['deepseek','baidu_web']},
    {title:'第三方招聘列表',url:'https://www.zhipin.com/job_detail/a123.html',providers:['deepseek']},
    {title:'待核验来源',url:'https://unknown.example.cn/a/1',providers:['baidu_web']},
  ],
});
test('cannot run real paid search without two explicit opt-in conditions',async()=>{
  let invoked=0;
  const fn=async()=>{invoked++;return response();};
  await assert.rejects(runLiveDiscoveryBenchmark({
    liveFlag:false,env:{HHBA_TALENT_BENCHMARK_LIVE:'1',DEEPSEEK_API_KEY:key},
    providers:['deepseek'],searchFn:fn,
  }),/BENCHMARK_LIVE_OPT_IN_REQUIRED/);
  await assert.rejects(runLiveDiscoveryBenchmark({
    liveFlag:true,env:{DEEPSEEK_API_KEY:key},
    providers:['deepseek'],searchFn:fn,
  }),/BENCHMARK_LIVE_OPT_IN_REQUIRED/);
  assert.equal(invoked,0);
});
test('a missing provider secret prevents all calls before dispatch',async()=>{
  let invoked=0;
  await assert.rejects(runLiveDiscoveryBenchmark({
    liveFlag:true,env:{HHBA_TALENT_BENCHMARK_LIVE:'1',DEEPSEEK_API_KEY:key},
    providers:['deepseek','baidu_web'],
    searchFn:async()=>{invoked++;return response();},
  }),/BENCHMARK_PROVIDER_KEY_MISSING/);
  assert.equal(invoked,0);
});
test('a benchmark sends only non-identifying synthetic career query terms',async()=>{
  const observed=[];
  const report=await runLiveDiscoveryBenchmark({
    liveFlag:true,
    env:{HHBA_TALENT_BENCHMARK_LIVE:'1',DEEPSEEK_API_KEY:key},
    providers:['deepseek'],
    queries:TALENT_BENCHMARK_QUERIES.slice(0,2),
    searchFn:async(query,configs,options)=>{
      observed.push({query,configs,options});
      return {...response(),providers:response().providers.slice(0,1)};
    },
  });
  assert.equal(observed.length,2);
  assert.ok(observed.every(x=>!x.query.includes('@')&&!/\d{11}/.test(x.query)));
  assert.ok(observed.every(x=>x.configs.deepseek.apiKey===key));
  assert.ok(observed.every(x=>x.options.needContent===false));
  assert.equal(report.mode,'live_provider_discovery_only');
  assert.equal(report.verified_official_jobs,null);
  assert.equal(report.provider_calls_budget,2);
  assert.equal(report.query_count,2);
  assert.equal(report.queries.length,2);
  assert.ok(!JSON.stringify(report).includes(key),'credentials must never enter reports');
  assert.equal(report.queries[0].source_distribution.board_excluded,1);
  assert.equal(report.queries[0].source_distribution.possible_employer_domain,1);
  assert.equal(report.queries[0].source_distribution.unverified,1);
});
test('custom personal queries are rejected, not rewritten into third-party API calls',async()=>{
  let called=0;
  await assert.rejects(runLiveDiscoveryBenchmark({
    liveFlag:true,
    env:{HHBA_TALENT_BENCHMARK_LIVE:'1',DEEPSEEK_API_KEY:key},
    providers:['deepseek'],
    queries:[{id:'leaked_personal_resume',query:'张三 13800138000 email private@example.com'}],
    searchFn:async()=>{called++;return response();},
  }),/BENCHMARK_NO_QUERIES/);
  assert.equal(called,0);
});
test('query list and provider count are both hard limited',async()=>{
  const calls=[];
  const report=await runLiveDiscoveryBenchmark({
    liveFlag:true,env:{
      HHBA_TALENT_BENCHMARK_LIVE:'1',
      DEEPSEEK_API_KEY:key,
      BAIDU_SEARCH_API_KEY:key,
      BRAVE_SEARCH_API_KEY:key,
      EXA_API_KEY:key,
      TAVILY_API_KEY:key,
    },
    providers:['deepseek','baidu_web','brave_context','exa','tavily'],
    queries:TALENT_BENCHMARK_QUERIES,
    searchFn:async(query,configs,options)=>{
      calls.push({query,providerCount:options.providers.length});
      return response();
    },
  });
  assert.equal(calls.length,6);
  assert.ok(calls.every(x=>x.providerCount===4));
  assert.equal(report.provider_calls_budget,24);
});
test('source types remain unverified candidates even when search ranking is high',()=>{
  const report=summarizeDiscoveryBenchmark([
    {id:'regional_operations',query:'区域运营招聘',response:response()},
  ],TALENT_BENCHMARK_QUERIES.slice(0,1),['deepseek','baidu_web']);
  assert.equal(report.verified_official_jobs,null);
  assert.match(report.disclaimer,/not proven employers/);
  assert.equal(report.queries[0].returned_unique_links,3);
});
