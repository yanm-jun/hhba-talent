import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('current search-first candidate matching exposes job-level optimization',async()=>{
 const dialog=await readFile(new URL('../src/components/CandidateMatchNativeDialog.tsx',import.meta.url),'utf8');
 const page=await readFile(new URL('../src/pages/CandidateMatchPage.tsx',import.meta.url),'utf8');
 assert.match(dialog,/TargetedResumeOptimization/);
 assert.match(dialog,/优化简历/); // Button text was shortened without removing the action.
 assert.match(dialog,/hhba-native-score/);
 assert.match(dialog,/setOptimizedJobId\(job.id\)/);
 assert.match(dialog,/!pending&&parsedProfile/);
 assert.match(page,/setOptimizationSource\(submittedText\)/);
 assert.match(page,/sourceText=\{result\?optimizationSource:undefined\}/);
});
test('the reviewed text never silently falls back to the original file',async()=>{
 const page=await readFile(new URL('../src/pages/CandidateMatchPage.tsx',import.meta.url),'utf8');
 assert.match(page,/if\(previewLoaded\)/);
 assert.match(page,/previewText\.replace\(\/\\s\/g,''\)\.length<30/);
 assert.match(page,/submittedText=previewText/);
 assert.match(page,/submitExtractedResumeText\(/);
});

test('local resume redaction rejects >20k characters rather than silently discarding the tail',async()=>{
 // Evaluate the exact function body without importing browser-only dependencies.
 const source=await readFile(new URL('../src/services/resumeMatch.ts',import.meta.url),'utf8');
 const declaration='export function redactResumeTextLocally(text:string):string{';
 const index=source.indexOf(declaration);
 assert.ok(index>=0);
 const end=source.indexOf('\n}',index);
 assert.ok(end>index);
 const body=source.slice(index+declaration.length,end);
 class LocalMatchError extends Error{constructor(status,message){super(message);this.status=status;}}
 const redact=new Function('MatchError','return function redactResumeTextLocally(text){'+body+'\n};')(LocalMatchError);
 assert.equal(redact('经历'.repeat(10000)).length,20000);
 assert.throws(()=>redact('经历'.repeat(10001)),e=>e.status===413&&/避免遗漏/.test(e.message));
 assert.equal(redact('test@example.com 工作经历').startsWith('[邮箱已隐藏]'),true);
});
