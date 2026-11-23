import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest} from '../functions/api/match-native/_middleware.js';

test('legacy status always reports maintenance instead of calling an expensive old Agent',async()=>{
 const r=await onRequest({request:new Request('https://hhba.work/api/match-native/status')});
 assert.equal(r.status,200);
 const result=await r.json();
 assert.equal(result.enabled,false);
 assert.equal(result.mode,'RETIRED_REBUILD_IN_PROGRESS');
 assert.equal(r.headers.get('Cache-Control'),'private, no-store');
});

test('legacy matching and OCR cannot reach old handler, including direct API requests',async()=>{
 for(const [path,method] of [['/resume','POST'],['/ocr','POST'],
  ['/provider-check','GET'],['/resume','GET'],['/','POST']]){
  const r=await onRequest({
   request:new Request('https://hhba.work/api/match-native'+path,{method})});
  assert.equal(r.status,410,path+' '+method);
  assert.equal((await r.json()).error,'MATCH_BACKEND_RETIRED');
 }
});

test('old middleware has no database mutation, model call, branching or next() execution',async()=>{
 const {readFileSync}=await import('node:fs');
 const body=readFileSync(new URL('../functions/api/match-native/_middleware.js',import.meta.url),'utf8');
 assert.doesNotMatch(body,/\b(?:fetch|next|prepare|exec|delete|drop|insert|update)\s*\(/i);
 assert.doesNotMatch(body,/CF_PAGES_BRANCH|HHBA_MATCH_SERVICE_ENABLED/);
 const frontend=readFileSync(new URL('../src/services/resumeMatch.ts',import.meta.url),'utf8');
 assert.match(frontend,/const API='\/api\/match-next'/);
});
