import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {v4CheckpointLane,stageWorkflowSignal,stagedV4WorkflowsEnabled} from '../functions/_lib/v4-stage-workflows.js';
const candidate=url=>[url,{company:'真实企业',title:'区域督导',location:'上海'}];
test('autonomous discovery, JD/score and reporting use independent durable stage ownership',()=>{
 assert.equal(v4CheckpointLane(null),'discovery');
 assert.equal(v4CheckpointLane({phase:'research',rows:[candidate('https://company.invalid/job/1')],liveDeliveryTurn:'search'}),'discovery');
 assert.equal(v4CheckpointLane({phase:'research',rows:[candidate('https://company.invalid/job/1')],liveDeliveryTurn:'verification'}),'verification');
 // The enabled independent job queue owns JD/score/report work while the
 // discovery Workflow keeps searching beyond its first research wave.
 assert.equal(v4CheckpointLane({phase:'research',rows:[candidate('https://company.invalid/job/1')],liveDeliveryTurn:'verification'},{independentJobs:true}),'discovery');
 assert.equal(v4CheckpointLane({phase:'research',rows:[candidate('https://company.invalid/job/1')],liveDeliveryTurn:'verification',priorState:{matches:[]}},{independentJobs:true}),'discovery');
 assert.equal(v4CheckpointLane({phase:'verification'},{independentJobs:true}),'verification');
 assert.equal(v4CheckpointLane({phase:'reporting'},{independentJobs:true}),'reporting');
 assert.equal(v4CheckpointLane({phase:'verification'}),'verification');
 assert.equal(v4CheckpointLane({phase:'reporting'}),'reporting');
 assert.equal(v4CheckpointLane({phase:'research',backfillSignature:'active',rows:[candidate('https://company.invalid/job/1')],liveDeliveryTurn:'verification'}),'discovery');
});
test('stage wake uses only private service binding and deterministic opaque instance',async()=>{
 const ticket='a'.repeat(64),sent=[],env={HHBA_V4_STAGE_WORKFLOWS:'1',HHBA_MATCH_BACKGROUND:{async fetch(url,init){sent.push({url,init:JSON.parse(init.body)});return Response.json({ok:true})}}};
 assert.equal(stagedV4WorkflowsEnabled(env),true);
 assert.equal(await stageWorkflowSignal(env,ticket,{lane:'verification'}),true);
 assert.equal(await stageWorkflowSignal(env,ticket,{finish:true}),true);
 assert.deepEqual(sent.map(x=>x.url),['https://hhba-internal.invalid/wake','https://hhba-internal.invalid/finish']);
 assert.equal(sent[0].init.instance,sent[1].init.instance);
 assert.deepEqual(Object.keys(sent[0].init).sort(),['instance','lane']);
 assert.equal(JSON.stringify(sent).includes(ticket),false);
 assert.equal(await stageWorkflowSignal(env,ticket,{lane:'invalid'}),false);
 assert.equal(sent.length,2);
 assert.equal(await stageWorkflowSignal({...env,HHBA_V4_STAGE_WORKFLOWS:'0'},ticket,{lane:'discovery'}),false);
});
test('staged handoff always happens after encrypted checkpoint save and task lease release',()=>{
 const route=readFileSync(new URL('../functions/api/match-v4/[[path]].js',import.meta.url),'utf8');
 assert.match(route,/await saveMatchTask\(env,input\.taskKey,\{checkpoint:result\.checkpoint/);
 assert.match(route,/await publishProgress\(\);await releaseTask\(\);\s*await stageCompleteOrHandoff\(result\.checkpoint\)/);
 assert.match(route,/if\(input\.backgroundLane&&!input\.cachedResult\)/);
 assert.match(route,/if\(next!==input\.backgroundLane\)/);
 assert.equal(route.split('v4CheckpointLane(checkpoint,{independentJobs:v4JobExecutorEnabled(env)})').length-1,1);
 assert.equal(route.split('v4CheckpointLane(input.checkpoint,{independentJobs:v4JobExecutorEnabled(env)})').length-1,1);
});

test('independent job wait does not re-save unchanged private checkpoints or fake completion',()=>{
 const route=readFileSync(new URL('../functions/api/match-v4/[[path]].js',import.meta.url),'utf8');
 const runner=readFileSync(new URL('../../../services/match-background/runner.mjs',import.meta.url),'utf8');
 assert.ok(route.includes("if(!result.waitingIndependentJobs||mergedIndependentJobs>0)"),
  'new independent evidence is saved while an unchanged checkpoint is not re-encrypted every idle tick');
 assert.ok(route.includes("send('complete',{status:'CONTINUE',waiting_for_jobs:true})"),
  'pending JD progress must never be reported as finished');
 assert.ok(runner.includes("value?.waiting_for_jobs===true"));
 assert.ok(runner.includes("step.sleep('wait-independent-jobs-'+phase,'30 seconds')"));
});
test('fallback driver retains authorized task cleanup without adding an AI provider call',()=>{
 const route=readFileSync(new URL('../functions/api/match-v4/[[path]].js',import.meta.url),'utf8');
 const runner=readFileSync(new URL('../../../services/match-background/runner.mjs',import.meta.url),'utf8');
 assert.match(route,/stagedFallback=data\?\.staged_fallback===true/);
 assert.match(route,/isV4StageLane\(lane\)\|\|stagedFallback/);
 assert.match(runner,/staged_fallback:true/);
 assert.match(runner,/stagedFallback:stagedOrigin&&!currentLane/);
});

test('explicit user cancel/close finishes sleeping stages after invalidating their current generation',()=>{
 const route=readFileSync(new URL('../functions/api/match-v4/[[path]].js',import.meta.url),'utf8');
 assert.match(route,/const previous=action==='close'\|\|action==='cancel'\?/);
 assert.match(route,/previous\.id===entry\.id&&previous\.generation===entry\.generation/);
 assert.match(route,/const task=await updateSessionTask\(env,session,action,entry\)/);
 assert.match(route,/await stageWorkflowSignal\(env,ticket,\{finish:true\}\)/);
});
