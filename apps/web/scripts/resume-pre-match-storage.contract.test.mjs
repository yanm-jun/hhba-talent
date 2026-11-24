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
 assert.match(run,/submitExtractedResumeText\(previewText,runOptions,consent,abort\.signal,matchResumeId\|\|undefined/);
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
 assert.match(account,/有匹配历史 · 原文件尚未保存/);
 assert.match(account,/尚未保存简历/);
 assert.match(account,/listPrivateResumes\(\)/);
 assert.match(account,/listMatchHistory\(\)/);
});
