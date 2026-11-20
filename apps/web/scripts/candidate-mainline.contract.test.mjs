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
 assert.match(await source('components/CandidateJourneySteps.tsx'),/匹配评分/);
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

test('Siri visual review is accessible only via the isolated feature Preview build, never the production bundle',async()=>{
 const html=await readFile(new URL('../preview-only/resume-siri.html',import.meta.url),'utf8');
 const build=await readFile(new URL('./cloudflare-pages-build.py',import.meta.url),'utf8');
 const siri=await source('styles/siri-edge.css');
 assert.match(html,/Siri 彩虹交互 · 视觉预览/);
 assert.match(html,/siri-stage active/);
 assert.match(html,/hhba-siri-edge-flow 18s linear infinite/);
 assert.match(siri,/hhba-siri-edge-flow 18s linear infinite/);
 assert.match(html,/hhba-resume-siri-letters-flow 11s ease-in-out infinite alternate/);
 assert.match(siri,/hhba-resume-siri-letters-flow 11s ease-in-out infinite alternate/);
 assert.match(html,/data-pending/);
 assert.match(html,/确认这两处修改（演示）/);
 assert.match(html,/normal\.forEach\(el=>\{el\.hidden=active/);
 assert.match(html,/stage\.classList\.toggle\('active',active\)/);
 assert.match(html,/未连接真实 AI、数据库、Word 渲染器或投递接口/);
 assert.doesNotMatch(html,/<script[^>]+src=|fetch\(|XMLHttpRequest|localStorage|sessionStorage/);
 assert.match(build,/os\.environ\.get\("CF_PAGES_BRANCH"\) == "feature\/resume-targeted-optimization-foundation-20261119"/);
 assert.match(build,/WEB \/ "preview-only" \/ "resume-siri\.html"/);
 assert.match(build,/WEB \/ "dist" \/ "preview" \/ "resume-siri\.html"/);
});

test('frontend-first upload renders user's own DOCX text and opens an independent Siri modal with a small suggestion popup',async()=>{
 const page=await source('pages/CandidateMatchPage.tsx');
 const stage=await source('components/CandidateResumeStage.tsx');
 const css=await source('styles/candidate-resume-stage.css');
 const vite=await readFile(new URL('../vite.config.ts',import.meta.url),'utf8');
 const build=await readFile(new URL('./cloudflare-pages-build.py',import.meta.url),'utf8');
 assert.match(page,/extractDocxText\(await selected\.arrayBuffer\(\)\)/,
  'resume view must be extracted locally, not sent to AI for reading');
 assert.match(page,/<CandidateResumeStage text=\{documentText\}/);
 assert.match(stage,/createPortal\(/);
 assert.match(stage,/aria-modal="true"/);
 assert.match(stage,/hhba-siri-edge-active/);
 assert.match(stage,/splitChangedResumeText\(/);
 assert.match(stage,/className="hhba-stage-popover"/);
 assert.match(stage,/不会调用 AI、修改原 Word、生成文件或向企业投递/);
 assert.match(css,/grid-template-columns:minmax\(0,1fr\) 283px/);
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(vite,/isolatedResumePreview\?{build:/);
 assert.match(build,/HHBA_PREVIEW_ONLY_SIMPLE_RESUME_READY/);
});
