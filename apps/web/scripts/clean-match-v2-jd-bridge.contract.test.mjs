import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {archiveCleanMatchJobs,CLEAN_V2_JD_BRIDGE} from '../functions/_lib/clean-match-v2-jd-bridge.js';

const url='https://careers.tencent.com/jobdesc.html?postId=2097166275703910400';
const base={id:'v2-1',company:'腾讯',title:'销售运营主管',title_zh:'销售运营主管',
 location:'上海',official_url:url,source_status:'SOURCE_SEARCH_PREVIEW',
 evidence_status:'PARTIAL_SOURCE',match_score:null};
const jd={id:'jd_'+'a'.repeat(32),jd_sha256:'b'.repeat(64),
 canonical_url:url,company:'腾讯',title:'销售运营主管',location:'上海',
 checked_at:'2026-11-23T04:00:00Z',fresh:true,
 proof_method:'DIRECT_EMPLOYER_HTML_V1',
 sections:[{id:'JD-001',kind:'responsibilities',text:'负责区域渠道运营与业绩分析'},
  {id:'JD-002',kind:'requirements',text:'具备销售运营及数据分析经验'}]};
const profile={facts:[{id:'CV-1',kind:'work',quote:'负责门店及渠道运营'}]};
const mock=(overrides={})=>({
 ready:async()=>true,
 locator:x=>x===url?{url,company:'腾讯',kind:null}:null,
 read:async()=>jd,
 fetchOfficial:async()=>{throw Error('should use fresh archive');},
 save:async()=>{throw Error('should not save after fresh archive');},
 compare:async()=>({score:85,comparisons:[
  {requirement:jd.sections[0].text,resume_evidence:profile.facts[0].quote,status:'supported'}]}),
 ...overrides
});

test('Clean V2 verified JD bridge unlocks original Word editor using immutable archived metadata',async()=>{
 const updates=[];
 const result=await archiveCleanMatchJobs({},'test-key',profile,[base],{
  onPartial:x=>updates.push(x)
 },mock());
 assert.equal(result.diagnostic.mode,CLEAN_V2_JD_BRIDGE);
 assert.equal(result.diagnostic.eligible,1);
 assert.equal(result.diagnostic.verified,1);
 assert.equal(result.diagnostic.scored,1);
 assert.equal(result.matches[0].jd_source_status,'VERIFIED_JD');
 assert.equal(result.matches[0].jd_version_id,jd.id);
 assert.equal(result.matches[0].jd_sha256,jd.jd_sha256);
 assert.equal(result.matches[0].match_score,85);
 assert.equal(result.matches[0].evidence_status,'VERIFIED_FULL_JD');
 assert.equal(result.matches[0].jd_comparisons[0].resume_evidence,profile.facts[0].quote);
 assert.ok(updates.length>0);
 const component=readFileSync(new URL('../src/components/CandidateMatchNativeDialog.tsx',import.meta.url),'utf8');
 assert.match(component,/!job\.jd_version_id\|\|!job\.jd_sha256/);
 const route=readFileSync(new URL('../functions/api/match-next/[[path]].js',import.meta.url),'utf8');
 assert.match(route,/archiveCleanMatchJobs/);
});

test('missing archive infrastructure never creates fake verified JD or destroys public-source candidate',async()=>{
 const result=await archiveCleanMatchJobs({},'key',profile,[base],{},
  mock({ready:async()=>false}));
 assert.equal(result.diagnostic.not_ready,true);
 assert.deepEqual(result.matches,[base]);
 assert.equal(result.matches[0].jd_version_id,undefined);
});

test('wrong job, company or city in archive does not promote a merely plausible employer link',async()=>{
 for(const broken of [
  {...jd,company:'其他公司'},{...jd,title:'产品研发工程师'},
  {...jd,location:'北京'},{...jd,canonical_url:url+'x'},
  {...jd,sections:[jd.sections[0]]}
 ]){
  const result=await archiveCleanMatchJobs({},'key',profile,[base],{},
   mock({read:async()=>broken}));
  assert.equal(result.matches[0].jd_source_status,undefined);
  assert.equal(result.matches[0].jd_version_id,undefined);
  assert.equal(result.diagnostic.failed,1);
 }
});

test('model score failure retains the fully verified JD but does not invent a numeric match score',async()=>{
 const result=await archiveCleanMatchJobs({},'key',profile,[base],{},
  mock({compare:async()=>{throw Error('model 503')}}));
 assert.equal(result.matches[0].jd_source_status,'VERIFIED_JD');
 assert.equal(result.matches[0].match_score,null);
 assert.equal(result.diagnostic.verified,1);
 assert.equal(result.diagnostic.scored,0);
});

test('only independently supported mainland employer URLs are eligible for JD archive bridge',async()=>{
 const foreign={...base,official_url:'https://jobs.lever.co/company/123'};
 const rows=[base,foreign,{...base,official_url:'https://zhipin.com/job_detail/123'}];
 const result=await archiveCleanMatchJobs({},'key',profile,rows,{},mock());
 assert.equal(result.diagnostic.eligible,1);
 assert.equal(result.matches.length,3);
 assert.equal(result.matches[1].jd_version_id,undefined);
 assert.equal(result.matches[2].jd_version_id,undefined);
});
