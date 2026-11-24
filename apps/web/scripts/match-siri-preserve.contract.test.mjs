import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const dialog=read('../src/components/CandidateMatchNativeDialog.tsx');
const page=read('../src/pages/CandidateMatchPage.tsx');
const style=read('../src/styles/resume-match-dialog.css');
const optimizer=read('../src/components/TargetedResumeOptimization.tsx');
const word=read('../src/components/OriginalWordViewer.tsx');
const backend=read('../functions/api/resume-word.js');

test('the simpler result cards preserve the original Word editor and the selected posting',()=>{
 const panels=read('../src/components/MatchResearchPanels.tsx');
 const preserved=['岗位匹配','hhba-match-history-confirm','data-hhba-recruitment-outbound="true"','保存到我的简历','完成查看'];
 for(const value of preserved)assert.ok(dialog.includes(value),'preserve result workflow: '+value);
 for(const value of ['匹配分用于求职参考，不是录用概率。','job.company','job.title_zh||job.title','job.location',"jdJob.availability_status==='OPEN_LISTED'",'job.match_score','jdJob.score_basis','jdJob.recommendation_reason','job.official_url'])assert.ok(panels.includes(value),'preserve unified result information: '+value);
 assert.match(dialog,/className=\{'hhba-match-modal'\+\(optimizedJobUrl\?' hhba-match-modal-editor':''\)\}/);
 assert.match(dialog,/result\.matches\.find\(job=>job\.official_url===optimizedJobUrl\)\|\|researchJobs\.find/);
 assert.match(panels,/<button type="button" disabled=\{pending\|\|!optimizationAvailable\|\|!jdJob\.jd_version_id\|\|!jdJob\.jd_sha256\}/);
 assert.match(panels,/className="hhba-native-optimize"/);
 assert.match(panels,/> 优化简历/);
 assert.match(dialog,/onOptimize=\{optimizeJob\}/);
 assert.match(dialog,/setSelectedJobUrl\(job\.official_url\)/);
 assert.match(dialog,/<TargetedResumeOptimization key=\{activeJob\.id\}/);
 assert.match(dialog,/onDraftDirtyChange=\{setOptimizationDirty\}/);
 assert.match(dialog,/const matchListScroll=useRef\(0\)/);
 assert.match(dialog,/viewport\.scrollTop=optimizedJobUrl\?0:matchListScroll\.current/);
 assert.match(dialog,/if\(optimizedJobUrl\)\{backToMatches\(\);return\}/);
 assert.match(dialog,/\{optimizedJobUrl\?'返回匹配结果':pending\?'最小化':'完成查看'\}/);
 assert.match(dialog,/stageTitle\[progressStage\]/);
 assert.match(dialog,/!pending&&activeJob&&parsedProfile/);
 assert.doesNotMatch(dialog,/<CandidateJourneySteps/);
});

test('homepage & candidate workbench keep original matcher route and PDF/DOCX flow',()=>{
 assert.match(page,/const supportedTypes='\.pdf,\.docx,/);
 assert.match(page,/id="hhba-ai-resume"/);
 assert.match(page,/checked=\{consent\}/);
 assert.match(page,/checked=\{storageChoice==='save'\}/);
 assert.match(page,/checked=\{storageChoice==='once'\}/);
 assert.match(page,/AI 为我寻找适合的工作|开始智能匹配/);
 assert.match(page,/matched=await submitExtractedResumeText\(previewText,options,consent,abort\.signal,matchResumeId\|\|undefined,/);
 assert.match(page,/setOptimizationSource\(redactResumeTextLocally\(previewText\)\)/);
 assert.match(page,/sourceText=\{result\?optimizationSource:undefined\}/);
 assert.match(page,/sourceResume=\{result&&savedId\?savedFiles\.find/);
 assert.match(page,/embedded=\{embedded\}/);
});

test('matching card layout untouched; only a small button and an active-only optimizer CSS section added',()=>{
 const required=[
  '.hhba-native-list{display:grid;gap:12px}',
  '.hhba-native-job{border:1px solid #E7F0FC;',
  '.hhba-native-score{min-width:92px;flex:0 0 92px;',
  '.hhba-native-reason{margin:15px 0 12px;',
  '.hhba-native-score-basis{margin:12px 0 0;',
  '.hhba-native-apply{display:inline-flex;',
  '.hhba-match-history-confirm{display:flex;',
 ];
 for(const needle of required)assert.ok(style.includes(needle),'keep original screenshot styling: '+needle);
 const integration=style.slice(style.indexOf('/* Safe Siri integration:'));
 assert.ok(integration.length>1000);
 assert.doesNotMatch(integration,/\.hhba-native-score\s*\{/,
  'optimizer must not change original score column width');
 assert.doesNotMatch(integration,/\.hhba-native-job\s*\{/,
  'optimizer must not change job-card width or spacing');
 assert.match(integration,/\.hhba-match-modal\.hhba-match-modal-editor/);
 assert.match(integration,/\.hhba-native-score \.hhba-native-optimize/);
});

test('one job = one private Word revision scope; the original file is untouched',()=>{
 assert.match(optimizer,/jobId=\{postingScope\}/);
 assert.match(optimizer,/stablePostingScope\(job\.official_url\)/);
 assert.match(word,/saveOriginalWordEdit\(resume\.id,anchor\.text,visual\.proposed\.trim\(\),revision,jobId\)/);
 assert.match(word,/downloadOriginalWordEdited\(resume\.id,jobId,jobTitle\)/);
 assert.match(backend,/hhba-word-target-job-v1:/);
 assert.match(backend,/job_scope_sha256/);
 assert.match(optimizer,/onVisualSuggestionAction=\{\(id,action,newText,layoutVerified\)=>/);
 assert.match(word,/hhba-word-siri-inline-actions/);
 for(const label of ['采纳','编辑','忽略'])assert.ok(word.includes('> '+label+'<'));
});


test('backdrop and close minimize directly; only explicit termination aborts the running task',()=>{
 const close=dialog.slice(dialog.indexOf('function handleClose()'),dialog.indexOf('function handleKey('));
 assert.match(close,/if\(pending\)\{minimizeSearch\(\);return\}/);
 const minimize=close.slice(close.indexOf('function minimizeSearch()'),close.indexOf('function restoreSearch()'));
 assert.match(minimize,/setMinimized\(true\)/);
 assert.doesNotMatch(minimize,/onClose\(|abort\(|setConfirmTerminate\(true\)/);
 assert.match(close,/function restoreSearch\(\)\{setMinimized\(false\);\}/);
 assert.match(dialog,/if\(!pending\)handleClose\(\)/);
 assert.match(dialog,/onClick=\{e=>\{if\(e.target===e.currentTarget&&pending\)minimizeSearch\(\)\}\}/);
 assert.match(dialog,/onClick=\{\(\)=>setConfirmTerminate\(true\)\}>终止匹配/);
 assert.match(dialog,/onClick=\{\(\)=>\{setConfirmTerminate\(false\);onClose\(\)\}\}>确认终止本次匹配/);
 assert.match(dialog,/hidden=\{minimized\}/);
 assert.match(dialog,/onClick=\{restoreSearch\}/);
 assert.match(dialog,/confirmTerminate&&pending&&<dialog/);
 assert.match(dialog,/dialog.showModal\(\)/);
 assert.match(dialog,/if\(!pending\)setConfirmTerminate\(false\)/);
 assert.match(page,/onClose=\{\(\)=>\{if\(working\)controller.current\?\.abort\(\)/);
 assert.match(page,/\|\|working\|\|researchJobs\.length>0/);
});
