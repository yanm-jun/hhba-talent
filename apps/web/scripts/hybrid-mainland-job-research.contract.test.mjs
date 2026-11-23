import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mainlandSearchPreferenceCities,mainlandHybridSearchQueries,
 runHybridMainlandJobResearch,HYBRID_DISCOVERY_VERSION}
 from '../functions/_lib/hybrid-mainland-job-research.js';

const OFFICIAL='https://careers.tencent.com/jobdesc.html?postId=2097166275703910400';
const SECOND='https://jobs.exemplary-auto.cn/job/177785';
const BOARD='https://www.zhipin.com/job_detail/977';
const FOREIGN='https://jobs.lever.co/example/11111111-2222-4333-8444-555555555555';
const job=(url,company='国内汽车企业')=>({
 id:'search-'+company,company,title:'区域督导',location:'上海',
 official_url:url,match_score:null,reference_score:0,
 evidence_status:'SEARCH_SNIPPET_ONLY',source_status:'SOURCE_SEARCH_PREVIEW',
 recommendation_reason:'岗位来源已检索到，仍需核验完整 JD 和实际工作地点。',
 recruitment_source_kind:'EMPLOYER_DOMAIN_CANDIDATE'
});
const evidence={
 target_roles:['区域督导','渠道运营']
};
function searchResponse(hits,queries){
 return {hits,diagnostic:{successful_searches:queries.length,
 raw_results:hits.length,candidate_links:hits.length,search_failures:0}};
}

test('supplemental search respects explicit Shanghai preference and widens to surrounding cities',()=>{
 const cv='2025年任职山东市场门店督导。意向工作城市：上海\n手机号：13800138000\n现希望寻找渠道运营。';
 assert.deepEqual(mainlandSearchPreferenceCities(cv),['上海','苏州','杭州']);
 assert.deepEqual(mainlandSearchPreferenceCities('2025年曾赴上海出差，管理山东区门店。'),[]);
 const qs=mainlandHybridSearchQueries(cv,'',evidence);
 assert.equal(qs.length,6);
 assert.ok(qs.some(x=>x.includes('上海')));
 assert.ok(qs.some(x=>x.includes('苏州')));
 assert.ok(qs.some(x=>x.includes('杭州')));
 assert.ok(qs.every(x=>!x.includes('13800138000')&&!x.includes('2025年')&&!x.includes('山东市场')));
 assert.deepEqual(mainlandHybridSearchQueries('', '', {},6),[]);
});

test('parallel native + standalone Search retains sourced mainland job prospects without duplicating them',async()=>{
 const starts=[],sourceCalls=[],activity=[],partial=[];
 const result=await runHybridMainlandJobResearch('fake-key',
  '岗位经验。期望城市：上海\n私人手机号 13800138000','区域督导',10,{
   resumeProfile:evidence,
   onSources:(jobs,closed,links)=>sourceCalls.push({jobs,closed,links}),
   onPartial:jobs=>partial.push(...jobs),
   onActivity:x=>activity.push(x)
  },{
   native:async()=>{starts.push('native');return {
    matches:[job(OFFICIAL,'腾讯')],
    diagnostic:{mode:'native',searches:4,candidate_links:1,provider_items:8}
   };},
   search:async(_key,_text,_role,options)=>{
    starts.push('standalone');
    assert.equal(_text,'','public Search never receives raw CV');
    assert.ok(options.queriesOverride.every(x=>!x.includes('13800138000')));
    return searchResponse([
      {url:OFFICIAL,title:'腾讯 区域督导 上海 招聘'},
      {url:SECOND,title:'国内汽车企业 区域督导 上海 招聘'},
      {url:BOARD,title:'third party'},
      {url:FOREIGN,title:'foreign ATS'}
    ],options.queriesOverride);
   },
   previews:()=>[job(OFFICIAL,'腾讯'),job(SECOND)]
  });
 assert.deepEqual(new Set(starts),new Set(['native','standalone']));
 assert.deepEqual(result.matches.map(x=>x.official_url),[OFFICIAL,SECOND]);
 assert.equal(result.diagnostic.mode,HYBRID_DISCOVERY_VERSION);
 assert.equal(result.diagnostic.searches,10);
 assert.equal(result.diagnostic.hybrid_fallback.queries,6);
 assert.ok(sourceCalls.length>=1);
 assert.deepEqual(sourceCalls[0].links,[OFFICIAL,SECOND]);
 assert.ok(sourceCalls.at(-1).jobs.length>=1,'after evidence review the candidates are surfaced again');
 assert.ok(partial.length>=2);
 assert.ok(activity.some(x=>x.message.includes('补充搜索')));
});

test('regression: 18 real source URLs with generic Search snippets are actually fetched before a verdict of zero jobs',async()=>{
 const hits=Array.from({length:18},(_,i)=>({
  id:'j'+(i+1),
  url:'https://careers.tencent.com/jobdesc.html?postId='+String(2097166275703910400n+BigInt(i)),
  title:'职位详情',source:'腾讯招聘',summary:'腾讯招聘职位详情',
  snippet:'腾讯招聘职位详情',content:'',
  availability:{status:'UNKNOWN'}
 }));
 const activities=[],sources=[];
 const error=Object.assign(new Error('AI_EMPLOYER_JOBS_NOT_FOUND'),{
  code:'AI_EMPLOYER_JOBS_NOT_FOUND',diagnostic:{searches:0,candidate_links:0}});
 const result=await runHybridMainlandJobResearch('fake-key',
  '区域门店督导经验\n意向工作城市：上海','区域督导',10,{
   resumeProfile:evidence,
   onActivity:x=>activities.push(x.message),
   onSources:(_jobs,_closed,urls)=>sources.push(urls)
  },{
   native:async()=>{throw error;},
   search:async(_key,cv,_role,opt)=>{
    assert.equal(cv,'','Search must not receive a resume');
    return searchResponse(hits,opt.queriesOverride);
   },
   enrich:async(_key,rows,opts)=>{
    assert.equal(rows.length,18);
    assert.equal(opts.maxFetch,12);
    assert.equal(opts.fetchTimeoutMs,6500);
    return {hits:rows.map((hit,i)=>i===0?{
     ...hit,content:'招聘单位：腾讯\n职位名称：销售运营主管\n工作地点：上海\n岗位职责：负责业务销售运营、渠道辅导和数据分析。\n任职要求：熟悉门店数据分析及跨团队协作。',
     availability:{status:'UNKNOWN'}
    }:hit),fetches:1,excluded_closed:0};
   },
   recover:async()=>[]
  });
 assert.equal(result.matches.length,1,'public vacancy with fetched company, title and city is not discarded');
 assert.equal(result.matches[0].location,'上海');
 assert.equal(result.matches[0].title,'销售运营主管');
 assert.equal(result.matches[0].match_score,null);
 assert.equal(result.matches[0].jd_source_status,undefined);
 assert.equal(result.diagnostic.hybrid_fallback.candidate_links,18);
 assert.equal(result.diagnostic.hybrid_fallback.source_preview_before_fetch,0);
 assert.equal(result.diagnostic.hybrid_fallback.fetch_attempted,12);
 assert.equal(result.diagnostic.hybrid_fallback.fetched_job_pages,1);
 assert.equal(result.diagnostic.hybrid_fallback.source_previews,1);
 assert.ok(sources[0].length===18);
 assert.ok(activities.some(x=>x.includes('打开最多')));
});

test('fetch failed: no fake job/location is created and diagnostics report unreadable pages',async()=>{
 const hits=Array.from({length:18},(_,i)=>({
  id:'j'+i,
  url:'https://jobs.company-portal.cn/position/job-'+(i+20000),
  title:'职位详情',source:'企业招聘',summary:'职位详情，更多信息请打开官网',
  snippet:'职位详情，更多信息请打开官网',content:'',
  availability:{status:'UNKNOWN'}
 }));
 let recoveryCalls=0;
 const result=await runHybridMainlandJobResearch('fake-key',
  '期望工作城市：上海','区域督导',10,{
   resumeProfile:evidence
  },{
   native:async()=>({matches:[],diagnostic:{searches:1}}),
   search:async(_k,_c,_h,o)=>searchResponse(hits,o.queriesOverride),
   enrich:async(_k,rows)=>({hits:rows,fetches:0,excluded_closed:0}),
   recover:async()=>{recoveryCalls++;return []}
  });
 assert.equal(result.matches.length,0);
 assert.equal(result.diagnostic.hybrid_fallback.fetch_attempted,12);
 assert.equal(result.diagnostic.hybrid_fallback.fetched_job_pages,0);
 assert.equal(result.diagnostic.hybrid_fallback.fetch_failures,12);
 assert.equal(result.diagnostic.hybrid_fallback.source_previews,0);
 assert.equal(recoveryCalls,0,'do not use an AI to invent missing web evidence');
});

test('AI source recovery can identify a fetched role, but may not invent links, mainland cities or numerical scores',async()=>{
 const hit={id:'id-1',url:OFFICIAL,title:'职位详情',
  source:'腾讯招聘',summary:'职位详情',snippet:'职位详情',
  content:'',availability:{status:'UNKNOWN'}};
 const fetched={...hit,content:'招聘单位：腾讯\n职位名称：销售运营主管\n工作地点：上海\n岗位职责：负责区域销售运营、渠道支持，定期复盘线索、到店、试驾转化数据，落实跨团队协同与客户经营。\n任职要求：经营数据分析，销售流程管理与跨部门协作能力。',
  availability:{status:'UNKNOWN'}};
 let received=false;
 const result=await runHybridMainlandJobResearch('key','期望工作城市：上海','区域督导',10,
  {resumeProfile:evidence},{
   native:async()=>({matches:[],diagnostic:{searches:1}}),
   search:async(_k,_c,_h,o)=>searchResponse([hit],o.queriesOverride),
   enrich:async()=>({hits:[fetched],fetches:1}),
   previews:()=>[],
   recover:async(_k,_resume,rows)=>{
    received=rows[0].content.includes('工作地点：上海');
    return [
     {...job(OFFICIAL,'腾讯'),title:'销售运营主管',match_score:99,score_basis:'未经核实的分数'},
     {...job('https://careers.fake-recommend.cn/jobs/unknown'),'title':'区域督导',match_score:92},
     {...job(BOARD),match_score:90}
    ];
   }
  });
 assert.ok(received);
 assert.deepEqual(result.matches.map(x=>x.official_url),[OFFICIAL]);
 assert.equal(result.matches[0].match_score,null);
 assert.equal(result.matches[0].reference_score,0);
 assert.equal(result.diagnostic.hybrid_fallback.model_recovered,1);
});

test('hybrid native search also uses bounded company-index hints without treating old company URLs as live jobs',async()=>{
 const indexQueries=['华东汽车 区域督导 社会招聘 site:careers.hd-auto.cn',
  '新创零售 渠道运营 社会招聘 site:career.retail-example.cn'];
 let inputRoles=[],inputSectors=[],queries=[];
 const response=await runHybridMainlandJobResearch('test-key',
  '历史工作地点山东，期望工作城市：上海\n13800138000','区域督导',10,{
   resumeProfile:evidence,
   employerIndex:async(roles,sectors)=>{
    inputRoles=roles;inputSectors=sectors;
    return {available:true,considered:120,queries:indexQueries,sectors};
   }
  },{
   native:async()=>({matches:[],diagnostic:{searches:1}}),
   search:async(_k,_text,_h,options)=>{
    queries=options.queriesOverride;
    return searchResponse([],queries);
   }
  });
 assert.equal(inputRoles[0],'区域督导');
 assert.ok(inputSectors.includes('retail')||inputSectors.includes('automotive'));
 assert.equal(queries.length,8);
 assert.ok(queries.includes(indexQueries[0]));
 assert.ok(queries.includes(indexQueries[1]));
 assert.ok(queries.every(q=>!q.includes('13800138000')));
 assert.equal(response.matches.length,0);
 assert.equal(response.diagnostic.hybrid_fallback.index_companies_considered,120);
});

test('source-only mainland job remains a transparent lead even if native model produces zero jobs',async()=>{
 const result=await runHybridMainlandJobResearch('fake-key',
  '期望城市：上海\n区督导','区域督导',10,{
   resumeProfile:evidence
  },{
   native:async()=>({matches:[],diagnostic:{searches:2,candidate_links:0,provider_items:5}}),
   search:async(_k,_cv,_h,options)=>searchResponse([{url:OFFICIAL}],options.queriesOverride),
   previews:()=>[job(OFFICIAL)]
  });
 assert.equal(result.matches.length,1);
 assert.equal(result.matches[0].match_score,null);
 assert.equal(result.matches[0].jd_source_status,undefined);
 assert.equal(result.diagnostic.hybrid_fallback.source_previews,1);
});

test('real public job survives a failed native research run, but failure reason is visible',async()=>{
 const err=Object.assign(new Error('AI_EMPLOYER_JOBS_NOT_FOUND'),{
  code:'AI_EMPLOYER_JOBS_NOT_FOUND',
  diagnostic:{phase:'native_source_discovery',searches:3,provider_items:13,candidate_links:0}
 });
 const result=await runHybridMainlandJobResearch('fake-key','期望城市：上海','区域督导',10,{
  resumeProfile:evidence
 },{
  native:async()=>{throw err},
  search:async(_k,_c,_h,o)=>searchResponse([{url:OFFICIAL}],o.queriesOverride),
  previews:()=>[job(OFFICIAL)]
 });
 assert.equal(result.matches.length,1);
 assert.equal(result.diagnostic.native_error,'AI_EMPLOYER_JOBS_NOT_FOUND');
 assert.equal(result.diagnostic.searches,9);
 assert.equal(result.diagnostic.hybrid_fallback.candidate_links,1);
});

test('neither provider returns job links: error remains actionable and keeps safe source diagnostics',async()=>{
 const err=Object.assign(new Error('AI_EMPLOYER_JOBS_NOT_FOUND'),{
  code:'AI_EMPLOYER_JOBS_NOT_FOUND',
  diagnostic:{phase:'native_source_discovery',searches:2,candidate_links:0}
 });
 await assert.rejects(runHybridMainlandJobResearch('test-key','期望城市：上海','区域督导',10,{
  resumeProfile:evidence
 },{
  native:async()=>{throw err},
  search:async(_k,_c,_h,o)=>searchResponse([],o.queriesOverride)
 }),x=>x.code==='AI_EMPLOYER_JOBS_NOT_FOUND'&&
  x.diagnostic?.hybrid_fallback?.searched===6);
});

test('default Agent also receives bounded company-first backup Search instead of returning an unexplained zero',async()=>{
 let count=0,ranAgent=false;
 const result=await runHybridMainlandJobResearch('fake-key','期望城市：上海','区域督导',10,{
  search_engine:'standard',resumeProfile:evidence,
  employerIndex:async()=>({available:true,considered:120,
   queries:['华东汽车 区域督导 招聘 site:careers.hd-auto.cn','某零售集团 区域运营 招聘 site:careers.retail.cn']})
 },{
  native:async()=>{ranAgent=true;return {matches:[],diagnostic:{mode:'AGENT',searches:2}};},
  search:async(_k,_cv,_role,options)=>{
   count=options.queriesOverride.length;
   return searchResponse([{url:OFFICIAL}],options.queriesOverride);
  },
  previews:()=>[job(OFFICIAL)]
 });
 assert.equal(ranAgent,true);
 assert.equal(count,5,'normal Agent limits concurrent backup requests');
 assert.equal(result.matches.length,1);
 assert.equal(result.diagnostic.hybrid_fallback.index_companies_considered,120);
});
test('hybrid is wired to native trial, while normal AI-owned engine and authentic JD gates remain intact',()=>{
 const route=readFileSync(new URL('../functions/api/match-native/[[path]].js',import.meta.url),'utf8');
 assert.match(route,/runHybridMainlandJobResearch\(key,resume,roleHint,limit,options\)/);
 assert.match(route,/runAgentOwnedMainlandMatch\(key,resume,roleHint,limit/);
 assert.match(route,/createMatchJdReview/);
 assert.match(route,/researchDomesticJobEvidence/);
 assert.match(route,/saveMatchHistory/);
});
