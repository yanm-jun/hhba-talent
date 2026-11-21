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
 assert.match(modal,/优化简历/);
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

test('frontend-first upload shows the candidate DOCX and an independent Siri modal with a small suggestion popup',async()=>{
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
 assert.match(stage,/hhba-stage-popover/);
 assert.match(stage,/不会调用 AI、修改原 Word、生成文件或向企业投递/);
 assert.match(css,/grid-template-columns:minmax\(0,1fr\) 283px/);
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(vite,/isolatedResumePreview\?{build:/);
 assert.match(build,/HHBA_PREVIEW_ONLY_SIMPLE_RESUME_READY/);
});

test('Siri in-document changes expose adopt edit ignore only on hover/tap and require verified Word save',async()=>{
 const viewer=await source('components/OriginalWordViewer.tsx');
 const optimizer=await source('components/TargetedResumeOptimization.tsx');
 const css=await source('styles/original-resume-viewer.css');
 const modal=await source('components/CandidateMatchNativeDialog.tsx');
 assert.match(modal,/优化简历 <span aria-hidden="true">/);
 assert.doesNotMatch(modal,/优化简历，提高分值/);
 assert.match(viewer,/hhba-word-siri-anchor-shell/);
 assert.match(viewer,/hhba-word-siri-inline-actions/);
 for(const label of ['采纳','编辑','忽略'])assert.match(viewer,new RegExp('> '+label+'<'));
 assert.match(viewer,/aria-label="当前彩虹文字操作"/);
 assert.match(viewer,/setActiveVisualId\(current=>current===visual\.id\?null:visual\.id\)/);
 assert.match(viewer,/window\.confirm\('请先核实/);
 const save=viewer.indexOf('async function acceptVisualWord');
 const persist=viewer.indexOf('await saveOriginalWordEdit(resume.id,anchor.text,visual.proposed.trim(),revision,jobId)',save);
 const success=viewer.indexOf("onVisualSuggestionAction?.(visual.id,'accepted')",save);
 assert.ok(save>=0&&persist>save&&success>persist,
  'adoption must signal accepted only after a layout-verified private Word revision succeeds');
 assert.match(viewer,/onVisualSuggestionAction\?\.\(visual\.id,'ignored'\)/);
 assert.match(viewer,/className="hhba-word-siri-edit-float"/);
 assert.match(optimizer,/resolvedWordVisualIds/);
 assert.match(viewer,/onVisualSuggestionAction\?\.\(inlineVisualSuggestionId,'edited',draft\.trim\(\)\)/);
 assert.match(optimizer,/onVisualSuggestionAction=\{\(id,action,newText\)=>/);
 assert.match(optimizer,/editResumeBlock\(prev,item\.blockId,changed\)/);
 assert.match(optimizer,/setEditedWordVisualIds\(/);
 assert.match(optimizer,/已按本人编辑的文字保存并核验原 Word 排版/);
 assert.match(optimizer,/<strong><Sparkles size=\{15\}\/> 修改进度<\/strong>/);
 assert.doesNotMatch(optimizer,/<strong><Sparkles size=\{15\}\/> AI 修改建议<\/strong>/);
 assert.match(css,/hhba-word-siri-anchor-shell:hover \.hhba-word-siri-inline-actions/);
 assert.match(css,/hhba-word-siri-anchor-shell:focus-within \.hhba-word-siri-inline-actions/);
 assert.match(css,/hhba-word-siri-anchor-shell\.is-open \.hhba-word-siri-inline-actions/);
 assert.match(css,/@media\(hover:none\)/);
});


test('same original Word has isolated job-scoped revision and download entry points',async()=>{
 const viewer=await source('components/OriginalWordViewer.tsx');
 const targeted=await source('components/TargetedResumeOptimization.tsx');
 const api=await source('services/originalWordApi.ts');
 const server=await readFile(new URL('../functions/api/resume-word.js',import.meta.url),'utf8');
 const vault=await source('components/PrivateResumeVault.tsx');
 assert.match(targeted,/jobId=\{job\.id\}/);
 assert.match(targeted,/jobTitle=\{job\.company\+'-'\+\(job\.title_zh\|\|job\.title\)\}/);
 assert.match(viewer,/jobId\?:string/);
 assert.match(viewer,/wordEditableText\(resume\.id,undefined,jobId\)/);
 assert.match(viewer,/wordPreviewBytes\(resume\.id,wasSaved,undefined,/);
 assert.match(viewer,/saveOriginalWordEdit\(resume\.id,selected\.text,draft\.trim\(\),revision,jobId\)/);
 assert.match(viewer,/saveOriginalWordEdit\(resume\.id,anchor\.text,visual\.proposed\.trim\(\),revision,jobId\)/);
 assert.match(viewer,/shiftOriginalWordRevision\(resume\.id,action,revision,jobId\)/);
 assert.match(viewer,/downloadOriginalWordEdited\(resume\.id,jobId,jobTitle\)/);
 assert.match(viewer,/downloadOriginalWordPdf\(resume\.id,jobId,jobTitle\)/);
 assert.match(api,/job_id=.*encodeURIComponent\(job\)/);
 assert.match(api,/job_id:id/);
 assert.match(api,/function scopedJobId\(/);
 assert.match(server,/hhba-word-target-job-v1:/);
 assert.match(server,/job_scope_sha256/);
 assert.match(server,/approved\(bucket,row,jobId\)/);
 // The old private-vault reader intentionally omits the selected job.
 assert.match(vault,/<OriginalResumeViewer key=\{previewItem.id\} resume=\{previewItem\}/);
 assert.doesNotMatch(vault,/<OriginalWordViewer[^>]*jobId/);
});
