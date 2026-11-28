import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(p)=>readFileSync(new URL(p,import.meta.url),'utf8');
const page=read('../src/pages/CandidateMatchPage.tsx');
const account=read('../src/pages/PersonalCenterPage.tsx');
const history=read('../functions/_lib/match-history.js');
const api=read('../functions/api/resumes/[[path]].js');

test('original file retention is a separate explicit choice, not a side effect of AI consent',()=>{
 assert.match(page,/useState<'undecided'\|'save'\|'once'>\('undecided'\)/);
 assert.match(page,/name="hhba-resume-storage" value="save"/);
 assert.match(page,/name="hhba-resume-storage" value="once"/);
 assert.match(page,/checked=\{storageChoice==='save'\}/);
 assert.match(page,/checked=\{storageChoice==='once'\}/);
 assert.match(page,/name="hhba-resume-storage" value="save"[\s\S]{0,160}onChange=\{\(\)=>setStorageChoice\('save'\)\}/);
 assert.match(page,/file&&!savedId&&storageChoice==='undecided'/);
 assert.match(page,/checked=\{consent\}/,'AI analysis authorization remains independent');
 assert.match(page,/onChange=\{e=>setConsent\(e.target.checked\)\}/);
});

test('private storage is acknowledged before reviewed-text matching starts',()=>{
 const begin=page.indexOf(' async function run()');
 const end=page.indexOf(' return <Shell user={user}',begin);
 const run=page.slice(begin,end);
 const saved=run.indexOf('await uploadPrivateResume(selectedFile,true)');
 const submitEdited=run.indexOf('await submitExtractedResumeText(');
 assert.ok(saved>0&&saved<submitEdited,'save must precede the AI matching request');
 assert.match(run,/if\(selectedFile&&!matchResumeId&&storageChoice==='save'\)/);
 assert.match(run,/matchResumeId=stored\.id/);
 assert.match(run,/setSavedId\(stored\.id\);setFile\(null\)/);
 assert.match(run,/setSavedFiles\(all=>all\.some\(item=>item\.id===stored\.id\)/);
 assert.match(run,/new Event\('hhba:private-resumes-changed'\)/);
 assert.match(run,/submitExtractedResumeText\(searchText,searchOptions,consent,abort\.signal,matchResumeId\|\|undefined/);
 assert.doesNotMatch(run,/submitResumeForMatching\(/);
});

test('storage failures must stop matching, and opting out never uploads the binary',()=>{
 const begin=page.indexOf(' async function run()');
 const run=page.slice(begin,page.indexOf(' return <Shell user={user}',begin));
 assert.match(run,/if\(selectedFile&&!matchResumeId&&storageChoice==='save'\)/,
  'only an affirmative storage choice may trigger upload');
 assert.match(run,/setSaveNotice\('原文件尚未保存，本次 AI 匹配未启动/);
 assert.match(run,/throw e;/,'failure must propagate rather than silently match without saving');
 assert.match(run,/\}finally\{setSaveBusy\(false\);\}/);
 assert.match(run,/let matchResumeId=savedId/);
 assert.match(run,/matchResumeId\|\|undefined/,'temporary matching carries no fake resume reference');
 assert.match(api,/STORAGE_CONSENT_REQUIRED/);
 assert.match(api,/STORAGE_CONSENT_VERSION/);
});

test('server accepts and validates only the current account original document association',()=>{
 assert.match(history,/SELECT id,filename FROM hhba_candidate_resumes WHERE phone=\? AND id=\?/);
 assert.match(history,/resume\?\.id\|\|null/);
 assert.match(history,/本次上传的简历（未保存）/);
 assert.match(page,/setStorageChoice\('undecided'\)/,'new upload must require a fresh choice');
 assert.match(page,/selectSavedResume\(item\.id\)/,'saved resume remains reusable directly');
});

test('workbench no longer claims a past match implies a saved original file',()=>{
 assert.doesNotMatch(account,/尚未上传简历/);
 assert.match(account,/resumeCount===0\?'尚未保存原文件'/);
 assert.match(account,/historyCount===0\?'暂无匹配记录'/);
 assert.match(account,/resumeCount,setResumeCount/);
 assert.match(account,/historyCount,setHistoryCount/);
 assert.match(account,/尚未保存简历/);
 assert.match(account,/listPrivateResumes\(\)/);
 assert.match(account,/listMatchHistory\(\)/);
});

test('failed pre-registration upload releases phantom research state and allows retry without pretending AI ran',()=>{
 const run=page.slice(page.indexOf(' async function run()'),page.indexOf(' async function continueSearch()'));
 assert.match(run,/const registered=researchStarted\|\|!!sessionTask\.current\|\|!!pendingStart\.current/);
 assert.match(run,/researchStarted=true;[\s\S]*const matched=await submitExtractedResumeText\(/,'an actual AI request must retain genuine failure handling');
 assert.match(run,/if\(!registered\)\{taskOpen\.current=false;setTaskFailure\(false\);\}/);
 assert.match(run,/else setTaskFailure\(true\)/,'only a potentially registered server task can appear as interrupted');
 assert.match(run,/setError\(e instanceof Error\?e\.message/,'show the actual upload or API error in the form');
 assert.match(page,/!working&&taskOpen\.current&&<p role="status">/,'a failed prestart must not retain a blocking task dialog');
});
test('genuine interrupted task can reconnect to the original server task, without creating a second task',()=>{
 const dialog=read('../src/components/CandidateMatchNativeDialog.tsx');
 const retry=page.slice(page.indexOf(' async function retryFailedTask()'),page.indexOf(' async function continueSearch()'));
 assert.match(retry,/await readSessionMatchTask\(\)/,'read the original task under the authenticated session');
 assert.match(retry,/void restoreTask\(task\)/,'reuse the original task and generation');
 assert.doesNotMatch(retry,/beginSessionMatchTask|advanceSessionMatchTask/,'never register a second paid task from an error dialog');
 assert.match(dialog,/taskFailed&&onRetryFailedTask&&<button/);
 assert.match(dialog,/恢复原研究任务/);
 assert.match(page,/onRetryFailedTask=\{taskFailure\?\(\)=>void retryFailedTask\(\):undefined\}/);
});


test('duplicate uploads are checked before preview, and choice B never auto-selects or auto-saves',()=>{
 const client=read('../src/services/privateResumes.ts');
 const route=read('../functions/api/resumes/[[path]].js');
 const css=read('../src/styles/resume-match.css');
 assert.match(client,/crypto\.subtle\.digest\('SHA-256',await file\.arrayBuffer\(\)\)/);
 assert.match(client,/fetch\(API\+'\/check'/);
 assert.match(client,/body:JSON\.stringify\(\{sha256,size:file\.size\}\)/);
 assert.match(route,/if\(tail==='\/check'&&method==='POST'\)/);
 assert.match(route,/WHERE phone=\? AND sha256=\? AND size_bytes=\?/);
 assert.match(route,/existing:match\?summary\(match\):null/);
 assert.match(page,/setDuplicateReview\(\{candidate,existing\}\)/);
 assert.match(page,/role="alertdialog" aria-modal="true"/);
 assert.match(page,/使用已保存的简历/);
 assert.match(page,/取消本次上传/);
 assert.match(page,/function useAlreadySavedResume\(\)/);
 assert.match(page,/function cancelDuplicateUpload\(\)/);
 assert.match(page,/selectSavedResume\(match\.id,match\)/);
 assert.match(page,/choose\(null\)/);
 assert.match(page,/duplicateChecking\|\|duplicateReview\|\|duplicateCheckError\|\|/);
 assert.match(css,/\.hhba-ai-duplicate-overlay/);
 assert.match(css,/@media\(max-width:520px\)/);
});
