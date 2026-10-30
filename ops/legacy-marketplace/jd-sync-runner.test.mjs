import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openJobSyncStore} from './jd-sync-store.mjs';
import {createFullJdWorker} from './jd-sync-runner.mjs';
const job={id:'greenhouse-airtable-101',platform:'greenhouse',company:'Airtable',url:'https://job-boards.greenhouse.io/airtable/jobs/101'};
const chunk=['# Responsibilities\n\n- Build customer applications and maintain reliable systems.','# Requirements\n\n- Five years of software development experience and good communication skills.'];
function setup(t,{maxPartsDaily=100}={}){
 const root=mkdtempSync(join(tmpdir(),'hhba-worker-'));
 t.after(()=>rmSync(root,{force:true,recursive:true}));
 let ts=Date.UTC(2026,9,19), calls=0,translations=[];
 const store=openJobSyncStore(join(root,'states.sqlite'),{root,now:()=>ts});
 const catalog={rows:[job],boards:3,failures:0,updated:'2026-10-19T12:00:00Z'};
 const create=(getTranslation=async(_job,text,part)=>{translations.push(part);return part===0?'岗位职责：维护客户系统':'任职要求：五年以上的软件开发经验'})=>
 createFullJdWorker({store,source:async()=>catalog,readDetail:async()=>({status:'LIVE_CONTENT',description:chunk.join('\n\n')}),
 chunkJd:()=>chunk,translateChunk:getTranslation,maxPartsDaily,maxPartsPerTick:1,now:()=>ts,logger:()=>{}});
 return {store,catalog,create,translations,move:n=>ts+=n,get time(){return ts}};
}
test('background job progresses through verified chunks without claiming COMPLETE early',async t=>{
 const s=setup(t);const worker=s.create();
 assert.equal((await worker.tick()).progress,true);
 assert.equal(s.store.coverage().complete,0);
 assert.equal(s.store.metadata(job.id).done,1);
 assert.equal((await worker.tick()).complete,true);
 assert.equal(s.store.coverage().complete,1);
 assert.deepEqual(s.translations,[0,1]);
 assert.equal((await worker.tick()).idle,true);
 s.store.close();
});
test('resume on restart, preserve previously translated segment and source hash',async t=>{
 const s=setup(t);await s.create().tick();const afterRestart=s.create();
 assert.equal((await afterRestart.tick()).complete,true);
 assert.deepEqual(s.translations,[0,1]);
 s.store.close();
});
test('partial ATS index failure never marks missing current jobs as REMOVED',async t=>{
 const s=setup(t);
 await s.create().tick();
 s.catalog.rows=[];
 s.catalog.failures=1;s.catalog.updated='2026-10-19T12:02:00Z';
 const outcome=await s.create().tick();
 assert.equal(outcome.error,'INVALID_OFFICIAL_ATS_INDEX');
 assert.equal(s.store.coverage().total_current,1);
 s.store.close();
});
test('fixed daily machine translation budget is enforced across independent jobs',async t=>{
 const s=setup(t,{maxPartsDaily:1});const worker=s.create();
 assert.equal((await worker.tick()).progress,true);
 assert.equal(s.store.remainingBudget(1),0);
 assert.equal((await worker.tick()).budget_exhausted,true);
 assert.equal(s.store.coverage().complete,0);
 s.move(86400_000);
 assert.equal((await worker.tick()).complete,true);
 s.store.close();
});
test('translation failure is marked RETRY, does not publish incomplete Chinese',async t=>{
 const s=setup(t);
 const w=s.create(async()=>{throw Error('translator_unavailable')});
 const r=await w.tick();
 assert.equal(r.retry,true);
 assert.equal(s.store.coverage().complete,0);
 assert.equal(s.store.metadata(job.id).state,'RETRY');
 assert.equal((await w.tick()).idle,true);
 s.store.close();
});
