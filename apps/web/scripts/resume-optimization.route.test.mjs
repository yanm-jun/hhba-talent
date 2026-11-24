import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet,onRequestPost} from '../functions/api/resume-optimize.js';
import {optimizeResumeDocument,reserveResumeOptimizationTask}
 from '../functions/_lib/resume-optimization-task.js';

test('entire-document optimization plans over every paragraph, batches review and resumes pending blocks',async()=>{
 const blocks=Array.from({length:27},(_,index)=>({id:'word-'+index,text:'真实经历 '+index,section:'experience'}));
 const batches=[],scanned=[],plan=async(input)=>{
  assert.equal(input.blocks.length,blocks.length);
  assert.equal(input.context,'整份简历的上下文');
  return {focus:['门店数据']};
 };
 const deps={plan,generate:async({blocks:batch,documentContext})=>{
  assert.deepEqual(documentContext.focus,['门店数据']);
  batches.push(batch.map(block=>block.id));
  if(batch.some(block=>block.id==='word-24')&&!scanned.includes('resume'))throw Error('AI_PROVIDER_UPSTREAM_ERROR');
  return {suggestions:batch.map(block=>({blockId:block.id}))};
 },audit:async request=>request.suggestions};
 const input={env:{},blocks,context:'整份简历的上下文',job:{requirements:'招聘正文'},signal:new AbortController().signal};
 const first=await optimizeResumeDocument(input,deps);
 assert.deepEqual(batches.map(batch=>batch.length),[12,12,3,3]);
 assert.equal(first.suggestions.length,24);
 assert.deepEqual(first.pendingIds,['word-24','word-25','word-26']);
 scanned.push('resume');
 const next=await optimizeResumeDocument({...input,wanted:first.pendingIds},deps);
 assert.deepEqual(next.pendingIds,[]);
 assert.deepEqual(next.suggestions.map(item=>item.blockId),first.pendingIds);
});

test('full document task lease stores only hashes and rejects a concurrent duplicate',async()=>{
 let held=false,leaseId='',taskHash='';
 const run=[];
 const db={prepare(sql){
  return {bind(...args){
   return {
    async run(){
     run.push({sql,args});
     if(sql.startsWith('INSERT')){
      if(held)return {success:true,meta:{changes:0}};
      held=true;
      taskHash=args[1];
      leaseId=args[2];
     }
     if(sql.includes('lease_id=?')&&args[1]===leaseId)held=false;
     return {success:true,meta:{changes:1}};
    },
    async first(){return held?{task_hash:taskHash}:null;}
   };
  }};
 }};
 const original={text:'私人简历识别内容',jd:'jd_test'};
 const lease=await reserveResumeOptimizationTask(db,'account-hash',original);
 assert.ok(lease);
 assert.deepEqual(await reserveResumeOptimizationTask(db,'account-hash',original),{duplicate:true});
 assert.equal(await reserveResumeOptimizationTask(db,'account-hash',{...original,jd:'jd_other'}),null);
 assert.ok(!JSON.stringify(run).includes(original.text));
 await lease.release();
 assert.ok(await reserveResumeOptimizationTask(db,'account-hash',original));
});

const url='https://preview.hhba.example/api/resume-optimize';
const base={
 consent_ai:true,
 blocks:[{id:'experience-0',section:'experience',text:'负责门店运营'}],
 job:{title:'区域督导',requirements:'运营和团队协作'}
};
function mockEnv(){
 const records=[],attempts=[];
 const db={prepare(sql){return{
  all:async()=>({results:[{name:'hhba_resume_optimization_requests'},{name:'hhba_resume_optimization_attempts'}]}),
  first:async()=>({name:'hhba_resume_optimization_requests'}),
  bind(...args){return{
   first:async()=>sql.includes('hhba_auth_users')?{role:'candidate'}:{
    phone:'person',revoked:0,expires_at:new Date(Date.now()+60000).toISOString()
   },
   run:async()=>{
    if(sql.startsWith('INSERT INTO hhba_resume_optimization_attempts')){
     if(attempts.length>=6)return {success:true,meta:{changes:0}};
     attempts.push(args);return {success:true,meta:{changes:1}};
    }
    if(sql.startsWith('INSERT INTO hhba_resume_optimization_requests')){
     if(records.length>=3)return {success:true,meta:{changes:0}};
     records.push(args);return {success:true,meta:{changes:1}};
    }
    if(sql.startsWith('DELETE FROM hhba_resume_optimization_requests')){
     const index=records.findIndex(row=>row[0]===args[0]&&row[2]===args[1]);
     if(index!==-1)records.splice(index,1);
     return {success:true,meta:{changes:index===-1?0:1}};
    }
    return {success:true,meta:{changes:1}};
   }
  }}
 }}};
 return {env:{
  HHBA_AUTH_ROLLOUT:'preview',HHBA_RESUME_OPTIMIZATION_ENABLED:'1',
  HHBA_MATCH_LIMIT_PEPPER:'long-test-pepper-long-test-pepper',
  HHBA_PNVS_AUTH_DB:db,
  HHBA_AI_DEFAULT_PROVIDER:'openai',
  HHBA_AI_OPENAI_API_KEY:'placeholder',
  HHBA_AI_OPENAI_MODEL:'test-model'
 },records,attempts};
}
function request(body=base,origin='https://preview.hhba.example',auth=true){
 return new Request(url,{method:'POST',headers:{
  Origin:origin,...(auth?{Authorization:'Bearer example'}:{})
 },body:JSON.stringify(body)});
}
test('refuses cross-origin requests and missing authentication',async()=>{
 const h=mockEnv();
 assert.equal((await onRequestPost({request:request(base,'https://elsewhere.example'),env:h.env})).status,403);
 assert.equal((await onRequestPost({request:request(base,undefined,false),env:h.env})).status,401);
 assert.equal((await onRequestPost({request:request({...base,consent_ai:false}),env:h.env})).status,400);
 assert.equal(h.records.length,0);
});
test('feature status fails closed when disabled',async()=>{
 const h=mockEnv();
 h.env.HHBA_RESUME_OPTIMIZATION_ENABLED='0';
 assert.equal((await (await onRequestGet({env:h.env})).json()).enabled,false);
 assert.equal((await onRequestPost({request:request(),env:h.env})).status,503);
});

test('production AI optimization can use a dedicated quota salt with bounded usage',async()=>{
 const h=mockEnv(),previous=globalThis.fetch;
 delete h.env.HHBA_AUTH_ROLLOUT;
 delete h.env.HHBA_MATCH_LIMIT_PEPPER;
 h.env.HHBA_MATCH_RUNTIME_MODE='production';
 h.env.HHBA_RESUME_OPTIMIZATION_LIMIT_PEPPER='private-opt-only-'+('Q'.repeat(48));
 globalThis.fetch=async()=>Response.json({choices:[{message:{content:JSON.stringify({
  suggestions:[{id:'s0',blockId:'experience-0',action:'replace',
   original:base.blocks[0].text,proposed:'负责区域门店日常运营管理',
   rationale:'表达更准确',jobRequirement:'运营和团队协作',
   evidenceStatus:'needs_user_confirmation'}]
 })}}]});
 try{
  const status=await (await onRequestGet({env:h.env})).json();
  assert.equal(status.enabled,true);
  assert.equal(status.per_account_daily_limit,3);
  assert.equal(status.per_account_daily_attempt_limit,6);
  const response=await onRequestPost({request:request(),env:h.env});
  assert.equal(response.status,200,await response.clone().text());
  const value=await response.json();
  assert.equal(value.suggestions.length,1);
  assert.equal(value.suggestions[0].evidenceStatus,'needs_user_confirmation');
  assert.equal(h.records.length,1);
  assert.equal(h.attempts.length,1);
 }finally{globalThis.fetch=previous;}
});

test('generates suggestions with user confirmation and enforces daily quota',async()=>{
 const h=mockEnv();
 const previous=globalThis.fetch;
 let count=0;
 globalThis.fetch=async (_url,options)=>{
  count++;
  const submitted=JSON.parse(options.body);
  const input=JSON.parse(submitted.messages[1].content);
  assert.equal(input.blocks[0].text,base.blocks[0].text);
  return Response.json({choices:[{message:{content:JSON.stringify({suggestions:[{
   id:'suggestion-0',blockId:'experience-0',action:'replace',
   original:base.blocks[0].text,proposed:'统筹门店日常运营',
   rationale:'使用更清晰的动词',jobRequirement:'运营和团队协作',
   evidenceStatus:'verified'
  }]})}}]});
 };
 try{
  for(let i=0;i<3;i++){
   const result=await onRequestPost({request:request(),env:h.env});
   assert.equal(result.status,200);
   const output=await result.json();
   assert.equal(output.suggestions[0].original,base.blocks[0].text);
   assert.equal(output.suggestions[0].evidenceStatus,'needs_user_confirmation');
  }
  assert.equal((await onRequestPost({request:request(),env:h.env})).status,429);
  assert.equal(count,3);
 }finally{globalThis.fetch=previous;}
});

test('provider never receives contact identifiers in evidence',async()=>{
 const h=mockEnv();
 const original=globalThis.fetch;
 const text='负责门店运营，联系邮箱：tester@example.org';
 globalThis.fetch=async(_url,options)=>{
  assert.doesNotMatch(options.body,/tester@example.org/);
  const submitted=JSON.parse(options.body);
  assert.match(submitted.messages[1].content,/邮箱已脱敏/);
  return Response.json({choices:[{message:{content:JSON.stringify({suggestions:[]})}}]});
 };
 try{
  const result=await onRequestPost({request:request({
   ...base,blocks:[{...base.blocks[0],text}]
  }),env:h.env});
  assert.equal(result.status,200);
 }finally{globalThis.fetch=original;}
});


test('bounded twelve-section Chinese resume passes UTF-8 request limit',async()=>{
 const h=mockEnv(),prior=globalThis.fetch;
 let called=false;
 globalThis.fetch=async (_url,options)=>{
  called=true;
  const data=JSON.parse(options.body);
  const input=JSON.parse(data.messages[1].content);
  assert.equal(input.blocks.length,12);
  assert.ok(new TextEncoder().encode(options.body).byteLength>18000);
  return Response.json({choices:[{message:{content:'{"suggestions":[]}'}}]});
 };
 try{
  const blocks=Array.from({length:12},(_,i)=>({
   id:'experience-'+i,section:'experience',text:'负责区域门店运营与客户管理工作'.repeat(70)
  }));
  const response=await onRequestPost({request:request({...base,blocks}),env:h.env});
  assert.equal(response.status,200);
  assert.equal(called,true);
 }finally{globalThis.fetch=prior;}
});
test('very large raw request is rejected before paid provider access',async()=>{
 const h=mockEnv(),prior=globalThis.fetch;
 let calls=0;globalThis.fetch=async()=>{calls++;throw Error('must not call provider')};
 try{
  const response=await onRequestPost({request:request({...base,
   blocks:[{...base.blocks[0],text:'中'.repeat(45000)}]
  }),env:h.env});
  assert.equal(response.status,400);
  assert.equal(calls,0);
  assert.equal(h.records.length,0);
 }finally{globalThis.fetch=prior;}
});

test('upstream failures refund the candidate optimization allowance',async()=>{
 const h=mockEnv(),previous=globalThis.fetch;
 globalThis.fetch=async()=>new Response('provider service unavailable',{status:503});
 try{
  const failed=await onRequestPost({request:request(),env:h.env});
  assert.equal(failed.status,502);
  assert.equal((await failed.json()).error,'AI_PROVIDER_UPSTREAM_ERROR');
  assert.equal(h.records.length,0,'failed provider calls must not spend user daily quota');
 }finally{globalThis.fetch=previous;}
});

test('repeated provider failures still have an independent six-attempt cap',async()=>{
 const h=mockEnv(),previous=globalThis.fetch;
 let providerCalls=0;
 globalThis.fetch=async()=>{
  providerCalls++;
  return new Response('temporary backend failure',{status:503});
 };
 try{
  for(let i=0;i<6;i++){
   const r=await onRequestPost({request:request(),env:h.env});
   assert.equal(r.status,502);
  }
  const r=await onRequestPost({request:request(),env:h.env});
  assert.equal(r.status,429);
  assert.equal((await r.json()).error,'RESUME_OPTIMIZATION_ATTEMPT_LIMIT');
  assert.equal(providerCalls,6);
  assert.equal(h.attempts.length,6);
  assert.equal(h.records.length,0,'no successful quota used after failure');
 }finally{globalThis.fetch=previous;}
});

test('no safe AI suggestions leaves successful-generation allowance unused',async()=>{
 const h=mockEnv(),original=globalThis.fetch;
 globalThis.fetch=async()=>Response.json({choices:[{
  finish_reason:'stop',message:{content:'{"suggestions":[]}'}
 }]});
 try{
  const response=await onRequestPost({request:request(),env:h.env});
  assert.equal(response.status,200);
  const value=await response.json();
  assert.deepEqual(value.suggestions,[]);
  assert.equal(h.records.length,0,'empty output is not a successful generation');
  assert.equal(h.attempts.length,1,'the provider call still counts toward attempts');
 }finally{globalThis.fetch=original;}
});


test('document continuation keeps zero-suggestion reviewed blocks across network failure',async()=>{
 const {continueDocumentOptimization}=await import('../src/services/resumeOptimizationContinuation.mjs');
 const seen=[],checkpoints=[],pauses=[];
 const result=await continueDocumentOptimization({blockIds:['a','b','c'],request:async pending=>{
  seen.push(pending);if(seen.length===1)return {suggestions:[],pending:['c']};
  throw Error('NETWORK_ERROR');
 },wait:async()=>{},onCheckpoint:value=>checkpoints.push(value),onPaused:error=>pauses.push(error.message)});
 assert.deepEqual(result,[]);
 assert.deepEqual(checkpoints.at(-1),{pending:['c'],suggestions:[]});
 assert.deepEqual(pauses,['NETWORK_ERROR']);
 const resumed=await continueDocumentOptimization({blockIds:['a','b','c'],wanted:checkpoints.at(-1).pending,
  request:async pending=>{assert.deepEqual(pending,['c']);return {suggestions:[{blockId:'c'}],pending:[]}},
  wait:async()=>{}});
 assert.deepEqual(resumed,[{blockId:'c'}]);
});

test('successful AI edits survive provider failure; terminal pause avoids another paid request',async()=>{
 const {continueDocumentOptimization}=await import('../src/services/resumeOptimizationContinuation.mjs');
 const checkpoints=[],pauses=[];let calls=0;
 const result=await continueDocumentOptimization({blockIds:['a','b'],request:async()=>{
  calls++;return {suggestions:[{blockId:'a',proposed:'真实经历'}],pending:['b'],pauseError:Error('AI_PROVIDER_RATE_LIMITED')};
 },wait:async()=>{},onCheckpoint:c=>checkpoints.push(c),onPaused:e=>pauses.push(e.message)});
 assert.equal(calls,1);assert.equal(result.length,1);
 assert.deepEqual(checkpoints.at(-1).pending,['b']);assert.deepEqual(pauses,['AI_PROVIDER_RATE_LIMITED']);
});

test('malformed continuation cannot silently mark unknown sections complete',async()=>{
 const {continueDocumentOptimization}=await import('../src/services/resumeOptimizationContinuation.mjs');
 const checkpoints=[];
 await assert.rejects(continueDocumentOptimization({blockIds:['a','b'],
  request:async()=>({suggestions:[],pending:['unrelated']}),wait:async()=>{},onCheckpoint:c=>checkpoints.push(c)}));
 assert.deepEqual(checkpoints.at(-1).pending,['a','b']);
});

test('backend returns terminal pause and preserved successful document batches',async()=>{
 const blocks=Array.from({length:13},(_,index)=>({id:'word-'+index,section:'experience',text:'真实经历 '+index}));
 const result=await optimizeResumeDocument({env:{HHBA_MATCH_V4_READY:'1'},blocks,context:'完整简历',job:{requirements:'JD'},signal:new AbortController().signal},{
  plan:async()=>({focus:[]}),
  generate:async({blocks})=>{if(blocks.some(b=>b.id==='word-12'))throw Error('AI_PROVIDER_RATE_LIMITED');return {provider:'openai',suggestions:[]}},
  audit:async({suggestions})=>suggestions
 });
 assert.deepEqual(result.pendingIds,['word-12']);assert.equal(result.pauseReason,'AI_PROVIDER_RATE_LIMITED');
});
