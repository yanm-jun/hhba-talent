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
 const preserved=[
  '岗位匹配',
  '找到 {result.matches.length} 个岗位',
  '匹配分用于求职参考，不是录用概率。',
  'hhba-match-history-confirm',
  'hhba-native-list',
  'displayedJobs.map((job,i)=>',
  'job.company',
  'job.title_zh||job.title',
  'job.location',
  "job.availability_status==='OPEN_LISTED'",
  'job.match_score',
  'job.score_basis',
  'job.recommendation_reason',
  'job.official_url',
  'data-hhba-recruitment-outbound="true"',
  '保存到我的简历',
  '完成查看',
 ];
 for(const value of preserved)assert.ok(dialog.includes(value),'preserve old native result UI: '+value);
 assert.match(dialog,/className=\{'hhba-match-modal'\+\(optimizedJobUrl\?' hhba-match-modal-editor':''\)\}/);
 assert.match(dialog,/displayedJobs\.find\(job=>job\.official_url===optimizedJobUrl\)/);
 assert.match(dialog,/disabled=\{pending\|\|!parsedProfile\|\|!!preparingJd\|\|\(!MATCH_V4_PREVIEW&&\(!job\.jd_version_id\|\|!job\.jd_sha256\)\)\}/);
 assert.match(dialog,/await prepareV4Job\(/);
 assert.doesNotMatch(dialog,/!pending&&Number\.isInteger\(job\.match_score\)&&<button/);
 assert.match(dialog,/className="hhba-native-optimize"/);
 assert.match(dialog,/核验 JD 中…':'优化简历'/);
 assert.match(dialog,/<TargetedResumeOptimization key=\{activeJob\.id\}/);
 assert.match(dialog,/onDraftDirtyChange=\{setOptimizationDirty\}/);
 assert.match(dialog,/const matchListScroll=useRef\(0\)/);
 assert.match(dialog,/viewport\.scrollTop=optimizedJobUrl\?0:matchListScroll\.current/);
 assert.match(dialog,/if\(optimizedJobUrl\)\{backToMatches\(\);return\}/);
 assert.match(dialog,/\{optimizedJobUrl\?'返回匹配结果':pending\?'取消搜索':'完成查看'\}/);
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
