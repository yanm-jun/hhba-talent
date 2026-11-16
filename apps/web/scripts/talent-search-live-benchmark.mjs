/**
 * HHBA Talent Intelligence — MANUAL real-provider discovery benchmark.
 *
 * This is NOT a verified-jobs test. It compares public search provider recall
 * on non-identifying, synthetic role queries and records source candidates.
 *
 * LIVE MODE requires BOTH --live and HHBA_TALENT_BENCHMARK_LIVE=1.
 * No resume, email, telephone, applicant IDs or auth cookies are transmitted.
 * Provider keys only come from server-side environment secrets.
 */
import { searchAcrossProviders } from '../functions/_lib/talent-search-providers.js';
import { recruitmentSourceKind } from '../functions/_lib/match-employer-source.js';
import { pathToFileURL } from 'node:url';

export const TALENT_BENCHMARK_QUERIES=Object.freeze([
  {id:'regional_operations',query:'全国 区域督导 连锁门店 运营 企业官网 社会招聘'},
  {id:'channel_management',query:'中国大陆 渠道运营 经理 经销商 招聘 企业官网'},
  {id:'mechanical',query:'机械设计工程师 2026 社会招聘 岗位详情 企业官网'},
  {id:'software',query:'软件后端工程师 中国大陆 社会招聘 企业官网 职位详情'},
  {id:'accounting',query:'财务会计 招聘 社会招聘 企业官网 岗位详情'},
  {id:'creative',query:'品牌视觉设计师 中国大陆 社会招聘 企业官网 岗位详情'},
]);

const MAX_QUERIES=6,MAX_PROVIDERS=4;
const ENV_KEYS=Object.freeze({
  deepseek:['HHBA_MATCH_DEEPSEEK_KEY','DEEPSEEK_API_KEY'],
  baidu_agentic:['HHBA_BAIDU_SEARCH_KEY','BAIDU_SEARCH_API_KEY'],
  baidu_web:['HHBA_BAIDU_SEARCH_KEY','BAIDU_SEARCH_API_KEY'],
  brave_context:['HHBA_BRAVE_SEARCH_KEY','BRAVE_SEARCH_API_KEY'],
  exa:['HHBA_EXA_SEARCH_KEY','EXA_API_KEY'],
  tavily:['HHBA_TAVILY_SEARCH_KEY','TAVILY_API_KEY'],
  firecrawl:['HHBA_FIRECRAWL_API_KEY','FIRECRAWL_API_KEY'],
});

function normalizedProviderList(value) {
  const candidates=typeof value==='string'?value.split(','):[];
  return [...new Set(candidates.map(x=>x.trim().toLowerCase())
    .filter(x=>Object.hasOwn(ENV_KEYS,x)))].slice(0,MAX_PROVIDERS);
}
function sourceKind(url) {
  const result=recruitmentSourceKind(url);
  return result==='THIRD_PARTY_BOARD'?'board_excluded':
    result==='EMPLOYER_ATS'?'possible_ats':
    result==='EMPLOYER_DOMAIN_CANDIDATE'?'possible_employer_domain':
    'unverified';
}
export function summarizeDiscoveryBenchmark(data,queries,selectedProviders){
  const entries=[];
  for(const item of data){
    const providerStates=(item.response?.providers||[]).map(provider=>({
      provider:provider.provider,
      status:provider.status,
      latency_ms:provider.latency_ms ?? null,
      returned_hits:Array.isArray(provider.results)?provider.results.length:0,
      error_code:provider.error_code||null,
    }));
    const hits=(item.response?.results||[]).slice(0,120).map(hit=>({
      title:String(hit.title||'').slice(0,160),
      url:String(hit.url||'').slice(0,1024),
      source_kind:sourceKind(hit.url),
      providers:Array.isArray(hit.providers)?hit.providers:[],
    }));
    const distribution={board_excluded:0,possible_ats:0,possible_employer_domain:0,unverified:0};
    for(const hit of hits)distribution[hit.source_kind]++;
    entries.push({
      query_id:item.id,query:item.query,
      provider_states:providerStates,returned_unique_links:hits.length,
      source_distribution:distribution,
      links:hits,
    });
  }
  return {
    report_kind:'HHBA_TALENT_SEARCH_LIVE_DISCOVERY_BENCHMARK_V1',
    mode:'live_provider_discovery_only',
    scope:'CN_MAINLAND_SEARCH_HINTS',
    generated_at:new Date().toISOString(),
    providers:selectedProviders,
    query_count:queries.length,
    provider_calls_budget:queries.length*selectedProviders.length,
    verified_official_jobs:null,
    disclaimer:'Source classifications are unverified discovery hints, not proven employers, current vacancies, salary evidence or direct application links.',
    queries:entries,
  };
}

export async function runLiveDiscoveryBenchmark({
  liveFlag=false,env=process.env,providers=['deepseek','baidu_web'],queries=TALENT_BENCHMARK_QUERIES,
  searchFn=searchAcrossProviders,
}={}){
  if(!liveFlag||env.HHBA_TALENT_BENCHMARK_LIVE!=='1')
    throw Error('BENCHMARK_LIVE_OPT_IN_REQUIRED');
  const selected=normalizedProviderList(providers.join(','));
  if(!selected.length)throw Error('BENCHMARK_NO_VALID_PROVIDERS');
  // Only the public, committed synthetic benchmark set is permitted. A
  // caller cannot substitute private applicant data into a paid search run.
  const publicQueries=new Set(TALENT_BENCHMARK_QUERIES.map(q=>q.id+'|'+q.query));
  const cleanQueries=Array.isArray(queries)?queries
    .filter(q=>q&&publicQueries.has(q.id+'|'+q.query)).slice(0,MAX_QUERIES):[];
  if(!cleanQueries.length)throw Error('BENCHMARK_NO_QUERIES');
  const configs={};
  for(const provider of selected){
    const apiKey=ENV_KEYS[provider].map(key=>env[key]).find(key=>typeof key==='string'&&key.trim().length>15);
    if(!apiKey)throw Error('BENCHMARK_PROVIDER_KEY_MISSING:'+provider);
    configs[provider]={apiKey};
  }
  const data=[];
  for(const q of cleanQueries){
    const result=await searchFn(q.query,configs,{
      providers:selected,timeoutMs:15000,
      count:20,needContent:false,
    });
    data.push({id:q.id,query:q.query,response:result});
  }
  return summarizeDiscoveryBenchmark(data,cleanQueries,selected);
}

async function main(){
  const args=process.argv.slice(2);
  const selected=args.find(x=>x.startsWith('--providers='))?.slice(12)||'deepseek,baidu_web';
  const providers=normalizedProviderList(selected);
  const liveFlag=args.includes('--live');
  const report=await runLiveDiscoveryBenchmark({
    liveFlag,providers,env:process.env,
  });
  if(process.env.HHBA_TALENT_BENCHMARK_REPORT){
    const fs=await import('node:fs/promises');
    await fs.writeFile(process.env.HHBA_TALENT_BENCHMARK_REPORT,
      JSON.stringify(report,null,2)+'\n','utf8');
  }
  // Print summary only. GitHub Actions artifacts contain detailed URLs.
  process.stdout.write(JSON.stringify({
    report_kind:report.report_kind,
    query_count:report.query_count,
    provider_calls_budget:report.provider_calls_budget,
    provider_count:report.providers.length,
    unique_hits:report.queries.reduce((n,x)=>n+x.returned_unique_links,0),
    verified_official_jobs:null,
  })+'\n');
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  main().catch(error=>{
    const code=error?.message?.startsWith('BENCHMARK_')?error.message:'BENCHMARK_FAILED';
    process.stderr.write(code+'\n');
    process.exitCode=1;
  });
}
