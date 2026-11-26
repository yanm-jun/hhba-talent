import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('retired native research cannot be selected in the V4 UI',()=>{
 const route=readFileSync(new URL('../functions/api/match-native/[[path]].js',import.meta.url),'utf8');
 const page=readFileSync(new URL('../src/pages/CandidateMatchPage.tsx',import.meta.url),'utf8');
 const transport=readFileSync(new URL('../src/services/resumeMatch.ts',import.meta.url),'utf8');
 assert.doesNotMatch(page,/DeepSeek 原生深度搜索 · 试用/);
 assert.match(transport,/const EFFECTIVE_API='\/api\/match-v4'/);
 assert.match(route,/export \{onRequest\} from '\.\/_middleware\.js'/);
 assert.doesNotMatch(route,/runNativeDeepSearchJobs|HHBA_MATCH_DEEPSEEK_KEY/);
});
