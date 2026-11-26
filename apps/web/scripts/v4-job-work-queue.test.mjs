import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {candidateRevision} from '../functions/_lib/v4-research-pipeline.js';
import {desiredV4JobWork,reconcileV4JobWork,claimV4JobWork,renewV4JobWork,finishV4JobWork,clearV4JobWork} from '../functions/_lib/v4-job-work-queue.js';
const sql=readFileSync(new URL('../d1/20261126_v4_job_work_queue.sql',import.meta.url),'utf8');
const taskKey='a'.repeat(64);
const url='https://careers.employer.cn/jobs/123';
const source=()=>({company:'测试企业',title:'区域运营',location:'北京',employer_proof_url:url,requirements:'真实岗位'});
const scored=()=>({official_url:url,company:'测试企业',title:'区域运营',location:'北京',
 source_type:'站外官方招聘',curated_suitable:true,match_score:86,
 jd_source_status:'VERIFIED_JD',evidence_status:'VERIFIED_FULL_JD',score_evidence_status:'GROUNDED_JD_RESUME_QUOTES',evidence_excerpt:'真实岗位要求'});
function fixture(){
 const local=new DatabaseSync(':memory:');local.exec(sql);
 const db={prepare(q){return {bind(...args){return {
  async all(){return {results:local.prepare(q).all(...args)}},
  async run(){const r=local.prepare(q).run(...args);return {success:true,meta:{changes:Number(r.changes)}}}
 }}}},
 async batch(statements){return Promise.all(statements.map(s=>s.run()))}};
 return {local,db};
}
test('encrypted-checkpoint-derived work contains no plaintext employer or job URLs',async()=>{
 const checkpoint={phase:'verification',rows:[[url,source()]],processedEarlier:[],processedEvidence:[],matches:[scored()]};
 const tasks=await desiredV4JobWork(taskKey,0,checkpoint);
 assert.equal(tasks.length,2);
 assert.deepEqual(tasks.map(x=>x.lane),['verification','reporting']);
 for(const row of tasks){assert.match(row.job_key,/^[a-f0-9]{64}$/);assert.match(row.revision,/^[a-f0-9]{64}$/);}
 assert.ok(!JSON.stringify(tasks).includes(url));
 assert.ok(!JSON.stringify(tasks).includes('测试企业'));
});
test('D1 job claims are atomic, generation fenced and expire for safe automatic pickup',async()=>{
 const {db,local}=fixture(),checkpoint={phase:'verification',rows:[[url,source()]],processedEarlier:[],processedEvidence:[],matches:[scored()]};
 assert.deepEqual(await reconcileV4JobWork(db,taskKey,0,checkpoint,{now:1000}),{available:true,work:2,createdOrUpdated:2,invalidated:0,remaining:0});
 const claim=await claimV4JobWork(db,taskKey,0,'verification',{now:1100,owner:'owner-A',leaseMs:15000});
 assert.ok(claim);assert.equal(claim.attempts,1);
 assert.equal(await claimV4JobWork(db,taskKey,0,'verification',{now:1200,owner:'owner-B'}),null);
 assert.equal(await renewV4JobWork(db,{...claim,owner:'other'},{now:1300}),false);
 assert.equal(await finishV4JobWork(db,{...claim,owner:'other'},{now:1300}),false);
 assert.equal(await renewV4JobWork(db,claim,{now:1400,leaseMs:15000}),true);
 assert.equal(await claimV4JobWork(db,taskKey,1,'verification',{now:1600}),null);
 assert.equal(await claimV4JobWork(db,taskKey,0,'verification',{now:16399,owner:'owner-C'}),null);
 const recovered=await claimV4JobWork(db,taskKey,0,'verification',{now:16401,owner:'owner-C'});
 assert.ok(recovered);assert.equal(recovered.attempts,2);
 assert.equal(await finishV4JobWork(db,claim,{now:16403}),false);
 assert.equal(await finishV4JobWork(db,recovered,{now:16404}),true);
 assert.equal(await claimV4JobWork(db,taskKey,0,'verification',{now:16500}),null);
 assert.equal(local.prepare("SELECT state FROM hhba_v4_job_work_queue WHERE lane='verification'").get().state,'COMPLETED');
});
test('later source revisions invalidate an old lease without falsely carrying over a score',async()=>{
 const {db,local}=fixture(),original={phase:'verification',rows:[[url,source()]],processedEarlier:[],processedEvidence:[],matches:[]};
 await reconcileV4JobWork(db,taskKey,0,original,{now:1000});
 const leased=await claimV4JobWork(db,taskKey,0,'verification',{now:1001,owner:'old'});
 const changed={...original,rows:[[url,{...source(),requirements:'新的真实要求'}]]};
 const updated=await reconcileV4JobWork(db,taskKey,0,changed,{now:1002});
 assert.equal(updated.createdOrUpdated,1);
 assert.equal(await finishV4JobWork(db,leased,{now:1003}),false);
 const fresh=await claimV4JobWork(db,taskKey,0,'verification',{now:1004,owner:'new'});
 assert.ok(fresh);assert.notEqual(fresh.revision,leased.revision);
 assert.equal(fresh.attempts,2);
 await finishV4JobWork(db,fresh,{now:1005});
 const recheck={...changed,processedEarlier:[url],processedEvidence:[[url,candidateRevision(changed.rows[0][1])]]};
 await reconcileV4JobWork(db,taskKey,0,recheck,{now:1006});
 assert.equal(local.prepare("SELECT state FROM hhba_v4_job_work_queue WHERE lane='verification'").get().state,'COMPLETED');
 assert.equal(await clearV4JobWork(db,taskKey,0),true);
 assert.equal(local.prepare('SELECT COUNT(*) AS n FROM hhba_v4_job_work_queue').get().n,0);
});
test('queue synchronization is revision-aware, incremental and does not re-run unchanged jobs',async()=>{
 const {db,local}=fixture(),cp={phase:'verification',rows:[[url,source()]],processedEarlier:[],processedEvidence:[],matches:[scored()]};
 const first=await reconcileV4JobWork(db,taskKey,4,cp,{now:2000,maxChanges:1});
 assert.equal(first.remaining,1);
 const second=await reconcileV4JobWork(db,taskKey,4,cp,{now:2001,maxChanges:1});
 assert.equal(second.remaining,0);
 const unchanged=await reconcileV4JobWork(db,taskKey,4,cp,{now:2002});
 assert.equal(unchanged.createdOrUpdated,0);
 assert.equal(local.prepare('SELECT COUNT(*) AS n FROM hhba_v4_job_work_queue').get().n,2);
});
test('queue remains disabled unless Cloudflare explicitly enables the migration-backed feature',async()=>{
 const {v4JobWorkQueueEnabled}=await import('../functions/_lib/v4-job-work-queue.js');
 assert.equal(v4JobWorkQueueEnabled({}),false);
 assert.equal(v4JobWorkQueueEnabled({HHBA_V4_JOB_QUEUE_ENABLED:'1',HHBA_PNVS_AUTH_DB:{prepare(){}}}),true);
 const route=readFileSync(new URL('../functions/api/match-v4/[[path]].js',import.meta.url),'utf8');
 assert.match(route,/await saveMatchTask\(env,input\.taskKey,\{checkpoint:result\.checkpoint/);
 assert.match(route,/if\(input\.background&&v4JobWorkQueueEnabled\(env\)\)/);
 assert.match(route,/await reconcileV4JobWork\(env\.HHBA_PNVS_AUTH_DB,input\.taskKey,input\.generation\|\|0,result\.checkpoint\)/);
});
