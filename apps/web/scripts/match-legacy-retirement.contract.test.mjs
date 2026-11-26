import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest} from '../functions/api/match-native/_middleware.js';
import {onRequest as retiredV2} from '../functions/api/match-next/[[path]].js';
import {onRequest as retiredNativeHandler} from '../functions/api/match-native/[[path]].js';
import {onRequest as retiredInitial} from '../functions/api/match/[[path]].js';
import {onRequest as retiredDiscover} from '../functions/api/match/discover.js';

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
 assert.match(frontend,/const EFFECTIVE_API='\/api\/match-v4'/);
 assert.doesNotMatch(frontend,/EFFECTIVE_API\s*=\s*MATCH_V4_PREVIEW\s*\?/);
});

test('retired V2 is disabled even when old flags and provider keys remain configured',async()=>{
 const env=new Proxy({}, {get(){throw Error('retired route must never read runtime bindings');}});
 for(const origin of ['https://hhba.work','https://www.hhba.work','https://old.hhba-talent.pages.dev']){
  const status=await retiredV2({request:new Request(origin+'/api/match-next/status'),env});
  assert.equal(status.status,200);
  const data=await status.json();
  assert.equal(data.enabled,false);assert.equal(data.engine,'HHBA_MATCH_CLEAN_V2');
  assert.equal(data.preflight_available,false);
  for(const [path,method] of [['/resume','POST'],['/ocr','POST'],['/provider-check','GET'],['/synthetic-check','POST'],['/operator-run','POST'],['/operator-qa','GET']]){
   const response=await retiredV2({request:new Request(origin+'/api/match-next'+path,{method}),env});
   assert.equal(response.status,410,path);
   assert.equal((await response.json()).error,'MATCH_BACKEND_RETIRED');
   assert.equal(response.headers.get('Cache-Control'),'private, no-store');
  }
 }
});
test('candidate client contains no V2 route, old provider diagnostic, or old OCR consent',async()=>{
 const {readFileSync}=await import('node:fs');
 for(const path of ['../src/services/resumeMatch.ts','../src/pages/CandidateMatchPage.tsx']){
  const code=readFileSync(new URL(path,import.meta.url),'utf8');
  assert.doesNotMatch(code,/\/api\/match-next|runMatchPreview|deepseek-resume-ocr-v1|DeepSeek/);
 }
});

test('all retired matching and discovery handlers fail closed without reading bindings',async()=>{
 const env=new Proxy({}, {get(){throw Error('retired route must never read bindings');}});
 for(const [handler,path] of [[retiredNativeHandler,'/api/match-native'],[retiredInitial,'/api/match']]){
  const status=await handler({request:new Request('https://hhba.work'+path+'/status'),env});
  assert.equal(status.status,200);assert.equal((await status.json()).enabled,false);
  for(const [tail,method] of [['/resume','POST'],['/ocr','POST'],['/provider-check','GET']]){
   const response=await handler({request:new Request('https://hhba.work'+path+tail,{method}),env});
   assert.equal(response.status,410);assert.equal((await response.json()).error,'MATCH_BACKEND_RETIRED');
   assert.equal(response.headers.get('Cache-Control'),'private, no-store');
  }
 }
 for(const method of ['GET','POST','PUT','DELETE']){
  const response=await retiredDiscover({request:new Request('https://hhba.work/api/match/discover',{method}),env});
  assert.equal(response.status,method==='GET'?200:410);
  const value=await response.json();assert.equal(method==='GET'?value.enabled:value.error,method==='GET'?false:'MATCH_BACKEND_RETIRED');
 }
});
