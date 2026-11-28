import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {sha256Hex} from '../functions/_lib/real-auth.js';
import {candidateRevision} from '../functions/_lib/v4-research-pipeline.js';
import {reconcileV4JobWork,claimV4JobWork,finishV4JobWork} from '../functions/_lib/v4-job-work-queue.js';
import {independentJobKey} from '../functions/_lib/v4-job-executor.js';
import {completedV4JobDeltas,v4CompactProgress} from '../functions/_lib/v4-independent-job-delivery.js';
const schema=readFileSync(new URL('../d1/20261126_v4_job_work_queue.sql',import.meta.url),'utf8');
const taskKey='b'.repeat(64);
const url=i=>'https://careers.synthetic.cn/jobs/'+i;
const candidate=i=>({company:'匿名测试公司',title:'区域督导'+i,location:'深圳',requirements:'门店管理经验'+i,employer_proof_url:url(i)});
const scored=i=>({research_candidate_url:url(i),official_url:url(i),company:'匿名测试公司',title:'区域督导'+i,
 location:'深圳',source_type:'站外官方招聘',match_score:80+i,jd_source_status:'VERIFIED_JD',evidence_status:'VERIFIED_FULL_JD',
 score_evidence_status:'GROUNDED_JD_RESUME_QUOTES',evidence_excerpt:'有工作经历',report_status:'RETRY_PENDING'});
function fixture(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(schema);
 const db={prepare(sql){return {bind(...args){return {
  async all(){return {results:sqlite.prepare(sql).all(...args)}},
  async first(){return sqlite.prepare(sql).get(...args)},
  async run(){const r=sqlite.prepare(sql).run(...args);return {success:true,meta:{changes:Number(r.changes)}}}
 }}}},async batch(stmts){return Promise.all(stmts.map(x=>x.run()))}};
 return {db,sqlite,env:{HHBA_PNVS_AUTH_DB:db}};
}
test('authenticated independent result reads are paginated by lossless composite cursor even when many jobs complete in the same millisecond',async()=>{
 const {db,sqlite,env}=fixture(),rows=[1,2,3].map(i=>[url(i),candidate(i)]);
 const checkpoint={phase:'verification',rows,matches:[],processedEarlier:[],processedEvidence:[]};
 await reconcileV4JobWork(db,taskKey,0,checkpoint,{now:500});
 for(let i=0;i<3;i++){
  const claimed=await claimV4JobWork(db,taskKey,0,'verification',{now:600+i*10,owner:'worker-'+i});
  assert.ok(claimed);
  assert.equal(await finishV4JobWork(db,claimed,{now:1000}),true);
 }
 const entries=sqlite.prepare("SELECT lane,job_key,revision FROM hhba_v4_job_work_queue ORDER BY job_key").all(),reads=new Map();
 reads.set(taskKey,{generation:0,checkpoint});
 for(const entry of entries){
  const row=await Promise.all(rows.map(async ([u])=>({url:u,key:await sha256Hex('HHBA_V4_JOB_WORK:'+taskKey+':'+u)})));
  const ix=row.findIndex(x=>x.key===entry.job_key);
  assert.ok(ix>=0);
  const resultKey=await independentJobKey(taskKey,0,entry.lane,entry.job_key,entry.revision);
  reads.set(resultKey,{kind:'V4_INDEPENDENT_JOB_V1',complete:true,lane:entry.lane,generation:0,revision:entry.revision,source_url:row[ix].url,job:scored(ix+1)});
 }
 const read=async(_env,key)=>reads.get(key)||null;
 const first=await completedV4JobDeltas(env,taskKey,0,null,{read,pageSize:2});
 assert.equal(first.jobs.length,2);assert.equal(first.more,true);
 assert.equal(first.cursor.ms,1000);
 const next=await completedV4JobDeltas(env,taskKey,0,first.cursor,{read,pageSize:2});
 assert.equal(next.jobs.length,1);assert.equal(next.more,false);
 const again=await completedV4JobDeltas(env,taskKey,0,next.cursor,{read,pageSize:2});
 assert.equal(again.jobs.length,0);
 assert.equal(new Set([...first.jobs,...next.jobs].map(j=>j.research_candidate_url)).size,3);
 assert.equal(JSON.stringify([...first.jobs,...next.jobs]).includes('b'.repeat(64)),false,'task key remains private');
 // A changed JD revision must not leak the previous saved result.
 const revised={...checkpoint,rows:[[url(1),{...candidate(1),requirements:'全新招聘要求'}],...checkpoint.rows.slice(1)]};
 reads.set(taskKey,{generation:0,checkpoint:revised});
 const full=await completedV4JobDeltas(env,taskKey,0,null,{read,pageSize:12});
 assert.equal(full.jobs.length,2,'a stale source revision is excluded even though its D1 state was completed');
});
test('progress payload omits unchanged large arrays but preserves heartbeat and returns full snapshots on rejoin',()=>{
 const jobs=Array.from({length:500},(_,i)=>({official_url:url(i)}));
 const p={jobs,job_events:[{seq:1,kind:'candidate',url:url(1),at:1}],
  stage:'reading',execution:{worker_seen_at:123},delivery_stamp:{phase_started_at:400,version:5}};
 const compact=v4CompactProgress(p,'400:5');
 assert.equal(compact.jobs,undefined);assert.equal(compact.job_events,undefined);
 assert.deepEqual(compact.execution,p.execution);assert.equal(compact.stage,'reading');
 assert.equal(v4CompactProgress(p,'400:4'),p,'new evidence sends a full authoritative snapshot');
 assert.equal(v4CompactProgress(p,''),p,'new tab or reconnect receives the complete current evidence');
});
test('managed matching route gates job deltas through authenticated task and exact generation',()=>{
 const route=readFileSync(new URL('../functions/api/match-v4/[[path]].js',import.meta.url),'utf8');
 const client=readFileSync(new URL('../src/services/resumeMatch.ts',import.meta.url),'utf8');
 assert.ok(route.includes('await assertSessionTaskActive(env,session,body.task_id,body.research_generation??0)'));
 assert.ok(route.includes('body?.job_delta===true&&input.managed&&v4JobExecutorEnabled(env)'));
 assert.ok(route.includes('completedV4JobDeltas(env,input.taskKey,generation,body.job_cursor)'));
 assert.ok(client.includes('liveCandidates.snapshot(completed.jobs)'));
 assert.ok(client.includes('job_cursor:completedCursor'));
 assert.ok(client.includes('progress_stamp:lastDeliveryStamp'));
});


test('first independently completed AI report reaches authenticated polling without official JD or global rank',async()=>{
 const {db,env}=fixture(),candidateRow=candidate(1),target=url(1);
 const cp={phase:'research',search_mode:'source_pool',source_stop_target:20,final_target:20,
  rows:[[target,candidateRow]],matches:[],processedEarlier:[],processedEvidence:[]};
 await reconcileV4JobWork(db,taskKey,0,cp,{now:500});
 const claim=await claimV4JobWork(db,taskKey,0,'reporting',{now:600,owner:'reference-first'});
 assert.ok(claim);
 assert.equal(await finishV4JobWork(db,claim,{now:700}),true);
 const resultKey=await independentJobKey(taskKey,0,'reporting',claim.job_key,claim.revision);
 const reference={...scored(1),source_type:'站外招聘职位',jd_source_status:undefined,score_evidence_status:undefined,
  curated_suitable:true,match_score:86,reference_jd_kind:'AI_GENERATED_REFERENCE',
  reference_jd:'AI 参考岗位详情',reference_jd_basis:'仅依据岗位方向推断',
  evidence_score_status:'AI_REFERENCE_JD_SCORED',report_status:'COMPLETE',
  research_detail:{score_explanation:'简历事实与参考职责逐项对比',comparisons:[]}};
 const files=new Map([[taskKey,{generation:0,checkpoint:cp}],[resultKey,{kind:'V4_INDEPENDENT_JOB_V1',
  complete:true,generation:0,lane:'reporting',revision:claim.revision,source_url:target,job:reference}]]);
 const read=async(_env,key)=>files.get(key)||null;
 const first=await completedV4JobDeltas(env,taskKey,0,null,{read});
 assert.equal(first.jobs.length,1,'first reference report arrives while source verification is unfinished');
 assert.equal(first.jobs[0].report_status,'COMPLETE');
 assert.equal(first.jobs[0].jd_source_status,undefined);
 assert.equal((await completedV4JobDeltas(env,taskKey,0,first.cursor,{read})).jobs.length,0);
 files.set(taskKey,{generation:0,checkpoint:{...cp,rows:[[target,{...candidateRow,requirements:'new revision'}]]}});
 assert.equal((await completedV4JobDeltas(env,taskKey,0,null,{read})).jobs.length,0,
  'changing the source revision invalidates a stale reference without leaking it');
});
