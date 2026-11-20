import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const match=read('../src/pages/CandidateMatchPage.tsx');
const css=read('../src/styles/resume-match.css');
const vault=read('../src/services/privateResumes.ts');

test('real saved resumes list is collapsed on first render and announces its expanded state',()=>{
 assert.match(match,/const \[savedPickerOpen,setSavedPickerOpen\]=useState\(false\)/);
 assert.match(match,/aria-expanded=\{savedPickerOpen\}/);
 assert.match(match,/aria-controls="hhba-ai-existing-options"/);
 assert.match(match,/id="hhba-ai-existing-options"[^\n]+hidden=\{!savedPickerOpen\}/);
 assert.match(css,/\.hhba-ai-saved-picker-content\[hidden\]\{display:none\}/);
 assert.match(match,/setSavedPickerOpen\(open=>!open\)/);
});

test('options show only actual account-owned files, regardless of whether there are one or three',()=>{
 assert.match(match,/listPrivateResumes\(\)/);
 assert.match(match,/savedFiles\.length>0&&<div className="hhba-ai-saved-picker"/);
 assert.match(match,/savedFiles\.map\(item=><label key=\{item\.id\}/);
 assert.match(match,/role="radiogroup"/);
 assert.match(match,/type="radio" name="hhba-ai-existing"/);
 assert.match(match,/checked=\{savedId===item\.id\}/);
 assert.match(match,/item\.name/);
 assert.match(match,/item\.createdAt\.slice\(0,10\)/);
 assert.doesNotMatch(match,/区域督导求职简历\.docx|运营管理求职简历\.docx|综合岗位求职简历\.pdf/,
  'sample resumes must never become account choices');
 assert.match(vault,/const API='\/api\/resumes'/);
});

test('a saved resume is chosen with no duplicate upload, closes the list and clears old match state',()=>{
 const block=match.slice(match.indexOf(' function selectSavedResume('),match.indexOf(' function choose('));
 assert.ok(block.length>100);
 for(const required of [
  'previewController.current?.abort()',
  "setPreviewText('')",
  'setPreviewLoaded(false)',
  'setConsent(false)',
  'setSavedId(id)',
  'setFile(null)',
  'setResult(null)',
  'setPartialJobs([])',
  "setError('')",
  'setSavedPickerOpen(false)',
 ])assert.ok(block.includes(required),'missing safe reset: '+required);
 assert.match(match,/onChange=\{\(\)=>selectSavedResume\(item\.id\)\}/);
 assert.match(match,/onClick=\{\(\)=>selectSavedResume\(''\)\}/);
});

test('existing deep-linked resume and local new upload still work independently',()=>{
 assert.match(match,/deepLinkPending=useRef/);
 assert.match(match,/setSavedId\(requested\)/);
 assert.match(match,/setSavedId\(''\);setFile\(candidate\)/);
 assert.match(match,/setSavedPickerOpen\(false\);\n  previewController\.current\?\.abort/);
 assert.match(match,/id="hhba-ai-resume"/);
 assert.match(match,/onDrop=\{\(e:DragEvent<HTMLLabelElement>\)=>\{e\.preventDefault\(\);setDrag\(false\);choose\(e\.dataTransfer\.files\?\.\[0\]\|\|null\)\}\}/);
 assert.match(match,/if\(\(!file&&!savedId\)\|\|!consent/);
 assert.match(match,/fetchPrivateResumeForLocalReview\(entry\)/);
 assert.match(match,/submitResumeForMatching\(/);
});

test('mobile chooser is compact and accessible without changing the rest of the job matching flow',()=>{
 assert.match(css,/\.hhba-ai-saved-picker-trigger:focus-visible/);
 assert.match(css,/@media\(max-width:600px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(match,/disabled=\{working\} onClick=\{\(\)=>setSavedPickerOpen/);
 assert.match(match,/saveResume\(\)/);
 assert.match(match,/linkMatchHistoryResume\(/);
});
