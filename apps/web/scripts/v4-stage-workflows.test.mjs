import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {v4CheckpointLane,stageWorkflowSignal,stagedV4WorkflowsEnabled} from '../functions/_lib/v4-stage-workflows.js';
const candidate=url=>[url,{company:'真实企业',title:'区域督导',location:'上海'}];
test('autonomous discovery, JD/score and reporting use independent durable stage ownership',()=>{
 assert.equal(v4CheckpointLane(null),'discovery');
 assert.equal(v4CheckpointLane({phase:'research',rows:[candidate('https://company.invalid/job/1')],liveDeliveryTurn:'search'}),'discovery');
 assert.equal(v4CheckpointLane({phase:'research',rows:[candidate('https://company.invalid/job/1')],liveDeliveryTurn:'verification'}),'verification');
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
});
