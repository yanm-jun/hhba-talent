import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {matchTaskKey,saveMatchTask} from '../functions/_lib/v4-match-checkpoint-storage.js';
import {updateSessionTask,researchTaskKey} from '../functions/_lib/v4-session-match-task.js';
import {scheduleBackgroundMatch} from '../functions/_lib/v4-background-match.js';
import {reconcileV4JobWork,claimV4JobWork,finishV4JobWork} from '../functions/_lib/v4-job-work-queue.js';
import {independentJobKey,runIndependentV4Job} from '../functions/_lib/v4-job-executor.js';

const queueSchema=readFileSync(new URL('../d1/20261126_v4_job_work_queue.sql',import.meta.url),'utf8');
function fixture(){
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec(queueSchema);
 sqlite.exec('CREATE TABLE hhba_ai_checkpoint_claims(token_hash TEXT PRIMARY KEY,expires_at TEXT); CREATE TABLE hhba_auth_sessions(token_hash TEXT PRIMARY KEY,phone TEXT,expires_at TEXT,revoked INTEGER)');
 const db={prepare(sql){return {bind(...args){return {
  async first(){return sqlite.prepare(sql).get(...args)||null;},
  async all(){return {results:sqlite.prepare(sql).all(...args)};},
  async run(){const result=sqlite.prepare(sql).run(...args);return {success:true,meta:{changes:Number(result.changes)}};}
 }}}},async batch(statements){return Promise.all(statements.map(x=>x.run()))}};
 const objects=new Map(),reads=[];
 const bucket={
  async put(key,value){objects.set(key,value.slice());},
  async get(key){reads.push(key);const v=objects.get(key);return v?{arrayBuffer:async()=>v.buffer}:null;}
 };
 const env={HHBA_PNVS_AUTH_DB:db,HHBA_PRIVATE_RESUMES:bucket,
  HHBA_V4_MATCH_CHECKPOINT_STORAGE:'1',
  HHBA_MATCH_V4_CHECKPOINT_SECRET:'private_synthetic_test_secret_only_1234',
  HHBA_V4_JOB_QUEUE_ENABLED:'1',HHBA_V4_JOB_EXECUTOR_ENABLED:'1'};
 const session={phone:'13800000009',token_hash:'synthetic-token',expires_at:new Date(Date.now()+3600000).toISOString(),revoked:0};
 sqlite.prepare('INSERT INTO hhba_auth_sessions VALUES(?,?,?,?)').run(session.token_hash,session.phone,session.expires_at,0);
 env.HHBA_MATCH_BACKGROUND={async fetch(){return Response.json({ok:true})}};
 return {env,db,sqlite,session,reads};
}
test('cached one-job retry reads encrypted sidecar, not full 500-job master, and never calls AI',async()=>{
 const {env,db,session,reads}=fixture();
 const task=await updateSessionTask(env,session,'start',{
  id:crypto.randomUUID(),text:'synthetic only resume',role:'区域督导',excludeUrls:[],resume_id:null
 });
 const taskKey=await researchTaskKey(env,session,task);
 const jobUrl='https://employer.invalid/careers/active/1';
 const candidate={company:'测试企业',title:'区域管理',location:'上海',employer_proof_url:jobUrl,requirements:'管理门店',url:jobUrl};
 const checkpoint={phase:'verification',rows:[[jobUrl,candidate]],matches:[],processedEarlier:[],processedEvidence:[]};
 await saveMatchTask(env,taskKey,{generation:0,checkpoint});
 await reconcileV4JobWork(db,taskKey,0,checkpoint);
 const claim=await claimV4JobWork(db,taskKey,0,'verification',{owner:'seed-generator'});
 assert.ok(claim);
 assert.equal(await finishV4JobWork(db,claim,{completed:false,continued:true}),true);
 const resultKey=await independentJobKey(taskKey,0,'verification',claim.job_key,claim.revision);
 await saveMatchTask(env,resultKey,{
  kind:'V4_INDEPENDENT_JOB_V1',generation:0,lane:'verification',job_key:claim.job_key,revision:claim.revision,
  source_url:jobUrl,seed_source:candidate,seed_score:null,
  checkpoint:{phase:'verification',rows:[[jobUrl,candidate]],profile:{summary:'test'}},
  complete:true,job:{research_candidate_url:jobUrl,official_url:jobUrl,company:'测试企业',title:'区域管理',match_score:85}
 });
 const ticket=await matchTaskKey(env,session.phone,task.id,{scope:'workflow-ticket-v1',session_hash:session.token_hash,generation:0});
 await scheduleBackgroundMatch(env,session,task);
 reads.length=0;
 const result=await runIndependentV4Job(env,ticket,'verification',{fetcher:async()=>{throw Error('PAID_AI_CALL_MUST_NOT_RUN')}});
 assert.deepEqual(result,{status:'DONE',lane:'verification',cached:true});
 assert.equal(reads.filter(k=>k==='v4-match-continuations/tasks/'+taskKey).length,0,'no costly full research decrypt for a verified retry');
 assert.ok(reads.includes('v4-match-continuations/tasks/'+resultKey));
 assert.equal((await db.prepare("SELECT state FROM hhba_v4_job_work_queue WHERE task_key=? AND generation=? AND lane='verification'").bind(taskKey,0).first()).state,'COMPLETED');
});
test('sidecar cannot replace main research evidence or bypass active session',async()=>{
 const route=readFileSync(new URL('../functions/_lib/v4-job-executor.js',import.meta.url),'utf8');
 const latest=readFileSync(new URL('../functions/_lib/v4-independent-job-delivery.js',import.meta.url),'utf8');
 assert.ok(route.includes('await assertSessionTaskActive(env,session,task.id,generation)'));
 assert.ok(route.includes('await renewV4JobWork(db,claim,{leaseMs:300000})'));
 assert.ok(route.includes('exactSeed'));
 assert.ok(route.includes('await workKey(taskKey,seedUrl)===claim.job_key'));
 assert.ok(route.includes("previous.reference_first?referenceWorkRevision(seedSource):reportWorkRevision(seedSource,seedScore)"),'reference and formal report revisions remain separately fenced');
 assert.ok(route.includes('candidateRevision(seedSource))===claim.revision'),'independent verification revision must remain fenced');
 assert.ok(latest.includes("saved.revision!==record.revision"));
 assert.ok(latest.includes("saved.source_url!==found.url"));
});
