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


test('a resumed document retains its earlier checkpoint even if the next request immediately fails',async()=>{
 const {continueDocumentOptimization}=await import('../src/services/resumeOptimizationContinuation.mjs');
 const checkpoints=[],pauses=[];
 const result=await continueDocumentOptimization({blockIds:['a','b','c'],wanted:['c'],
  request:async()=>{throw Error('NETWORK_ERROR')},wait:async()=>{},
  onCheckpoint:c=>checkpoints.push(c),onPaused:e=>pauses.push(e.message)});
 assert.deepEqual(result,[]);
 assert.deepEqual(checkpoints.at(-1).pending,['c']);
 assert.deepEqual(pauses,['NETWORK_ERROR']);
});


test('V4 distinguishes explicit keep decisions from omitted and invalid proposals',async()=>{
 const {reviewedOptimizationIds}=await import('../functions/_lib/resume-ai-provider.js');
 const blocks=['a','b','c','d','e'].map(id=>({id,text:'真实经历 '+id}));
 const raw={suggestions:[{blockId:'a'},{blockId:'c'}],keep:[
  {blockId:'b',reason:'已有充分证据，无需改写'},
  {blockId:'c',reason:'与无效修改冲突'},
  {blockId:'d',reason:''},{blockId:'outside',reason:'unknown'}
 ]};
 assert.deepEqual(reviewedOptimizationIds(raw,blocks,[{blockId:'a'}]),['a','b']);
});

test('V4 retains verified suggestions, completes explicit keep decisions and continues missing or rejected edits',async()=>{
 const blocks=['a','b','c','d'].map(id=>({id,section:'experience',text:'真实经历 '+id}));
 const visited=[];
 const deps={
  plan:async()=>({focus:['岗位相关真实经历']}),
  generate:async({blocks})=>{
   visited.push(blocks.map(b=>b.id));
   if(blocks.length===4)return {provider:'openai-relay',reviewedIds:['a','b','c'],
    suggestions:[{blockId:'a'},{blockId:'c'}]};
   return {provider:'openai-relay',reviewedIds:blocks.map(b=>b.id),suggestions:[]};
  },
  audit:async({suggestions,withCoverage})=>{
   assert.equal(withCoverage,true);
   return {suggestions:suggestions.filter(s=>s.blockId==='a'),
    pendingIds:suggestions.filter(s=>s.blockId==='c').map(s=>s.blockId)};
  }
 };
 const input={env:{HHBA_MATCH_V4_READY:'1'},blocks,context:'完整简历',job:{requirements:'JD'},signal:new AbortController().signal};
 const first=await optimizeResumeDocument(input,deps);
 assert.deepEqual(first.suggestions,[{blockId:'a'}]);
 assert.deepEqual(first.pendingIds,['c','d']);
 const second=await optimizeResumeDocument({...input,wanted:first.pendingIds},deps);
 assert.deepEqual(second.pendingIds,[]);
 assert.deepEqual(visited,[['a','b','c','d'],['c','d']]);
});

test('V4 retains rejected numeric claims for another evidence-grounded pass without publishing them',async()=>{
 const {auditTargetedResumeSuggestions}=await import('../functions/_lib/resume-rewrite-provider.js');
 const result=await auditTargetedResumeSuggestions({env:{},blocks:[{id:'a',text:'负责运营'}],
  job:{},suggestions:[{blockId:'a',action:'replace',proposed:'提升销售额 50%'}],
  withCoverage:true,signal:new AbortController().signal});
 assert.deepEqual(result,{suggestions:[],pendingIds:['a']});
});


test('same-JD reassessment feedback reaches full document planning and actual writing as advisory evidence',async()=>{
 const blocks=[{id:'word-1',section:'experience',text:'整理门店每周销售数据。'}];
 const feedback='原文具备门店数据整理经验，但不能推断管理人数。';
 let planned=false,written=false;
 const r=await optimizeResumeDocument({env:{HHBA_MATCH_V4_READY:'1'},blocks,context:blocks[0].text,
  job:{title:'门店督导',requirements:'经营数据分析'},signal:new AbortController().signal,feedback},{
  plan:async input=>{assert.equal(input.prior_review_feedback,feedback);planned=true;return {focus:['突出真实数据整理经历']};},
  generate:async input=>{
   assert.equal(input.documentContext.prior_review_feedback,feedback);
   assert.deepEqual(input.documentContext.focus,['突出真实数据整理经历']);
   written=true;return {suggestions:[],reviewedIds:['word-1']};
  },
  audit:async()=>({suggestions:[],pendingIds:[]})
 });
 assert.equal(planned,true);assert.equal(written,true);assert.deepEqual(r.pendingIds,[]);
});


test('V4 reviewer checks both proposed edits and keep decisions, returning specific revision directions',async()=>{
 const {auditTargetedResumeSuggestions}=await import('../functions/_lib/resume-rewrite-provider.js');
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async(_url,init)=>{
  const request=JSON.parse(init.body),input=JSON.parse(request.input);
  assert.match(request.instructions,/needs_revision/);
  assert.equal(input.document_context.text,'完整虚构简历');
  assert.equal(input.blocks[1].decision,'keep');
  return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({
   checks:[{blockId:'a',safe:true,needs_revision:true,concern:'突出真实的销售数据整理工作'},
    {blockId:'b',safe:true,needs_revision:true,concern:'此处原文可明确培训职责'}]
  })}]}]});
 };
 try{
  const result=await auditTargetedResumeSuggestions({
   env:{HHBA_MATCH_V4_READY:'1',HHBA_AGENT_RELAY_API_KEY:'synthetic-placeholder-secret'},
   blocks:[{id:'a',text:'整理销售数据。'},{id:'b',text:'协助培训。'}],
   job:{requirements:'销售数据分析与人员培训'},suggestions:[{blockId:'a',action:'replace',proposed:'负责数据整理。'}],
   signal:new AbortController().signal,withCoverage:true,reviewContext:{text:'完整虚构简历'},reviewedIds:['a','b']
  });
  assert.deepEqual(result.suggestions,[]);
  assert.deepEqual(result.pendingIds,['a','b']);
  assert.deepEqual(result.reviewFeedback,{a:'突出真实的销售数据整理工作',b:'此处原文可明确培训职责'});
 }finally{globalThis.fetch=originalFetch;}
});

test('AI continuation follows distinct review feedback without fixed retry count and publishes only completed edits',async()=>{
 const {continueDocumentOptimization}=await import('../src/services/resumeOptimizationContinuation.mjs');
 const checkpoints=[];let calls=0;
 const result=await continueDocumentOptimization({blockIds:['a'],request:async(ids,feedback)=>{
  calls++;
  assert.deepEqual(ids,['a']);
  if(calls>1)assert.equal(feedback.a,'审查意见'+(calls-1));
  if(calls<=5)return {pending:['a'],suggestions:[{blockId:'a',proposed:'未通过的草稿'}],reviewFeedback:{a:'审查意见'+calls}};
  return {pending:[],suggestions:[{blockId:'a',proposed:'已完成的真实改写'}]};
 },wait:async()=>{},onCheckpoint:c=>checkpoints.push(c)});
 assert.equal(calls,6);
 assert.deepEqual(result,[{blockId:'a',proposed:'已完成的真实改写'}]);
 assert.equal(checkpoints[3].reviewFeedback.a,'审查意见3');
 assert.ok(checkpoints.slice(0,-1).every(c=>c.suggestions.length===0));
});

test('same repeated review state pauses without claiming completion and preserves directions for resume',async()=>{
 const {continueDocumentOptimization}=await import('../src/services/resumeOptimizationContinuation.mjs');
 const checkpoints=[];let calls=0,paused=false;
 const result=await continueDocumentOptimization({blockIds:['a'],request:async()=>{
  calls++;return {pending:['a'],suggestions:[],reviewFeedback:{a:'仍需核实事实'}};
 },wait:async()=>{},onCheckpoint:c=>checkpoints.push(c),onPaused:()=>{paused=true}});
 assert.equal(calls,2);assert.equal(paused,true);assert.deepEqual(result,[]);
 assert.deepEqual(checkpoints.at(-1),{pending:['a'],suggestions:[],reviewFeedback:{a:'仍需核实事实'}});
});


test('V4 multiple ordered edits for one anchor are composed without dropping later edits',async()=>{
 const {parseSuggestions,normalizeDocumentSuggestions}=await import('../functions/_lib/resume-ai-provider.js');
 const block={id:'a',text:'整理销售数据并汇报。',paragraphEditable:true};
 const parsed=parseSuggestions({suggestions:[
  {blockId:'a',action:'replace',original:'整理销售数据',proposed:'使用 Excel 整理销售数据',rationale:'突出工具'},
  {blockId:'a',action:'replace',original:'并汇报',proposed:'并向负责人汇报',rationale:'突出沟通'},
  {blockId:'a',action:'append',proposed:'整理培训反馈。',sourceQuotes:['整理培训反馈。'],rationale:'同一经历补充'}
 ]},['a'],{fullDocument:true});
 assert.equal(parsed.length,3);
 const [combined]=normalizeDocumentSuggestions([block],parsed);
 assert.equal(combined.proposed,'使用 Excel 整理销售数据并向负责人汇报。整理培训反馈。');
 assert.equal(combined.changeCount,3);
 assert.deepEqual(combined.sourceQuotes,['整理培训反馈。']);
 assert.match(combined.rationale,/突出沟通/);
 const conflicting=normalizeDocumentSuggestions([block],[
  {blockId:'a',action:'replace',original:block.text,proposed:'新的完整表达'},
  {blockId:'a',action:'replace',original:block.text,proposed:'另一个表达'}
 ]);
 assert.deepEqual(conflicting,[],'conflicting edits must return to AI review rather than silently discard a proposal');
});
test('V4 cross-section numeric facts require actual full-document quotes and independent attribution review',async()=>{
 const {auditTargetedResumeSuggestions}=await import('../functions/_lib/resume-rewrite-provider.js');
 const env={HHBA_MATCH_V4_READY:'1',HHBA_AGENT_RELAY_API_KEY:'synthetic-placeholder-secret'};
 const source='虚构甲公司：每周整理 50 条销售记录。';
 const originalFetch=globalThis.fetch;let calls=0;
 globalThis.fetch=async(_url,init)=>{
  calls++;const req=JSON.parse(init.body),input=JSON.parse(req.input);
  assert.deepEqual(input.blocks[0].sourceQuotes,[source]);
  assert.match(req.instructions,/归属/);
  return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({
   checks:[{blockId:'a',safe:true,needs_revision:false,concern:''}]
  })}]}]});
 };
 try{
  const base={env,blocks:[{id:'a',text:'具备数据整理经验。'}],job:{requirements:'数据统计'},
   signal:new AbortController().signal,withCoverage:true,reviewContext:{text:'具备数据整理经验。\n'+source},reviewedIds:['a']};
  const suggestion={blockId:'a',action:'replace',proposed:'具备数据整理经验，曾在甲公司每周整理 50 条销售记录。',sourceQuotes:[source]};
  const accepted=await auditTargetedResumeSuggestions({...base,suggestions:[suggestion]});
  assert.equal(accepted.suggestions.length,1);
  assert.deepEqual(accepted.pendingIds,[]);
  const invalid=await auditTargetedResumeSuggestions({...base,suggestions:[{...suggestion,sourceQuotes:['虚构记录 50 条。']}]});
  assert.deepEqual(invalid.suggestions,[]);assert.deepEqual(invalid.pendingIds,['a']);
  assert.equal(calls,1);
 }finally{globalThis.fetch=originalFetch;}
});
