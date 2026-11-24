import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isMainlandEmployerJobUrl,recruitmentSourceKind}
 from '../functions/_lib/match-employer-source.js';
import {normalizeHits,sourceOnlyJobPreviews}
 from '../functions/_lib/deepseek-search-match.js';
import {runAgentOwnedMainlandMatch}
 from '../functions/_lib/ai-owned-job-research.js';

const hit={
 id:'j1',title:'华东星海汽车有限公司 · 区域渠道督导 · 上海 招聘',
 url:'https://www.xinghai-auto.cn/recruitment/positions/regional-supervisor-2026',
 summary:'华东星海汽车有限公司社会招聘区域渠道督导。工作地点：上海。岗位职责：培训经销商销售顾问、复盘线索转化、管理区域门店。任职要求有良好沟通协作能力和渠道管理相关经验。',
 snippet:'华东星海汽车有限公司区域渠道督导 工作地点：上海',
 source:'华东星海汽车有限公司',availability:{status:'UNKNOWN'}
};
test('company recruitment-route jobs are candidates, but generic jobs/positions on unknown boards are not',()=>{
 assert.equal(isMainlandEmployerJobUrl(hit.url),true);
 assert.equal(recruitmentSourceKind(hit.url),'EMPLOYER_DOMAIN_CANDIDATE');
 assert.equal(isMainlandEmployerJobUrl('https://www.zhipin.com/jobs/123456789'),false);
 assert.equal(isMainlandEmployerJobUrl('https://www.unidentified-careers-board.com/positions/123456789'),false);
 assert.equal(isMainlandEmployerJobUrl('https://www.indeed.com/positions/123456789'),false);
 const result=normalizeHits([{results:[{...hit,site_name:hit.source}]}]);
 assert.equal(result.length,1);
});
test('a Source-only preview needs real employer, distinct role, explicit Chinese work city, and has NO invented match score',()=>{
 const previews=sourceOnlyJobPreviews([hit],10);
 assert.equal(previews.length,1);
 assert.equal(previews[0].official_url,hit.url);
 assert.equal(previews[0].company,'华东星海汽车');
 assert.equal(previews[0].title,'区域渠道督导');
 assert.equal(previews[0].location,'上海');
 assert.equal(previews[0].match_score,null);
 assert.equal(previews[0].source_status,'SOURCE_SEARCH_PREVIEW');
 assert.match(previews[0].recommendation_reason,/尚未得到足够的模型回复/);
 assert.deepEqual(sourceOnlyJobPreviews([{...hit,summary:'岗位不详',snippet:'公司总部在上海'}]),[]);
 assert.deepEqual(sourceOnlyJobPreviews([{...hit,url:'https://www.zhipin.com/job_detail/abc'}]),[]);
});
test('AI selection timeout preserves grounded positions instead of a false no-jobs verdict, while emitting actual activity',async()=>{
 const activity=[];
 const result=await runAgentOwnedMainlandMatch('fake-key','曾辅导经销商DCC运营，并培训区域销售团队','',10,{
  expandDetailed:false,onActivity:x=>activity.push(x)
 },{
  plan:async()=>({queries:['区域督导 渠道培训 上海 企业招聘']}),
  search:async()=>({hits:[hit],diagnostic:{
   successful_searches:1,raw_results:12,candidate_links:1,
   rejected_links:11,search_failures:0}}),
  decide:async()=>({actions:[{type:'finish'}],shortlist_ids:['j1']}),
  select:async()=>{const err=new Error('AI_MATCH_REASON_TIMEOUT');err.code=err.message;throw err;}
 });
 assert.equal(result.matches.length,1);
 assert.equal(result.matches[0].official_url,hit.url);
 assert.equal(result.matches[0].match_score,null);
 assert.ok(result.diagnostic.selection_failures>=1);
 assert.equal(result.diagnostic.selection_rounds,2,'a sparse shortlist receives one independent follow-up comparison');
 assert.ok(activity.some(x=>x.searches===1&&x.raw_results===12&&x.candidate_links===1));
 assert.ok(activity.some(x=>x.stage==='writing'&&x.message.includes('待核实线索')),
  'real sources remain visible as explicitly unscored research leads');
});
test('credential/usage problems are never swallowed and never misreported as a lack of suitable jobs',async()=>{
 for(const code of ['AI_PROVIDER_KEY_REJECTED','AI_PROVIDER_BALANCE_INSUFFICIENT',
  'AI_PROVIDER_RATE_LIMITED','AI_SEARCH_API_REJECTED','AI_SEARCH_UNAVAILABLE']){
  await assert.rejects(runAgentOwnedMainlandMatch('fake-key','渠道运营简历','',10,{
   expandDetailed:false
  },{
   plan:async()=>({queries:['企业渠道督导 上海 招聘']}),
   search:async()=>{const e=new Error(code);e.code=code;throw e},
   decide:async()=>{throw Error('should not wait for decision')}
  }),e=>e.code===code);
 }
});
test('the modal shows current progress while SSE retains search metrics',()=>{
 const app=readFileSync(new URL('../src/components/CandidateMatchNativeDialog.tsx',import.meta.url),'utf8');
 const service=readFileSync(new URL('../src/services/resumeMatch.ts',import.meta.url),'utf8');
 const route=readFileSync(new URL('../functions/api/match-native/[[path]].js',import.meta.url),'utf8');
 assert.match(app,/stageTitle\[progressStage\]/);
 assert.match(app,/已形成 \{result\.matches\.length\} 个正式推荐/);
 assert.doesNotMatch(app,/DeepSeek|候选来源/);
 assert.match(service,/event==='activity'/);
 assert.match(service,/onActivity\?\.\(/);
 assert.match(route,/send\('activity',detail\)/);
 assert.match(route,/send\('heartbeat',/);
 assert.ok(!route.includes("send('progress',{stage:'waiting'})"),
  'heartbeat must not pretend to be a substantive progress stage');
});
