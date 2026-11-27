import test from 'node:test';
import assert from 'node:assert/strict';
import {EVIDENCE_EXPANSION_PATHS,nextEvidenceExpansion,ungroundedSearchCompletion} from '../functions/_lib/v4-search-expansion.js';

test('evidence-stalled search changes independent research directions without dropping candidate target',()=>{
 let visited=[];const prompts=[];
 for(let i=0;i<EVIDENCE_EXPANSION_PATHS.length;i++){
  const next=nextEvidenceExpansion(visited);
  assert.ok(next);
  prompts.push(next.prompt);visited=next.visited;
 }
 assert.equal(new Set(prompts).size,EVIDENCE_EXPANSION_PATHS.length);
 assert.equal(nextEvidenceExpansion(visited),null);
 assert.match(prompts.join(' '),/跨行业/);
 assert.match(prompts.join(' '),/官网/);
 assert.match(prompts.join(' '),/地点/);
});
test('a model cannot certify under-target coverage without any real search, but trustworthy partial research is retained',()=>{
 assert.equal(ungroundedSearchCompletion({candidateCount:12,target:500,webSources:0,actualQueries:0,publicReads:0}),true);
 assert.equal(ungroundedSearchCompletion({candidateCount:12,target:500,webSources:1,actualQueries:0,publicReads:0}),false);
 assert.equal(ungroundedSearchCompletion({candidateCount:12,target:500,webSources:0,actualQueries:3,publicReads:0}),false);
 assert.equal(ungroundedSearchCompletion({candidateCount:500,target:500,webSources:0,actualQueries:0,publicReads:0}),false);
});
