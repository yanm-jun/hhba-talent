import test from 'node:test';
import assert from 'node:assert/strict';
import {INDUSTRY_HALL_IDS,selectedIndexIndustries,fallbackIndexIndustries,
 buildIndexedEmployerQueries,indexedEmployerSearchHints}
 from '../functions/_lib/domestic-employer-index.js';
import {runAgentOwnedMainlandMatch} from '../functions/_lib/ai-owned-job-research.js';
import {readFileSync} from 'node:fs';

const rows=[
 {enterprise:'星河汽车有限公司',recruitment_url:'https://careers.xinghe-auto.cn/jobs/',
  source_kind:'employer_careers_candidate',industry_id:'automotive'},
 {enterprise:'长安汽车',recruitment_url:'https://career.changan.com.cn/',
  source_kind:'saved_careers',industry_id:'automotive'},
 {enterprise:'华东汽车',recruitment_url:'https://jobs.huaauto.cn/',
  source_kind:'historical_candidate_url',industry_id:'automotive'},
 {enterprise:'国内零售集团',recruitment_url:'https://careers.cnretail.example.com/',
  source_kind:'saved_careers',industry_id:'retail'},
 {enterprise:'海外招聘公司',recruitment_url:'https://job-boards.greenhouse.io/example/jobs/123456',
  source_kind:'saved_careers',industry_id:'automotive'},
 {enterprise:'另外一家国外招聘平台',recruitment_url:'https://jobs.lever.co/example/11111111-2222-4333-8444-555555555555',
  source_kind:'saved_careers',industry_id:'automotive'},
 {enterprise:'国内大学就业网',recruitment_url:'https://zhaopin.some.edu.cn/jobs/role',
  source_kind:'historical_candidate_url',industry_id:'automotive'},
 {enterprise:'某聚合招聘网',recruitment_url:'https://www.zhipin.com/job_detail/xxx',
  source_kind:'historical_candidate_url',industry_id:'automotive'},
 {enterprise:'某企业',recruitment_url:'http://www.example-auto.cn/jobs',
  source_kind:'saved_careers',industry_id:'automotive'},
 {enterprise:'包含13800138000手机号的公司',recruitment_url:'https://career.example-auto.cn/jobs',
  source_kind:'saved_careers',industry_id:'automotive'},
 {enterprise:'校园候选',recruitment_url:'https://careers.some-company.cn/jobs',
  source_kind:'aggregated_campus_candidate_unverified',industry_id:'automotive'}
];

test('industry library is a routing hint, never authority to search outside 17 known sectors',()=>{
 assert.equal(INDUSTRY_HALL_IDS.length,17);
 assert.deepEqual(selectedIndexIndustries(['automotive','retail','automotive','bogus']),
  ['automotive','retail']);
 assert.deepEqual(fallbackIndexIndustries(['汽车区域督导']),['automotive','retail','manufacturing']);
});

test('the employer library yields only sanitized public search queries, not old links or job records',()=>{
 const queries=buildIndexedEmployerQueries(rows,['区域督导','零售运营'],{limit:8});
 assert.ok(queries.length>=3);
 assert.ok(queries.some(q=>q.includes('星河汽车有限公司')&&q.includes('site:careers.xinghe-auto.cn')));
 assert.ok(queries.every(q=>!q.includes('greenhouse')&&!q.includes('lever.co')&&
  !q.includes('zhipin.com')&&!q.includes('.edu.cn')&&
  !q.includes('13800138000')&&!q.includes('http://')));
 assert.ok(queries.every(q=>q.length<=128));
 assert.ok(queries.every(q=>q.includes('招聘')&&q.includes('职位详情')));
 assert.equal(buildIndexedEmployerQueries(rows,[],{limit:8}).length,0);
});

test('read-only domestic D1 query accepts only industry enums and never sends private resume or credentials',async()=>{
 const binds=[];
 const db={prepare(sql){
  assert.match(sql,/hhba_industry_employer_links/);
  assert.match(sql,/SELECT enterprise,recruitment_url,source_kind,industry_id/);
  assert.doesNotMatch(sql,/\b(INSERT|UPDATE|DELETE)\b/i);
  return {bind(...args){binds.push(...args);return {async all(){return {results:rows}}}}};
 }};
 const result=await indexedEmployerSearchHints({HHBA_JOB_JD_DB:db},
  ['区域督导','零售运营'],['automotive','retail','not-an-industry'],{limit:6});
 assert.deepEqual(binds,['automotive','retail']);
 assert.equal(result.available,true);
 assert.equal(result.considered,rows.length);
 assert.equal(result.queries.length,4);
 assert.ok(result.queries.every(q=>!q.includes('本人')));
 const missing=await indexedEmployerSearchHints({},['区域督导'],['automotive']);
 assert.equal(missing.available,false);
 assert.deepEqual(missing.queries,[]);
});

test('the model-selected domestic enterprise hint causes a new public Search, never directly publishes an indexed vacancy',async()=>{
 const found={id:'j1',title:'星河汽车有限公司 区域督导 上海 招聘',
  source:'星河汽车有限公司',url:'https://careers.xinghe-auto.cn/jobs/regional-supervisor-2026',
  summary:'星河汽车有限公司社会招聘区域督导。工作地点：上海。岗位职责：负责区域门店流程管理及经销商辅导。',
  content:'',availability:{status:'UNKNOWN'}};
 const searches=[],activities=[];
 let indexCalls=0;
 const result=await runAgentOwnedMainlandMatch('synthetic',
  '脱敏简历中有汽车门店督导经历','',10,{
   expandDetailed:false,resumeProfile:{target_roles:['汽车区域督导']},
   employerIndex:async(roles,sectors)=>{
    indexCalls++;
    assert.ok(roles.includes('汽车区域督导'));
    assert.ok(sectors.includes('automotive'));
    return {available:true,considered:51,sectors,
     queries:['星河汽车有限公司 区域督导 社会招聘 site:careers.xinghe-auto.cn']};
   },
   onActivity:x=>activities.push(x.message)
  },{
   plan:async()=>({queries:['汽车岗位 企业官网职位'],industry_ids:['automotive','retail']}),
   search:async(_key,_resume,_hint,{queriesOverride})=>{
    searches.push(...queriesOverride);
    const seen=queriesOverride.some(x=>x.includes('星河汽车有限公司'));
    return {hits:seen?[found]:[],diagnostic:{successful_searches:queriesOverride.length,
     raw_results:seen?1:0,search_failures:0}};
   },
   decide:async()=>({actions:[{type:'finish'}]}),
   select:async(_key,_resume,hits)=>({matches:[{
    id:'job-verified-search',company:'星河汽车有限公司',title:'区域督导',location:'上海',
    official_url:hits[0].url,match_score:84,score_basis:'简历有区域门店督导证据，但完整JD待核实。',
    recommendation_reason:'搜索找到真实的企业招聘职位来源，仍需核对岗位条件。'
   }]})
  });
 assert.equal(indexCalls,1);
 assert.ok(searches.some(q=>q.includes('星河汽车有限公司')));
 assert.equal(result.diagnostic.employer_index.queries,1);
 assert.equal(result.diagnostic.employer_index.new_candidate_links,1);
 assert.ok(activities.some(x=>x.includes('国内企业馆')));
 assert.equal(result.matches[0].official_url,found.url);
});

test('the authenticated matching route wires D1 index hints without sending raw applicant data to public Search',()=>{
 const route=readFileSync(new URL('../functions/api/match-native/[[path]].js',import.meta.url),'utf8');
 const agent=readFileSync(new URL('../functions/_lib/ai-owned-job-research.js',import.meta.url),'utf8');
 assert.match(route,/employerIndex:\(roles,sectors\)=>indexedEmployerSearchHints\(env,roles,sectors/);
 assert.match(agent,/employerIndex\(roles,sectors\)/);
 assert.match(agent,/indexRowsConsidered/);
});
