import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assessDomesticEvidence,DOMESTIC_EVIDENCE_PIPELINE,compactResearchResumeEvidence} from './fixtures/retired-partial-evidence.mjs';
import {allowedEmployerJobLink,isMainlandEmployerJobUrl}
 from '../functions/_lib/match-employer-source.js';
import {normalizeHits} from './fixtures/retired-search-evidence.mjs';

const URL='https://careers.xinghe-cn.com/jobs/regional-supervisor-2026';
const REMOTE='https://careers.xinghe-cn.com/jobs/regional-supervisor-2027';
const quote='星河汽车有限公司 区域督导 济南，岗位职责：负责销售门店经营分析、经销商运营、培训和渠道管理；任职要求：具备汽车行业经历、数据分析能力与良好的沟通经验。';
const post=(extras={})=>({id:'search-j1',company:'星河汽车有限公司',
 title:'区域督导',location:'济南',official_url:URL,match_score:99,reference_score:99,
 score_basis:'仅由模型输出的旧分数',recommendation_reason:'模型未核验的推断',
 ...extras});
const hit=(extras={})=>({url:URL,title:'星河汽车有限公司 区域督导 济南 招聘',
 summary:quote.repeat(2),site_name:'星河汽车',...extras});
test('reuses only original resume quotes already checked by the recognition Agent',()=>{
 const raw='学历本科。门店销售、DCC 转化率改善及区域经销商培训。'.repeat(180);
 const verified={facts:[
  {kind:'work',quote:'本人负责区域经销商辅导和门店销售流程培训，持续改善门店转化。'},
  {kind:'skill',quote:'分析 DCC 线索转化率、到店率和试驾情况，并制作数据报告。'},
  {kind:'project',quote:'组织多个直营网点开展终端运营巡店、问题复盘与整改。'},
  {kind:'work',quote:'本人负责区域经销商辅导和门店销售流程培训，持续改善门店转化。'}
 ]};
 const compact=compactResearchResumeEvidence(raw,verified);
 assert.ok(compact.length<raw.length);
 assert.match(compact,/CV-1 本人负责区域经销商辅导/);
 assert.match(compact,/CV-2 分析 DCC/);
 assert.equal((compact.match(/本人负责区域经销商辅导/g)||[]).length,1);
 assert.equal(compactResearchResumeEvidence(raw,{facts:[verified.facts[0]]}),raw.slice(0,10000),
  'short or incomplete fact collections fall back to the original redacted resume');
});

test('no Greenhouse, Lever, Workday or Ashby in new mainland job discovery or history',()=>{
 for(const url of [
  'https://job-boards.greenhouse.io/company/jobs/1234567',
  'https://jobs.lever.co/company/abc',
  'https://jobs.ashbyhq.com/company/abc',
  'https://company.myworkdayjobs.com/careers/jobs/test'
 ])assert.equal(allowedEmployerJobLink(url),false,url);
 assert.equal(isMainlandEmployerJobUrl(URL),true);
 assert.equal(normalizeHits([{results:[hit(),...[
  'https://jobs.lever.co/company/abc','https://job-boards.greenhouse.io/company/jobs/1234567'
 ].map(url=>hit({url}))]}]).length,1);
});
test('title-only candidate and unrelated employer evidence never create a numeric score',()=>{
 const noInfo=assessDomesticEvidence(post(),[]);
 assert.equal(noInfo.evidence_status,'INSUFFICIENT_EVIDENCE');
 assert.equal(noInfo.match_score,null);
 const wrong=assessDomesticEvidence(post(),[
  hit({title:'另一家公司 区域督导 济南',site_name:'另一家公司',summary:'另一家公司 区域督导 济南 '+quote.repeat(2),
   url:'https://careers.other-cn.com/jobs/regional-supervisor'})
 ]);
 assert.equal(wrong.match_score,null);
 assert.equal(wrong.evidence_status,'INSUFFICIENT_EVIDENCE');
});
test('indexed source excerpts are PARTIAL, not a verified full JD',()=>{
 const assessed=assessDomesticEvidence(post({research_anchor:hit()}));
 assert.equal(assessed.evidence_status,'PARTIAL_SOURCE');
 assert.equal(assessed.jd_version_id,undefined);
 assert.equal(assessed.match_score,null);
 assert.equal(assessed.evidence_sources.length,1);
 assert.match(assessed.evidence_excerpt,/岗位职责/);
 assert.ok(!('full_jd' in assessed));
});
test('public WeChat article can corroborate but cannot masquerade as verified employer JD',()=>{
 const article=hit({url:'https://mp.weixin.qq.com/s?__biz=Mzk0Test123&mid=123456',
   title:'星河汽车有限公司 区域督导 济南 招聘',summary:quote.repeat(2)});
 const x=assessDomesticEvidence(post(),[article]);
 assert.equal(x.evidence_sources[0].kind,'PUBLIC_ANNOUNCEMENT_CANDIDATE');
 assert.equal(x.evidence_status,'SEARCH_SNIPPET_ONLY');
 assert.equal(x.match_score,null);
});
test('original matching/history/Word path all use researched source evidence',()=>{
 const route=readFileSync(new globalThis.URL('../functions/api/match-v4/[[path]].js',import.meta.url),'utf8');
 const history=readFileSync(new globalThis.URL('../functions/_lib/match-history.js',import.meta.url),'utf8');
 const word=readFileSync(new globalThis.URL('../src/components/TargetedResumeOptimization.tsx',import.meta.url),'utf8');
 const dialog=readFileSync(new globalThis.URL('../src/components/CandidateMatchNativeDialog.tsx',import.meta.url),'utf8');
 assert.match(history,/evidence_excerpt:/);
 assert.match(word,/job\.evidence_status==='PARTIAL_SOURCE'/);
 const panels=readFileSync(new globalThis.URL('../src/components/MatchResearchPanels.tsx',import.meta.url),'utf8');
 assert.match(panels,/尚未取得可核验原文/);
 assert.match(panels,/方向参考分/);
 assert.match(panels,/初步参考分/);
 assert.match(route,/v4Match\(fetch,v4JobProvider\(env\)/);
 assert.match(route,/officialOnly:true,curated:true/);
 assert.match(route,/onPartial:matches=>/);
 assert.match(route,/onProgress:progress/);
 assert.match(route,/saveMatchHistory\(env\.HHBA_PNVS_AUTH_DB/);
});
