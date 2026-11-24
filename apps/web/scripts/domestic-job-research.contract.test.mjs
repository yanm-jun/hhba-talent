import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assessDomesticEvidence,researchDomesticJobEvidence,DOMESTIC_EVIDENCE_PIPELINE,compactResearchResumeEvidence}
 from '../functions/_lib/domestic-job-research.js';
import {allowedEmployerJobLink,isMainlandEmployerJobUrl}
 from '../functions/_lib/match-employer-source.js';
import {normalizeHits} from '../functions/_lib/deepseek-search-match.js';

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
test('bounded DeepSeek searches contain only public company/role/city; AI scores sourced partials',async()=>{
 const calls=[],redacted='本人负责汽车销售门店渠道运营、数据分析和经销商培训。';
 const fetcher=async(url,args)=>{
  const body=JSON.parse(args.body);calls.push({url,body});
  if(url.endsWith('/v1/tools/search'))
   return new Response(JSON.stringify({results:[hit()]}),{status:200});
  if(url.endsWith('/responses'))
   return new Response(JSON.stringify({output:[{type:'message',content:[{
    type:'output_text',text:JSON.stringify({jobs:[{id:'search-j1',match_score:82,
     score_basis:'这份岗位公开职责包括区域门店经营分析与经销商培训，简历中的渠道运营和数据分析经验相关，但具体工作年限尚待官网确认。'}]})
   }]}]}),{status:200});
  throw Error('unexpected '+url);
 };
 const result=await researchDomesticJobEvidence('synthetic-key',redacted,[post()],{fetcher});
 assert.equal(result.diagnostic.mode,DOMESTIC_EVIDENCE_PIPELINE);
 assert.equal(result.diagnostic.scored,1);
 assert.equal(result.matches[0].match_score,82);
 assert.equal(result.matches[0].evidence_status,'PARTIAL_SOURCE');
 assert.equal(result.matches[0].evidence_score_status,'AI_PARTIAL_SOURCE_SCORED');
 assert.equal(calls.filter(x=>x.url.endsWith('/search')).length,1);
 assert.ok(calls[0].body.query.includes('区域督导'));
 assert.ok(!calls[0].body.query.includes('本人负责'), 'CV never goes to public Search');
 assert.equal(calls[0].body.need_content,false);
 assert.equal(calls[1].body.model,'deepseek-v4-pro');
});
test('failed search/model or explicit research killswitch does not revive unsupported model scores',async()=>{
 const failed=await researchDomesticJobEvidence('synthetic','redacted cv',[post()],{},
  {search:async()=>{throw Error('not accessible')},score:async()=>{throw Error('provider down')}});
 assert.equal(failed.matches[0].match_score,null);
 assert.equal(failed.diagnostic.search_failures,1);
 const disabled=await researchDomesticJobEvidence('synthetic','redacted cv',[post()],
  {enabled:false},{search:async()=>{throw Error('must not run')}});
 assert.equal(disabled.matches[0].match_score,null);
});
test('verified local employer JD keeps canonical hash/score and never triggers public research',async()=>{
 const pinned=post({jd_source_status:'VERIFIED_JD',jd_version_id:'jd_'+'a'.repeat(32),
  jd_sha256:'f'.repeat(64),match_score:86,reference_score:86});
 const out=await researchDomesticJobEvidence('test','some cv',[pinned],{},
  {search:async()=>{throw Error('verified JDs need no extra search')}});
 assert.equal(out.matches[0].evidence_status,'VERIFIED_FULL_JD');
 assert.equal(out.matches[0].match_score,86);
 assert.equal(out.matches[0].jd_version_id,pinned.jd_version_id);
});

test('AI role-direction fit remains preliminary; unsupported candidates never inherit shortlist scores',async()=>{
 const direction=post({
  research_anchor:hit({summary:'星河汽车有限公司发布区域督导职位。工作地点：济南。详情和任职资格请查看官网。',
   snippet:'星河汽车有限公司 区域督导 济南'})
 });
 const unknown=post({id:'search-j2',company:'另一家汽车公司',official_url:REMOTE,
  match_score:97,reference_score:97,score_basis:'模型上游旧评分'});
 const fetcher=async(url,args)=>{
  if(url.endsWith('/v1/tools/search'))
   return new Response(JSON.stringify({results:[]}),{status:200});
  const batch=JSON.parse(args.body).input;
  assert.match(batch,/本人负责汽车零售门店/);
  return new Response(JSON.stringify({output:[{type:'message',content:[{type:'output_text',
   text:JSON.stringify({jobs:[
    {id:'search-j1',match_score:78,
     score_basis:'结合简历中的汽车零售门店运营经历，这个岗位名称与区域督导方向一致，但尚未核实企业公开的具体岗位职责与任职条件，只能作为方向参考。',
     resume_evidence:'简历写明本人负责汽车零售门店的流程管理及销售培训。',
     role_relation:'页面公开列有区域督导岗位，职业方向与过去门店督导工作有关联。',
     unknowns:'工作年限、学历要求、薪酬以及实际日常职责都没有得到可靠确认。',
     next_step:'打开企业招聘页面核对最新具体 JD 和官方申请状态。'},
    {id:'search-j2',match_score:97,score_basis:'虽然简历经历相关，但该岗位并没有可靠的公开职责或公司归属证据，应当暂时留空。'}
   ]})}]}]}),{status:200});
 };
 const result=await researchDomesticJobEvidence('test','本人负责汽车零售门店的流程管理及销售培训。',[direction,unknown],
  {fetcher});
 assert.equal(result.matches.find(x=>x.id==='search-j1').evidence_status,'SEARCH_SNIPPET_ONLY');
 assert.equal(result.matches.find(x=>x.id==='search-j1').evidence_score_status,'AI_DIRECTION_REFERENCE_SCORED');
 assert.equal(result.matches.find(x=>x.id==='search-j1').match_score,78);
 assert.match(result.matches.find(x=>x.id==='search-j1').recommendation_reason,/待核实条件/);
 assert.equal(result.matches.find(x=>x.id==='search-j2').evidence_status,'INSUFFICIENT_EVIDENCE');
 assert.equal(result.matches.find(x=>x.id==='search-j2').match_score,null);
 assert.equal(result.diagnostic.scored,1);
});

test('original matching/history/Word path all use researched source evidence',()=>{
 const route=readFileSync(new globalThis.URL('../functions/api/match-native/[[path]].js',import.meta.url),'utf8');
 const history=readFileSync(new globalThis.URL('../functions/_lib/match-history.js',import.meta.url),'utf8');
 const word=readFileSync(new globalThis.URL('../src/components/TargetedResumeOptimization.tsx',import.meta.url),'utf8');
 const dialog=readFileSync(new globalThis.URL('../src/components/CandidateMatchNativeDialog.tsx',import.meta.url),'utf8');
 assert.match(route,/researchDomesticJobEvidence/);
 assert.match(route,/domesticOnly:true/);
 assert.match(route,/onPartial\(provisionalPartial\(review\?review\.preview\(fresh\):fresh\)\)/);
 assert.match(history,/evidence_excerpt:/);
 assert.match(word,/job\.evidence_status==='PARTIAL_SOURCE'/);
 assert.match(route,/researchDomesticJobEvidence\(key,resume,result\.matches/);
 assert.match(route,/onProgress:progress/);
 assert.doesNotMatch(route,/score:false/);
 const panels=readFileSync(new globalThis.URL('../src/components/MatchResearchPanels.tsx',import.meta.url),'utf8');
 assert.match(panels,/尚未取得可核验原文/);
 assert.match(panels,/方向参考分/);
 assert.match(panels,/初步参考分/);
});
