import test from 'node:test';
import assert from 'node:assert/strict';
import {driveBackgroundMatch,requestPhase} from './runner.mjs';
const ticket='a'.repeat(64);
const event=(kind,value)=>new Response('event: '+kind+'\ndata: '+JSON.stringify(value)+'\n\n',{headers:{'Content-Type':'text/event-stream'}});
test('independent runner advances persisted phases until terminal success, without browser state',async()=>{
 const outcomes=['CONTINUE','CONTINUE','COMPLETE'],calls=[],steps=[];
 const step={async do(name,config,fn){steps.push(name);return fn();}};
 const result=await driveBackgroundMatch(step,ticket,async(url,init)=>{
  assert.equal(init.redirect,'manual');assert.equal(url,'https://hhba.work/api/match-v4/background-step');assert.deepEqual(JSON.parse(init.body),{ticket});calls.push(url);
  return event('complete',{status:outcomes.shift()});
 });
 assert.deepEqual(result,{status:'COMPLETE'});assert.equal(calls.length,3);assert.equal(new Set(steps).size,3);
});
test('independent job dispatch keeps at most two sibling Pages invocations per research phase',async()=>{
 const calls=[],step={async do(_name,_options,fn){return fn();}};
 const result=await driveBackgroundMatch(step,ticket,async(url,options)=>{
  calls.push({url,body:JSON.parse(options.body),redirect:options.redirect});
  return url.endsWith('/background-job-step')?Response.json({status:'DONE'}):event('complete',{status:'COMPLETE'});
 },{jobsEnabled:true});
 assert.deepEqual(result,{status:'COMPLETE'});
 assert.equal(calls.length,3);
 assert.equal(calls.filter(x=>x.url.endsWith('/background-job-step')).length,2);
 assert.equal(calls.filter(x=>x.body.lane==='verification').length,2);
 assert.equal(calls.filter(x=>x.body.lane==='reporting').length,0);
 assert.ok(calls.every(x=>x.body.ticket===ticket&&x.redirect==='manual'));
});
test('job fan-out preserves reporting and verification across durable follow-up phases',async()=>{
 const calls=[],values=['CONTINUE','CONTINUE','CONTINUE','COMPLETE'];
 const step={async do(_name,_options,fn){return fn();}};
 const result=await driveBackgroundMatch(step,ticket,async(url,options)=>{
  calls.push({url,body:JSON.parse(options.body)});
  return url.endsWith('/background-job-step')?Response.json({status:'CONTINUE'}):event('complete',{status:values.shift()});
 },{jobsEnabled:true});
 assert.deepEqual(result,{status:'COMPLETE'});
 assert.equal(calls.filter(x=>x.url.endsWith('/background-step')).length,4);
 assert.equal(calls.filter(x=>x.url.endsWith('/background-job-step')).length,8);
 assert.equal(calls.filter(x=>x.url.endsWith('/background-job-step')&&x.body.lane==='verification').length,7);
 assert.equal(calls.filter(x=>x.url.endsWith('/background-job-step')&&x.body.lane==='reporting').length,1);
});
test('pending independent JDs pause on a durable Workflow timer without repeating AI research',async()=>{
 assert.equal(await requestPhase(async()=>event('complete',{status:'CONTINUE',waiting_for_jobs:true}),ticket),'WAIT_JOBS');
 const requests=[],sleeps=[],statuses=[
  {status:'CONTINUE',waiting_for_jobs:true},
  {status:'CONTINUE',waiting_for_jobs:true},
  {status:'CONTINUE'},
  {status:'COMPLETE'}
 ];
 const step={
  async do(_name,_opts,fn){return fn();},
  async sleep(name,duration){sleeps.push({name,duration});}
 };
 const result=await driveBackgroundMatch(step,ticket,async(url,options)=>{
  requests.push({url,body:JSON.parse(options.body)});
  if(url.endsWith('/background-job-step'))return Response.json({status:'EMPTY'});
  return event('complete',statuses.shift());
 },{jobsEnabled:true,maxSteps:10});
 assert.deepEqual(result,{status:'COMPLETE'});
 assert.deepEqual(sleeps.map(x=>x.duration),['30 seconds','30 seconds']);
 assert.deepEqual(sleeps.map(x=>x.name),['wait-independent-jobs-0','wait-independent-jobs-1']);
 assert.equal(requests.filter(x=>x.url.endsWith('/background-step')).length,4);
 assert.equal(requests.filter(x=>x.url.endsWith('/background-job-step')).length,8,
  'already-queued independent jobs keep getting execution opportunities');
});
test('edge-compatible manual redirects never send ticket to another destination',async()=>{
 let calls=0;
 for(const status of [301,302,303,307,308])assert.equal(await requestPhase(async(url,init)=>{calls++;assert.equal(init.redirect,'manual');return new Response(null,{status,headers:{Location:'https://other.example/'}});},ticket),'FAILED');
 assert.equal(calls,5);
});
test('explicit termination, revocation or expired ticket never starts another phase',async()=>{
 for(const error of ['AI_AGENT_CANCELLED','AI_TASK_USER_CANCELLED','AI_AUTH_SESSION_EXPIRED','AI_TASK_SUPERSEDED','AI_TASK_CLOSED','AI_TASK_NOT_ACTIVE','AI_BACKGROUND_TICKET_INVALID','AI_CHECKPOINT_EXPIRED']){
  assert.equal(await requestPhase(async()=>Response.json({error},{status:409}),ticket),'STOP');
 }
 assert.equal(await requestPhase(async()=>event('failure',{error:'AI_AGENT_CANCELLED'}),ticket),'STOP');
});
test('temporary failure backoff is short and stable, rate/daily caps remain protected',async()=>{
 const {recoveryDelaySeconds}=await import('./runner.mjs');
 for(const code of ['AI_PROVIDER_UPSTREAM_ERROR','AI_PROVIDER_TIMEOUT','AI_EDGE_RESOURCE_EXHAUSTED']){
  assert.ok(recoveryDelaySeconds(code,50)<=300);
  assert.ok(recoveryDelaySeconds(code,50)>=15);
 }
 assert.equal(recoveryDelaySeconds('AI_PROVIDER_RATE_LIMITED',50),600);
 assert.equal(recoveryDelaySeconds('AI_EDGE_DAILY_LIMIT',50),3600);
});
test('lease conflict and interrupted response are retried, not treated as completed',async()=>{
 await assert.rejects(requestPhase(async()=>Response.json({error:'AI_TASK_IN_PROGRESS'},{status:409}),ticket),/BACKGROUND_PHASE_RETRY/);
 await assert.rejects(requestPhase(async()=>event('failure',{error:'AI_PROVIDER_UPSTREAM_ERROR',retryable:true}),ticket),/BACKGROUND_PHASE_RETRY/);
 await assert.rejects(requestPhase(async()=>new Response(''),ticket),/BACKGROUND_PHASE_RETRY/);
 assert.equal(await requestPhase(async()=>event('failure',{error:'AI_PROVIDER_KEY_REJECTED'}),ticket),'FAILED');
});

test('scheduler identifies waiting, errored and rollover workflows without restarting from a browser poll',async()=>{
 const {scheduleWorkflowInstance}=await import('./runner.mjs');
 for(const [state,active,recovering] of [
  [{status:'queued'},true,false],[{status:'running'},true,false],[{status:'waiting'},true,true],[{status:'errored'},true,true],
  [{status:'complete',output:{status:'RECOVERING',error:'AI_BACKGROUND_WORKFLOW_ROLLOVER'}},true,true],
  [{status:'complete',output:{status:'COMPLETE'}},false,false],[{status:'complete',output:{status:'FAILED',error:'AI_PROVIDER_KEY_REJECTED'}},false,false],[{status:'complete',output:{status:'FAILED'}},true,true],
  [{status:'complete',output:{status:'STOP'}},false,false],[{status:'terminated'},false,false],[{status:'paused'},false,false],[{status:'unknown'},false,false]
 ]){
  let restarted=0;
  const binding={async create(){throw Error('(instance.already_exists)')},async get(id){assert.equal(id,'id');return {async status(){return state},async restart(){restarted++}}}};
  assert.equal(await scheduleWorkflowInstance(binding,'id',ticket),active);
  const diagnostic=await scheduleWorkflowInstance(binding,'id',ticket,{diagnostic:true});
  assert.equal(recovering?diagnostic?.status:diagnostic,recovering?'RECOVERING':active);
  assert.equal(restarted,0);
 }
 assert.equal(await scheduleWorkflowInstance({async create(){}},'id',ticket),true);
});
function registry(){
 const rows=new Map();
 const db={prepare(sql){return {bind(...v){return {async run(){
  let changes=0;
  if(sql.startsWith('INSERT')){
   const row=rows.get(v[0]);rows.set(v[0],{instance_id:v[0],next_check:row?.next_check??v[1],expires_at:v[2]});changes=1;
  }else if(sql.startsWith('DELETE')){
   const row=rows.get(v[0]);if(row&&(v.length===1||row.expires_at<=v[1])){rows.delete(v[0]);changes=1;}
  }else{
   const row=rows.get(v[1]);if(row&&row.next_check<=v[2]&&row.expires_at>v[3]){row.next_check=v[0];changes=1;}
  }
  return {success:true,meta:{changes}};
 },async all(){return {results:[...rows.values()].filter(r=>r.next_check<=v[0]).sort((a,b)=>a.next_check-b.next_check).slice(0,v[1]).map(r=>({...r}))}}}}}}};
 return {rows,db};
}
test('watchdog restarts errored and rollover workflows, never completed, failed, stopped or paused workflows',async()=>{
 const {registerWatchdogInstance,inspectWatchdogInstances}=await import('./runner.mjs');
 const {rows,db}=registry(),now=1000,statuses=new Map(),restarted=[];
 const states=[{status:'errored'},{status:'terminated'},{status:'complete',output:{status:'COMPLETE'}},{status:'running'},{status:'paused'},{status:'complete',output:{status:'RECOVERING',error:'AI_BACKGROUND_WORKFLOW_ROLLOVER'}},{status:'complete',output:{status:'FAILED',error:'AI_PROVIDER_KEY_REJECTED'}},{status:'complete',output:{status:'STOP'}}];
 for(const [i,state] of states.entries()){
  const id=String(i+1).repeat(64);statuses.set(id,state);await registerWatchdogInstance(db,id,now);
 }
 const workflow={async get(id){return {async status(){return statuses.get(id)},async restart(){restarted.push(id);statuses.set(id,{status:'running'})}}}};
 const result=await inspectWatchdogInstances(db,workflow,{now,batch:20});
 assert.deepEqual(result,{checked:8,restarted:2});assert.deepEqual(restarted,['1'.repeat(64),'6'.repeat(64)]);assert.equal(rows.size,3);
 assert.deepEqual(await inspectWatchdogInstances(db,workflow,{now:now+1}),{checked:0,restarted:0});
});
test('concurrent watchdog checks cannot restart the same due instance twice',async()=>{
 const {registerWatchdogInstance,inspectWatchdogInstances}=await import('./runner.mjs');
 const {db}=registry();const now=1000,id='f'.repeat(64);await registerWatchdogInstance(db,id,now);
 let restarted=0;const workflow={async get(){return {async status(){return {status:'errored'}},async restart(){restarted++}}}};
 await Promise.all([inspectWatchdogInstances(db,workflow,{now}),inspectWatchdogInstances(db,workflow,{now})]);
 assert.equal(restarted,1);
});

test('shared private cron calls matching watchdog even when Word recovery is disabled',async()=>{
 const {default:scheduler}=await import('../../apps/web/ops/word-render-recovery-worker.mjs');
 let calls=0;
 const env={HHBA_WORD_RENDER_RECOVERY_ENABLED:'0',HHBA_MATCH_WATCHDOG:{async fetch(url,opts){
  calls++;assert.equal(url,'https://hhba-internal.invalid/watchdog');assert.equal(opts.method,'POST');
  return Response.json({ok:true,checked:3,restarted:1});
 }}};
 await scheduler.scheduled({},env);
 assert.equal(calls,1);
 assert.equal((await scheduler.fetch()).status,404);
});


test('deterministic invalid requests and provider configuration failures never retry',async()=>{
 let calls=0;
 assert.equal(await requestPhase(async()=>{calls++;throw new TypeError('Invalid redirect value');},ticket),'FAILED');assert.equal(calls,1);
 for(const error of ['AI_PROVIDER_KEY_REJECTED','AI_PROVIDER_BALANCE_INSUFFICIENT','AI_PROVIDER_NOT_CONFIGURED']){
  const state=await driveBackgroundMatch({async do(_name,_config,fn){return fn()},async sleep(){assert.fail('permanent error must not retry')}},ticket,async()=>event('failure',{error,retryable:true}));
  assert.deepEqual(state,{status:'FAILED',error});
 }
 assert.equal(await requestPhase(async()=>Response.json({error:'AI_PROVIDER_KEY_REJECTED'},{status:503}),ticket),'FAILED');
});
test('temporary failures beyond five attempts still recover the original task with increasing durable backoff',async()=>{
 const sleeps=[],names=[],calls=[];
 const values=[...Array(8).fill('retry'),'CONTINUE','retry','COMPLETE'];
 const result=await driveBackgroundMatch({async do(name,config,fn){names.push(name);assert.equal(config.retries.limit,5);return fn();},async sleep(name,seconds){names.push(name);sleeps.push(seconds)}},ticket,async(_url,init)=>{
  calls.push(JSON.parse(init.body).ticket);const next=values.shift();
  return next==='retry'?new Response(null,{status:503}):event('complete',{status:next});
 });
 assert.deepEqual(result,{status:'COMPLETE'});assert.equal(calls.length,11);assert.ok(calls.every(t=>t===ticket));assert.equal(new Set(names).size,names.length);
 assert.deepEqual(sleeps,['15 seconds','30 seconds','60 seconds','120 seconds','300 seconds','300 seconds','300 seconds','300 seconds','15 seconds']);
});
test('daily resource exhaustion waits, then an explicitly cancelled task does not call another paid phase',async()=>{
 const sleeps=[],calls=[];const values=[new Response('<h1>Error 1027</h1>',{status:429}),Response.json({error:'AI_AGENT_CANCELLED'},{status:401})];
 const state=await driveBackgroundMatch({async do(_name,_config,fn){return fn()},async sleep(_name,seconds){sleeps.push(seconds)}},ticket,async()=>{calls.push(1);return values.shift()});
 assert.deepEqual(state,{status:'STOP',error:'AI_AGENT_CANCELLED'});assert.deepEqual(sleeps,['3600 seconds']);assert.equal(calls.length,2);
 // Regression: numeric 1800 would be 1800ms on Cloudflare, not 1800s.
});
test('workflow runtime failure remains errored for watchdog and planned rollover remains recoverable',async()=>{
 await assert.rejects(driveBackgroundMatch({async do(){throw Error('runtime exhausted')}},ticket,async()=>assert.fail('must not call provider')),/BACKGROUND_PHASE_RETRY/);
 const result=await driveBackgroundMatch({async do(_name,_config,fn){return fn()},async sleep(){assert.fail('successful phase must not sleep')}},ticket,async()=>event('complete',{status:'CONTINUE'}),{maxSteps:3});
 assert.deepEqual(result,{status:'RECOVERING',error:'AI_BACKGROUND_WORKFLOW_ROLLOVER'});
});

test('edge exhaustion and lease contention have distinct diagnostics; checkpoint yields are successful continuations',async()=>{
 await assert.rejects(requestPhase(async()=>new Response('<h1>Error 1102</h1>',{status:503}),ticket),/AI_EDGE_RESOURCE_EXHAUSTED/);
 await assert.rejects(requestPhase(async()=>Response.json({error:'AI_TASK_IN_PROGRESS'},{status:409}),ticket),/AI_TASK_IN_PROGRESS/);
 const values=['CONTINUE','CONTINUE','COMPLETE'];let calls=0;
 const result=await driveBackgroundMatch({async do(_name,_config,fn){return fn();}},ticket,async()=>{calls++;return event('complete',{status:values.shift()});});
 assert.equal(calls,3);assert.deepEqual(result,{status:'COMPLETE'});
});

 test('known recoverable failures remain retryable even if older phase marked them terminal',async()=>{
 for(const error of ['AI_PROVIDER_RESPONSE_INVALID','AI_PROVIDER_INCOMPLETE','AI_CHECKPOINT_STORAGE_UNAVAILABLE','AI_PROVIDER_UNAVAILABLE'])await assert.rejects(requestPhase(async()=>event('failure',{error,retryable:false}),ticket),/BACKGROUND_PHASE_RETRY/);
 assert.equal(await requestPhase(async()=>event('failure',{error:'AI_PROVIDER_KEY_REJECTED',retryable:true}),ticket),'FAILED');
 });

test('old workflow terminal infrastructure result can recover, but authorization and credentials remain terminal',async()=>{
 const {scheduleWorkflowInstance,registerWatchdogInstance,inspectWatchdogInstances}=await import('./runner.mjs');
 for(const error of ['AI_PHASE_RESOURCE_YIELD','AI_BACKGROUND_EXECUTION_FAILED','AI_PIPELINE_STATE_INVALID','AI_EDGE_RESOURCE_EXHAUSTED','AI_CHECKPOINT_LEASE_LOST']){
  await assert.rejects(requestPhase(async()=>event('failure',{error,retryable:false}),ticket),/BACKGROUND_PHASE_RETRY/);
 }
 for(const status of [408,425])await assert.rejects(requestPhase(async()=>new Response('',{status}),ticket),/BACKGROUND_PHASE_RETRY/);
 const {db}=registry();const id='e'.repeat(64),now=1000;let restarted=0;
 const instance={async status(){return {status:'complete',output:{status:'FAILED',error:'AI_EDGE_RESOURCE_EXHAUSTED'}}},async restart(){restarted++}};
 const binding={async create(){throw Error('(instance.already_exists)')},async get(){return instance}};
 assert.deepEqual(await scheduleWorkflowInstance(binding,id,ticket,{diagnostic:true}),{status:'RECOVERING',error:'AI_EDGE_RESOURCE_EXHAUSTED'});
 await registerWatchdogInstance(db,id,now);assert.equal((await inspectWatchdogInstances(db,binding,{now})).restarted,1);assert.equal(restarted,1);
 assert.equal(await requestPhase(async()=>event('failure',{error:'AI_CHECKPOINT_INVALID',retryable:true}),ticket),'FAILED');
});
test('resource failure continuation sends only the opaque ticket and sanitized recovery hint',async()=>{
 const requests=[],responses=[new Response('Error 1102',{status:503}),event('complete',{status:'CONTINUE'}),event('complete',{status:'COMPLETE'})];
 const state=await driveBackgroundMatch({async do(_n,_c,fn){return fn()},async sleep(){}},ticket,async(_u,init)=>{requests.push(JSON.parse(init.body));return responses.shift()});
 assert.deepEqual(state,{status:'COMPLETE'});assert.deepEqual(requests,[{ticket},{ticket,recovery:'AI_EDGE_RESOURCE_EXHAUSTED'},{ticket}]);
});

test('lock contention uses short paced recovery without excessive backoff',async()=>{
 const {recoveryDelaySeconds}=await import('./runner.mjs');
 assert.deepEqual([1,2,3,4,8,20].map(n=>recoveryDelaySeconds('AI_TASK_IN_PROGRESS',n)),[15,30,45,60,60,60]);
 assert.ok(recoveryDelaySeconds('AI_EDGE_DAILY_LIMIT',20)>=3600);
});

test('stage Workflow IDs are deterministic, isolated and opaque',async()=>{
 const {stageWorkflowId,STAGE_LANES}=await import('./stages.mjs');
 const instance='f'.repeat(64),ids=await Promise.all(STAGE_LANES.map(s=>stageWorkflowId(instance,s)));
 assert.equal(ids.length,3);assert.equal(new Set(ids).size,3);
 assert.ok(ids.every(x=>/^[a-f0-9]{64}$/.test(x)&&x!==instance));
 assert.equal(await stageWorkflowId(instance,'verification'),ids[1]);
 await assert.rejects(stageWorkflowId(instance,'untrusted'),/INVALID_STAGE_INSTANCE/);
});
test('three staged durable cloud instances remain asleep until their real saved checkpoint needs work',async()=>{
 const lane='verification',payloads=[],waits=[];
 const step={async do(n,conf,fn){return fn()},async waitForEvent(n,options){waits.push([n,options.type]);return undefined;}};
 const statuses=['CONTINUE','HANDOFF','COMPLETE'];
 const result=await driveBackgroundMatch(step,ticket,async(_url,init)=>{
  const body=JSON.parse(init.body);payloads.push(body);
  assert.equal(body.lane,lane);assert.equal(body.ticket,ticket);
  return event('complete',{status:statuses.shift()});
 },{lane});
 assert.deepEqual(result,{status:'COMPLETE'});
 assert.deepEqual(waits.map(x=>x[1]),['wake_verification','wake_verification']);
 assert.equal(payloads.length,3);
});
test('one failed stage wake safely returns to the single-owner legacy driver',async()=>{
 const bodies=[],step={async do(_n,_c,fn){return fn()},async waitForEvent(){throw Error('must not park after failed wake')}};
 const response=[event('complete',{status:'CONTINUE',fallback:true}),event('complete',{status:'COMPLETE'})];
 const result=await driveBackgroundMatch(step,ticket,async(_url,opts)=>{bodies.push(JSON.parse(opts.body));return response.shift()},{lane:'discovery'});
 assert.deepEqual(result,{status:'COMPLETE'});
 assert.equal(bodies[0].lane,'discovery');assert.equal(bodies[1].lane,undefined);
 assert.equal(bodies[1].staged_fallback,true,'fallen-back worker must still clean up dormant stage instances');
});
test('a wake cancellation terminates dormant staged Workflow without performing paid research',async()=>{
 let called=false;
 const step={async waitForEvent(){return {done:true}},async do(){called=true;throw Error('should not run')}};
 assert.deepEqual(await driveBackgroundMatch(step,ticket,async()=>{called=true;throw Error('should not fetch')},{lane:'reporting'}),{status:'COMPLETE'});
 assert.equal(called,false);
});

test('stage Workflow scheduler creates three dormant/active instances only after checking old ownership',async()=>{
 const {startStageWorkflows,sendStageEvent,stageWorkflowId}=await import('./stages.mjs');
 const base='b'.repeat(64),created=[],watchdog=[],status=new Map(),events=[];
 const workflow={
  async get(id){if(id===base)throw Error('no legacy instance');return {async status(){return status.get(id)||{status:'waiting'}},async sendEvent(ev){events.push({id,ev});}}}
 };
 const started=await startStageWorkflows(workflow,{},base,ticket,{register:async(_db,id)=>watchdog.push(id),schedule:async(_wf,id,_ticket,{lane})=>{created.push({id,lane});status.set(id,{status:'waiting'});return {status:'RECOVERING'};}});
 assert.deepEqual(started,{ok:true,mode:'staged'});
 assert.deepEqual(created.map(x=>x.lane),['verification','reporting','discovery']);
 assert.equal(new Set(watchdog).size,3);
 const verify=await sendStageEvent(workflow,base,{lane:'verification'});
 assert.deepEqual(verify,{ok:true,delivered:1});
 assert.equal(events[0].ev.type,'wake_verification');assert.deepEqual(events[0].ev.payload,{done:false});
 assert.equal(events[0].id,await stageWorkflowId(base,'verification'));
 const finished=await sendStageEvent(workflow,base,{finish:true});
 assert.deepEqual(finished,{ok:true,delivered:3});
 assert.ok(events.slice(1).every(x=>x.ev.payload.done===true));
 const legacy={async get(){return {async status(){return {status:'running'}}}}};
 assert.deepEqual(await startStageWorkflows(legacy,{},base,ticket,{register:async()=>assert.fail(),schedule:async()=>assert.fail()}),{ok:true,mode:'legacy'});
});

test('authorized recovery request may restart only a due registered Workflow, exactly once under contention',async()=>{
 const {restartRecoveredWorkflowOnAuthorizedStart,registerWatchdogInstance}=await import('./runner.mjs');
 const {db}=registry(),now=2000,id='a'.repeat(64),statuses=new Map([[id,{status:'complete',output:{status:'RECOVERING',error:'AI_BACKGROUND_WORKFLOW_ROLLOVER'}}]]);
 let restarted=0;
 const workflow={async get(key){assert.equal(key,id);return {async status(){return statuses.get(id)},async restart(){restarted++;statuses.set(id,{status:'running'});}}}};
 await registerWatchdogInstance(db,id,now);
 const results=await Promise.all([restartRecoveredWorkflowOnAuthorizedStart(db,workflow,id,{now}),restartRecoveredWorkflowOnAuthorizedStart(db,workflow,id,{now})]);
 assert.equal(results.filter(Boolean).length,1);
 assert.equal(restarted,1);
 assert.equal(await restartRecoveredWorkflowOnAuthorizedStart(db,workflow,id,{now:now+1}),false);
 assert.equal(await restartRecoveredWorkflowOnAuthorizedStart(db,workflow,'invalid',{now}),false);
});
test('authorized recovery helper never restarts active, waiting or terminal workflows',async()=>{
 const {restartRecoveredWorkflowOnAuthorizedStart,registerWatchdogInstance}=await import('./runner.mjs');
 const {db}=registry(),now=5000,id='b'.repeat(64);
 let state={status:'waiting'},restarted=0;
 const workflow={async get(){return {async status(){return state},async restart(){restarted++}}}};
 await registerWatchdogInstance(db,id,now);
 for(const x of [{status:'waiting'},{status:'running'},{status:'complete',output:{status:'COMPLETE'}},{status:'complete',output:{status:'FAILED',error:'AI_PROVIDER_KEY_REJECTED'}},{status:'terminated'}]){
  state=x;assert.equal(await restartRecoveredWorkflowOnAuthorizedStart(db,workflow,id,{now}),false);
 }
 assert.equal(restarted,0);
 state={status:'errored'};
 assert.equal(await restartRecoveredWorkflowOnAuthorizedStart(db,workflow,id,{now}),true,'due failure may now restart');
 assert.equal(restarted,1);
});


test('terminal SSE result survives a transport that remains open after commit',async()=>{
 const encoder=new TextEncoder();
 const stream=new ReadableStream({start(controller){controller.enqueue(encoder.encode('event: complete\ndata: {"status":"CONTINUE"}\n\n'));}});
 const result=await requestPhase(async()=>new Response(stream),ticket,{diagnostic:true});
 assert.deepEqual(result,{status:'CONTINUE'});
});
test('split terminal SSE frames retain their result; EOF without terminal remains recoverable',async()=>{
 const encoder=new TextEncoder();
 const stream=new ReadableStream({start(controller){for(const part of ['event: heartbeat\n','data: {}\n\nevent: com','plete\ndata: {"status":"HANDOFF"}\n','\n'])controller.enqueue(encoder.encode(part));controller.close();}});
 assert.equal(await requestPhase(async()=>new Response(stream),ticket),'HANDOFF');
 await assert.rejects(requestPhase(async()=>event('heartbeat',{}),ticket),/AI_BACKGROUND_RESPONSE_INCOMPLETE/);
});


test('early verifier processes independently queued JDs without waiting for discovery to finish',async()=>{
 const values=[{status:'HANDOFF',next_lane:'discovery'},{status:'COMPLETE'}],calls=[],sleeps=[],waits=[];
 const step={async waitForEvent(name){waits.push(name);return {payload:{done:false}};},async do(_name,_opts,fn){return fn();},async sleep(name,seconds){sleeps.push([name,seconds]);}};
 const result=await driveBackgroundMatch(step,ticket,async(url)=>{
  calls.push(url);
  if(url.endsWith('/background-job-step'))return Response.json({status:'DONE'});
  return event('complete',values.shift());
 },{lane:'verification',jobsEnabled:true,maxSteps:3});
 assert.deepEqual(result,{status:'COMPLETE'});
 assert.ok(sleeps.some(([name,duration])=>name.startsWith('early-verification-')&&duration==='30 seconds'));
 assert.equal(waits.length,1,'early JD work must not wait for a second wake event');
 assert.equal(calls.filter(x=>x.endsWith('/background-job-step')).length,4);
 assert.equal(calls.filter(x=>x.endsWith('/background-step')).length,2);
});


test('workflow distinguishes live task lease from a stale one and respects the reported wait',async()=>{
 const response=()=>Response.json({ok:false,error:'AI_TASK_IN_PROGRESS',lease_state:'ACTIVE',retry_after_seconds:38},{status:409});
 assert.deepEqual(await requestPhase(async()=>response(),ticket,{diagnostic:true}),{status:'RECOVERING',error:'AI_TASK_IN_PROGRESS',retry_after_seconds:38,lease_state:'ACTIVE'});
 let calls=0;const sleeps=[];
 const step={async do(_name,_options,fn){return fn();},async sleep(_name,duration){sleeps.push(duration);}};
 const result=await driveBackgroundMatch(step,ticket,async()=>++calls===1?response():event('complete',{status:'COMPLETE'}),{maxSteps:3});
 assert.deepEqual(result,{status:'COMPLETE'});
 assert.deepEqual(sleeps,['38 seconds']);
 assert.equal(calls,2,'lease owner must not be force-unlocked or duplicated');
 const expired=await requestPhase(async()=>Response.json({error:'AI_TASK_IN_PROGRESS',lease_state:'EXPIRED',retry_after_seconds:3},{status:409}),ticket,{diagnostic:true});
 assert.equal(expired.lease_state,'EXPIRED');
 assert.equal(expired.retry_after_seconds,3);
});


test('staged discovery is not blocked behind slow JD requests while verification has its own workflow',async()=>{
 let research=0,unwantedJobCalls=0;
 const step={async do(_name,_cfg,fn){return fn();}};
 const result=await driveBackgroundMatch(step,ticket,async(url)=>{
  if(url.endsWith('/background-job-step')){unwantedJobCalls++;throw Error('JD should run in verification stage');}
  research++;
  return event('complete',{status:research===1?'CONTINUE':'COMPLETE'});
 },{lane:'discovery',jobsEnabled:true,maxSteps:3});
 assert.deepEqual(result,{status:'COMPLETE'});
 assert.equal(research,2);assert.equal(unwantedJobCalls,0);
});
test('incomplete second-round response retries the original ticket and preserves recovery code',async()=>{
 const calls=[],sleeps=[];
 const step={async do(_name,_opts,fn){return fn();},async sleep(_name,delay){sleeps.push(delay);}};
 const result=await driveBackgroundMatch(step,ticket,async(_url,init)=>{
  calls.push(JSON.parse(init.body));
  if(calls.length===1)return event('complete',{status:'CONTINUE'});
  if(calls.length===2)return event('heartbeat',{stage:'research'});
  return event('complete',{status:'COMPLETE'});
 },{maxSteps:4});
 assert.deepEqual(result,{status:'COMPLETE'});assert.equal(calls.length,3);
 assert.ok(calls.every(x=>x.ticket===ticket));
 assert.equal(calls[2].recovery,'AI_BACKGROUND_RESPONSE_INCOMPLETE');
 assert.deepEqual(sleeps,['15 seconds']);
});
