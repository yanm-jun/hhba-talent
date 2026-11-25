import test from 'node:test';
import assert from 'node:assert/strict';
import {driveBackgroundMatch,requestPhase} from './runner.mjs';
const ticket='a'.repeat(64);
const event=(kind,value)=>new Response('event: '+kind+'\ndata: '+JSON.stringify(value)+'\n\n',{headers:{'Content-Type':'text/event-stream'}});
test('independent runner advances persisted phases until terminal success, without browser state',async()=>{
 const outcomes=['CONTINUE','CONTINUE','COMPLETE'],calls=[],steps=[];
 const step={async do(name,config,fn){steps.push(name);return fn();}};
 const result=await driveBackgroundMatch(step,ticket,async(url,init)=>{
  assert.equal(url,'https://hhba.work/api/match-v4/background-step');assert.deepEqual(JSON.parse(init.body),{ticket});calls.push(url);
  return event('complete',{status:outcomes.shift()});
 });
 assert.deepEqual(result,{status:'COMPLETE'});assert.equal(calls.length,3);assert.equal(new Set(steps).size,3);
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
