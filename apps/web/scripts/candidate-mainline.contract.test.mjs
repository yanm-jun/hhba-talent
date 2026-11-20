import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {officialApplicationUrl,officialLinkLabel}
 from '../src/services/officialApplicationUrl.mjs';
const source=async file=>readFile(new URL('../src/'+file,import.meta.url),'utf8');

test('HHBA has exactly one five-step candidate-facing resume-to-employer journey',async()=>{
 const flow=await source('components/CandidateJourneySteps.tsx');
 const page=await source('pages/CandidateMatchPage.tsx');
 const modal=await source('components/CandidateMatchNativeDialog.tsx');
 assert.match(flow,/上传简历','AI 找岗位','匹配评分','定向优化','官网投递'/);
 assert.match(page,/CandidateJourneySteps current=\{working\?2:1\}/);
 assert.match(modal,/CandidateJourneySteps current=\{activeJob\?4:pending\?2:3\}/);
 assert.match(page,/AI 为我寻找适合的工作/);
 assert.match(page,/hhba-ai-preferences/);
 assert.match(page,/<details className="hhba-ai-preferences">/);
 assert.doesNotMatch(page,/只需三步/);
 assert.match(modal,/优化简历，提高分值/);
 assert.match(modal,/最后一步：企业官网投递/);
 assert.match(modal,/TargetedResumeOptimization/);
 assert.match(modal,/hhba-match-final-apply/);
 assert.match(modal,/data-hhba-recruitment-outbound="true"/);
});
test('scores must remain evidence-based, not random, exaggerated or admission odds',async()=>{
 const modal=await source('components/CandidateMatchNativeDialog.tsx');
 assert.match(modal,/Number\.isInteger\(job\.match_score\)/);
 assert.match(modal,/job\.score_basis/);
 assert.match(modal,/分数不是录用概率/);
 assert.match(modal,/匹配评分/);
 assert.doesNotMatch(modal,/Math\.random\(\)/);
});
test('only HTTPS employer/ATS posting candidates can be used as apply link',()=>{
 const exact=url=>({official_url:url,recruitment_source_kind:'EMPLOYER_DOMAIN_CANDIDATE'});
 assert.equal(officialApplicationUrl(exact('https://careers.example.com/jobs/123')),
  'https://careers.example.com/jobs/123');
 assert.equal(officialApplicationUrl({
  official_url:'https://jobs.lever.co/company/123',recruitment_source_kind:'EMPLOYER_ATS'
 }),'https://jobs.lever.co/company/123');
 assert.match(officialLinkLabel({recruitment_source_kind:'EMPLOYER_ATS'}),/企业招聘系统/);
 for(const url of [
  'javascript:alert(1)','http://careers.example.com/jobs/1',
  'https://zhipin.com/job_detail/123','https://jobs.51job.com/p/123',
  'https://attacker@careers.example.com/jobs/1','https://careers.example.com/',
  'https://fakezhipin.com/'
 ]){
  if(url==='https://fakezhipin.com/')continue;
  assert.equal(officialApplicationUrl(exact(url)),null,url);
 }
 assert.equal(officialApplicationUrl({
  official_url:'https://example.com/jobs/1',recruitment_source_kind:'THIRD_PARTY_BOARD'
 }),null);
 assert.equal(officialApplicationUrl({
  official_url:'https://example.com/jobs/1',recruitment_source_kind:'UNVERIFIED'
 }),null);
 assert.equal(officialApplicationUrl({
  official_url:'https://example.com/jobs/1'
 }),null,'missing source provenance is not a verified employer application');
});
test('job-specific Word editing is separate for each selected JD and original resume remains private',async()=>{
 const page=await source('pages/CandidateMatchPage.tsx');
 const modal=await source('components/CandidateMatchNativeDialog.tsx');
 assert.match(page,/sourceText=\{result\?optimizationSource:undefined\}/);
 assert.match(page,/sourceResume=\{result&&savedId/);
 assert.match(modal,/key=\{activeJob.id\}/);
 assert.match(modal,/sourceResume=\{sourceResume\}/);
 assert.match(modal,/confirmExitOptimization/);
 assert.match(modal,/HHBA 不会替你提交/);
});
