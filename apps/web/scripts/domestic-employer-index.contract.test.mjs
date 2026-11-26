import test from 'node:test';
import assert from 'node:assert/strict';
import {INDUSTRY_HALL_IDS,selectedIndexIndustries,fallbackIndexIndustries,
 buildIndexedEmployerQueries,indexedEmployerSearchHints}
 from '../functions/_lib/domestic-employer-index.js';
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

test('legacy index helpers remain covered while V4 does not depend on them',()=>{
 const route=readFileSync(new URL('../functions/api/match-v4/[[path]].js',import.meta.url),'utf8');
 const agent=readFileSync(new URL('../functions/_lib/ai-owned-job-research.js',import.meta.url),'utf8');
 assert.match(agent,/employerIndex\(roles,sectors\)/);
 assert.match(agent,/indexRowsConsidered/);
 assert.match(route,/officialOnly:true,curated:true/);
 assert.doesNotMatch(route,/indexedEmployerSearchHints|HHBA_MATCH_DEEPSEEK_KEY/);
});
