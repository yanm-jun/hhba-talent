import test from 'node:test';
import assert from 'node:assert/strict';
import {stageEffort,usageCounts,recordAiUsage,readAiUsage,createAiUsageBuffer} from '../functions/_lib/ai-token-usage.js';
import {v4Call} from '../functions/_lib/simple-match-v4.js';
const model='gpt-6.2-sol';
test('all GPT-6 business stages use medium; probes and unknown models retain compatibility',()=>{
 assert.equal(stageEffort({model},'format'),'medium');
 assert.equal(stageEffort({model},'discovery'),'medium');
 for(const s of ['profile','jd_coverage','score','rank','report','resume_optimization','resume_reassess'])assert.equal(stageEffort({model},s),'medium');
 assert.equal(stageEffort({model,reasoningEffort:'xhigh'},'format'),'medium');
 assert.equal(stageEffort({model,reasoningEffort:'high'},'probe'),'high');
 assert.equal(stageEffort({model:'test-model'},'format'),null);
 assert.equal(stageEffort({model},'unclassified'),'medium');
});
test('missing usage is unknown and reasoning/cache are subsets, not extra totals',()=>{
 assert.deepEqual(usageCounts({input_tokens:100,output_tokens:20,total_tokens:120,input_tokens_details:{cached_tokens:60},output_tokens_details:{reasoning_tokens:10}}),{input:100,output:20,total:120,reasoning:10,cached:60,known:true});
 assert.equal(usageCounts({}).known,false);assert.equal(usageCounts({}).cached,null);
});
test('records metadata only; database failures never reject model work',async()=>{
 const events=[];const db={prepare(sql){return {bind(...args){events.push({sql,args});return this},async run(){}}}};
 await recordAiUsage(db,{model,stage:'score',effort:'medium',status:'completed',usage:{input_tokens:3,output_tokens:2,total_tokens:5},prompt:'PRIVATE'});
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

test('managed model usage is buffered without waiting for D1 and aggregates each real response',async()=>{
 const writes=[];let release;const gate=new Promise(r=>{release=r;});
 const usageDb={prepare(){return {bind(...args){writes.push(args);return this},async run(){await gate;}}}};
 const usageBuffer=createAiUsageBuffer(usageDb),p={model,key:'synthetic',baseUrl:'https://example.test/v1',usageDb,usageBuffer};
 const reply={status:'completed',output:[],usage:{input_tokens:10,output_tokens:5,total_tokens:15}};
 const fetcher=async()=>Response.json(reply);
 await v4Call(fetcher,p,{input:'one'},{stage:'score'});await v4Call(fetcher,p,{input:'two'},{stage:'score'});
 assert.equal(writes.length,0,'no D1 write on the individual response critical path');
 const flushing=usageBuffer.flush();assert.equal(writes.length,1);
 assert.deepEqual(writes[0].slice(5),[2,2,20,10,30,0,0,0,0]);release();await flushing;
 await usageBuffer.flush();assert.equal(writes.length,1);
});
test('confirmed non-discovery JSON fallback avoids repeated rejected stream requests, discovery remains live',async()=>{
 const p={model,key:'synthetic',baseUrl:'https://example.test/v1',stream:true,transportState:{jsonStages:new Set()}};
 const attempts=[],reply={status:'completed',output:[]};
 const fetcher=async(_u,o)=>{const body=JSON.parse(o.body);attempts.push(body.stream);return body.stream?new Response('',{status:422}):Response.json(reply);};
 await v4Call(fetcher,p,{input:'one'},{stage:'score'});
 await v4Call(fetcher,p,{input:'two'},{stage:'score'});
 await v4Call(fetcher,p,{input:'three'},{stage:'discovery'});
 await v4Call(fetcher,p,{input:'four'},{stage:'discovery'});
 assert.deepEqual(attempts,[true,false,false,true,false,true,false]);
 assert.equal(p.transportState.jsonStages.has('discovery'),false);
});
