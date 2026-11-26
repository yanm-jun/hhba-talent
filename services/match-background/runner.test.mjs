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
test('edge-compatible manual redirects never send ticket to another destination',async()=>{
 let calls=0;
 for(const status of [301,302,303,307,308])assert.equal(await requestPhase(async(url,init)=>{calls++;assert.equal(init.redirect,'manual');return new Response(null,{status,headers:{Location:'https://other.example/'}});},ticket),'FAILED');
 assert.equal(calls,5);
});
test('explicit termination, revocation or expired ticket never starts another phase',async()=>{
 for(const error of ['AI_AGENT_CANCELLED','AI_BACKGROUND_TICKET_INVALID','AI_CHECKPOINT_EXPIRED']){
  assert.equal(await requestPhase(async()=>Response.json({error},{status:409}),ticket),'STOP');
 }
 assert.equal(await requestPhase(async()=>event('failure',{error:'AI_AGENT_CANCELLED'}),ticket),'STOP');
});
test('lease conflict and interrupted response are retried, not treated as completed',async()=>{
 await assert.rejects(requestPhase(async()=>Response.json({error:'AI_TASK_IN_PROGRESS'},{status:409}),ticket),/BACKGROUND_PHASE_RETRY/);
 await assert.rejects(requestPhase(async()=>event('failure',{error:'AI_PROVIDER_UPSTREAM_ERROR',retryable:true}),ticket),/BACKGROUND_PHASE_RETRY/);
 await assert.rejects(requestPhase(async()=>new Response(''),ticket),/BACKGROUND_PHASE_RETRY/);
 assert.equal(await requestPhase(async()=>event('failure',{error:'AI_PROVIDER_KEY_REJECTED'}),ticket),'FAILED');
});

test('existing terminated or failed workflow is not mistaken for a running scheduler',async()=>{
 const {scheduleWorkflowInstance}=await import('./runner.mjs');
 for(const status of ['queued','running','waiting','complete','errored','terminated','paused','unknown']){
  const binding={async create(){throw Error('(instance.already_exists)')},async get(id){assert.equal(id,'id');return {async status(){return {status}}}}};
  assert.equal(await scheduleWorkflowInstance(binding,'id',ticket),['queued','running','waiting'].includes(status));
 }
 assert.equal(await scheduleWorkflowInstance({async create(){}},'id',ticket),true);
});

test('authorized scheduler restarts errored workflow only, never terminated or completed workflow',async()=>{
 const {scheduleWorkflowInstance}=await import('./runner.mjs');
 for(const status of ['errored','terminated','complete','paused']){
  let restarted=0;
  const binding={async create(){throw Error('(instance.already_exists)')},async get(){return {async status(){return {status}},async restart(){restarted++}}}};
  assert.equal(await scheduleWorkflowInstance(binding,'id',ticket),status==='errored');assert.equal(restarted,status==='errored'?1:0);
 }
});

test('watchdog fairly resumes errored instances and never reopens terminal workflows',async()=>{
 const {registerWatchdogInstance,inspectWatchdogInstances}=await import('./runner.mjs');
 const rows=new Map(),now=1000,statuses=new Map(),restarted=[];
 const db={prepare(sql){return {bind(...v){return {async run(){
  if(sql.startsWith('INSERT'))rows.set(v[0],{instance_id:v[0],next_check:v[1],expires_at:v[2]});
  else if(sql.startsWith('DELETE'))rows.delete(v[0]);
  else rows.get(v[1]).next_check=v[0];
 },async all(){return {results:[...rows.values()].filter(r=>r.next_check<=v[0]).slice(0,v[1])}}}}}}};
 for(const [i,status] of ['errored','terminated','complete','running','paused'].entries()){
  const id=String(i+1).repeat(64);statuses.set(id,status);await registerWatchdogInstance(db,id,now);
 }
 const workflow={async get(id){return {async status(){return {status:statuses.get(id)}},async restart(){restarted.push(id);statuses.set(id,'running')}}}};
 const result=await inspectWatchdogInstances(db,workflow,{now,batch:20});
 assert.deepEqual(result,{checked:5,restarted:1});assert.deepEqual(restarted,['1'.repeat(64)]);assert.equal(rows.size,2);
 assert.deepEqual(await inspectWatchdogInstances(db,workflow,{now:now+1}),{checked:0,restarted:0});
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


test('deterministic invalid edge request stops without retry and exhausted transient phase is terminal',async()=>{
 let calls=0;assert.equal(await requestPhase(async()=>{calls++;throw new TypeError('Invalid redirect value');},ticket),'FAILED');assert.equal(calls,1);
 const state=await driveBackgroundMatch({async do(name,config,fn){assert.equal(config.retries.limit,5);assert.equal(config.retries.backoff,'exponential');return fn();}},ticket,async()=>new Response(null,{status:503}));
 assert.deepEqual(state,{status:'FAILED',error:'AI_BACKGROUND_HTTP_503'});
});


test('edge exhaustion and lease contention have distinct diagnostics; checkpoint yields are successful continuations',async()=>{
 await assert.rejects(requestPhase(async()=>new Response('<h1>Error 1102</h1>',{status:503}),ticket),/AI_EDGE_RESOURCE_EXHAUSTED/);
 await assert.rejects(requestPhase(async()=>Response.json({error:'AI_TASK_IN_PROGRESS'},{status:409}),ticket),/AI_TASK_IN_PROGRESS/);
 const values=['CONTINUE','CONTINUE','COMPLETE'];let calls=0;
 const result=await driveBackgroundMatch({async do(_name,_config,fn){return fn();}},ticket,async()=>{calls++;return event('complete',{status:values.shift()});});
 assert.equal(calls,3);assert.deepEqual(result,{status:'COMPLETE'});
});
