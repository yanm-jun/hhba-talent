import test from 'node:test';
import assert from 'node:assert/strict';
import {stageEffort,usageCounts,recordAiUsage,readAiUsage} from '../functions/_lib/ai-token-usage.js';
import {v4Call} from '../functions/_lib/simple-match-v4.js';
const model='gpt-6.2-sol';
test('stage reasoning is selective, explicit overrides and unknown models preserved',()=>{
 assert.equal(stageEffort({model},'format'),'low');
 assert.equal(stageEffort({model},'discovery'),'medium');
 for(const s of ['profile','jd_coverage','score','rank','report','resume_optimization','resume_reassess'])assert.equal(stageEffort({model},s),'high');
 assert.equal(stageEffort({model,reasoningEffort:'xhigh'},'format'),'xhigh');
 assert.equal(stageEffort({model:'test-model'},'format'),null);
 assert.equal(stageEffort({model},'unclassified'),null);
});
test('missing usage is unknown and reasoning/cache are subsets, not extra totals',()=>{
 assert.deepEqual(usageCounts({input_tokens:100,output_tokens:20,total_tokens:120,input_tokens_details:{cached_tokens:60},output_tokens_details:{reasoning_tokens:10}}),{input:100,output:20,total:120,reasoning:10,cached:60,known:true});
 assert.equal(usageCounts({}).known,false);assert.equal(usageCounts({}).cached,null);
});
test('records metadata only; database failures never reject model work',async()=>{
 const events=[];const db={prepare(sql){return {bind(...args){events.push({sql,args});return this},async run(){}}}};
 await recordAiUsage(db,{model,stage:'score',effort:'high',status:'completed',usage:{input_tokens:3,output_tokens:2,total_tokens:5},prompt:'PRIVATE'});
 assert.equal(events.length,1);assert.equal(events[0].args[2],'score');assert.equal(events[0].args[5],1);
 assert.ok(!JSON.stringify(events).includes('PRIVATE'));
 await recordAiUsage({prepare(){throw Error('database unavailable')}},{model,stage:'score'});
 assert.deepEqual(await readAiUsage({},'2026-11-25','2026-11-25'),{quality:'unavailable'});
});
test('Responses request applies stage effort and records exactly one successful usage',async()=>{
 const events=[];const usageDb={prepare(){return {bind(...args){events.push(args);return this},async run(){}}}};
 const reply={status:'completed',output:[],usage:{input_tokens:10,output_tokens:5,total_tokens:15}};
 const fetcher=async(_url,opts)=>{const body=JSON.parse(opts.body);assert.equal(body.reasoning.effort,'medium');assert.equal(body.store,false);assert.equal(body.max_output_tokens,undefined);return Response.json(reply)};
 const result=await v4Call(fetcher,{model,key:'synthetic',baseUrl:'https://example.test/v1',usageDb},{input:'synthetic'},{stage:'discovery'});
 assert.equal(result.usage.total_tokens,15);assert.equal(events.length,1);assert.equal(events[0][4],'completed');
});
test('failed or missing usage never becomes a known zero; errors still propagate',async()=>{
 const events=[];const usageDb={prepare(){return {bind(...args){events.push(args);return this},async run(){}}}};
 await assert.rejects(v4Call(async()=>new Response('',{status:429}),{model,key:'synthetic',baseUrl:'https://example.test/v1',usageDb},{input:'test'},{stage:'score'}),/AI_PROVIDER_RATE_LIMITED/);
 assert.equal(events.length,1);assert.equal(events[0][4],'failed');assert.equal(events[0][5],0);
});
