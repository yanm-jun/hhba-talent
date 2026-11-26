import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';


test('authenticated provider diagnostics remain available without gating a candidate match',()=>{
 const page=readFileSync(new URL('../src/pages/CandidateMatchPage.tsx',import.meta.url),'utf8');
 const route=readFileSync(new URL('../functions/api/match-v4/[[path]].js',import.meta.url),'utf8');
 assert.doesNotMatch(page,/checkMatchProviderConnection/);
 assert.match(page,/await submitExtractedResumeText\(/);
 assert.match(route,/sessionOfBearer\(db,request,Date\.now\(\)\)/);
 assert.match(route,/v4JobProvider\(env\)/);
 assert.doesNotMatch(route,/HHBA_MATCH_DEEPSEEK_KEY|checkMatchProviderCapabilities/);
});


test('retired provider code is absent from runtime while the public utilities remain independently available',async()=>{
 const {existsSync}=await import('node:fs');
 for(const n of ['deepseek-native-match','deepseek-search-match','ai-owned-job-research','autonomous-mainland-search','domestic-job-research']){
  assert.equal(existsSync(new URL('../functions/_lib/'+n+'.js',import.meta.url)),false,n);
 }
 const {decodeSearchText}=await import('../functions/_lib/public-search-text.js');
 const {normalizeAutonomousQueries}=await import('../functions/_lib/public-search-queries.js');
 assert.equal(decodeSearchText('&#x62DB;&#x8058;'),'招聘');
 assert.deepEqual(normalizeAutonomousQueries(['渠道运营 官方招聘','a@example.com','渠道运营 官方招聘']),['渠道运营 官方招聘']);
});
