import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {candidateRevision} from '../functions/_lib/v4-research-pipeline.js';
import {reconcileV4JobWork,claimV4JobWork,finishV4JobWork} from '../functions/_lib/v4-job-work-queue.js';
import {independentJobKey,v4JobExecutorEnabled,mergeIndependentV4Jobs,runIndependentV4Job} from '../functions/_lib/v4-job-executor.js';
const schema=readFileSync(new URL('../d1/20261126_v4_job_work_queue.sql',import.meta.url),'utf8');
const taskKey='b'.repeat(64),url='https://careers.real.test/job/22';
const candidate=()=>({company:'真实雇主',title:'区域督导',location:'上海',requirements:'销售运营经验',employer_proof_url:url});
const scored=()=>({research_candidate_url:url,official_url:url,company:'真实雇主',title:'区域督导',location:'上海',curated_suitable:true,source_type:'站外官方招聘',match_score:86,jd_source_status:'VERIFIED_JD',score_evidence_status:'GROUNDED_JD_RESUME_QUOTES',evidence_excerpt:'销售运营经验'});
function fixture(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(schema);
 const db={prepare(sql){return {bind(...args){return {async all(){return {results:sqlite.prepare(sql).all(...args)}},async first(){return sqlite.prepare(sql).get(...args)},async run(){const r=sqlite.prepare(sql).run(...args);return {success:true,meta:{changes:Number(r.changes)}}}}}}},async batch(statements){return Promise.all(statements.map(s=>s.run()))}};
 const env={HHBA_V4_JOB_EXECUTOR_ENABLED:'1',HHBA_V4_JOB_QUEUE_ENABLED:'1',HHBA_PNVS_AUTH_DB:db};
 return {db,env};
}
test('executor is strictly gated by both queue and active worker deployment flags',async()=>{
 assert.equal(v4JobExecutorEnabled({}),false);
 assert.equal(v4JobExecutorEnabled({HHBA_V4_JOB_EXECUTOR_ENABLED:'1'}),false);
 assert.equal(v4JobExecutorEnabled(fixture().env),true);
 assert.deepEqual(await runIndependentV4Job({},'opaque','verification'),{status:'DISABLED'});
});
test('completed verification merges from encrypted job result exactly once',async()=>{
 const {db,env}=fixture(),cp={phase:'verification',rows:[[url,candidate()]],matches:[],processedEarlier:[],processedEvidence:[],read:0,scored:0};
 await reconcileV4JobWork(db,taskKey,0,cp);
 const claim=await claimV4JobWork(db,taskKey,0,'verification',{owner:'one'});assert.ok(claim);
 assert.equal(await finishV4JobWork(db,claim),true);
 const resultKey=await independentJobKey(taskKey,0,'verification',claim.job_key,claim.revision);
 let reads=0;
 const read=async(_env,id)=>{reads++;assert.equal(id,resultKey);return {kind:'V4_INDEPENDENT_JOB_V1',complete:true,generation:0,lane:'verification',job_key:claim.job_key,revision:claim.revision,source_url:url,job:scored(),checkpoint:{read:1,scored:1,archived:1}};};
 const first=await mergeIndependentV4Jobs(env,taskKey,0,cp,{read});
 assert.equal(first.count,1);assert.equal(first.checkpoint.matches.length,1);
 assert.equal(first.checkpoint.matches[0].match_score,86);
 assert.deepEqual(first.checkpoint.processedEarlier,[url]);
 assert.deepEqual(first.checkpoint.processedEvidence,[[url,candidateRevision(candidate())]]);
 assert.equal(first.checkpoint.scored,1);
 const second=await mergeIndependentV4Jobs(env,taskKey,0,first.checkpoint,{read});
 assert.equal(second.count,0);assert.equal(second.checkpoint.scored,1);assert.equal(reads,1);
 const changed={...cp,rows:[[url,{...candidate(),requirements:'要求已变更'}]]};
 const invalidated=await mergeIndependentV4Jobs(env,taskKey,0,changed,{read});
 assert.equal(invalidated.count,0);assert.equal(reads,1,'stale revision never causes a result fetch');
});
test('independent report result can replace only the selected ranked job',async()=>{
 const {db,env}=fixture(),cp={phase:'reporting',rows:[[url,candidate()]],matches:[scored()],globalRankState:{done:true},globalOrder:[url]};
 await reconcileV4JobWork(db,taskKey,1,cp);
 const claim=await claimV4JobWork(db,taskKey,1,'reporting',{owner:'reporter'});assert.ok(claim);
 assert.equal(await finishV4JobWork(db,claim),true);
 const read=async()=>({kind:'V4_INDEPENDENT_JOB_V1',complete:true,generation:1,lane:'reporting',job_key:claim.job_key,revision:claim.revision,source_url:url,job:{...scored(),report_status:'UNAVAILABLE',report_retry_reason:'VALIDATED_EVIDENCE_MISSING'}});
 const result=await mergeIndependentV4Jobs(env,taskKey,1,cp,{read});
 assert.equal(result.count,1);assert.equal(result.checkpoint.matches[0].report_status,'UNAVAILABLE');
 assert.equal((await mergeIndependentV4Jobs(env,taskKey,1,result.checkpoint,{read})).count,0);
});
