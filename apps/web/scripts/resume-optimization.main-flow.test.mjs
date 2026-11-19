import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('current search-first candidate matching exposes job-level optimization',async()=>{
 const dialog=await readFile(new URL('../src/components/CandidateMatchNativeDialog.tsx',import.meta.url),'utf8');
 const page=await readFile(new URL('../src/pages/CandidateMatchPage.tsx',import.meta.url),'utf8');
 assert.match(dialog,/TargetedResumeOptimization/);
 assert.match(dialog,/针对这个岗位优化简历/);
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
