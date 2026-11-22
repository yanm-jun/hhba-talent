import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assessDomesticEvidence,researchDomesticJobEvidence,DOMESTIC_EVIDENCE_PIPELINE}
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
 assert.match(route,/score:false/);
 assert.match(dialog,/完整岗位 JD 待核验/);
});
