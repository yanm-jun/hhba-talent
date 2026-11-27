// Private D1 job reservations for durable future parallel workers.
// The authoritative encrypted research checkpoint remains the ONLY source
// of truth for what research a job needs. This queue contains only keyed
// digests and lease state. It cannot award a score or fabricate a report.
import {sha256Hex} from './real-auth.js';
import {candidateRevision,pendingVerification} from './v4-research-pipeline.js';
import {eligibleCuratedScore,qualifiedReport,FINAL_TARGET} from './v4-curated-reports.js';

const taskId=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const generationOk=v=>Number.isSafeInteger(v)&&v>=0;
const laneOk=v=>v==='verification'||v==='reporting';
export const reportWorkRevision=(candidate,scored)=>scored?JSON.stringify([candidateRevision(candidate),scored.match_score,scored.jd_sha256,scored.jd_version_id,scored.score_evidence_status,scored.reference_vacancy_verified]):null;
const valid=(key,generation)=>taskId(key)&&generationOk(generation);
export const v4JobWorkQueueEnabled=env=>env?.HHBA_V4_JOB_QUEUE_ENABLED==='1'&&typeof env?.HHBA_PNVS_AUTH_DB?.prepare==='function';

export async function desiredV4JobWork(taskKey,generation,checkpoint){
 if(!valid(taskKey,generation)||!checkpoint||!Array.isArray(checkpoint.rows))return [];
 const results=[],dedupe=new Set(),completed=new Set(checkpoint.processedEarlier||[]),
  revisions=new Map(checkpoint.processedEvidence||[]),rechecks=new Set(checkpoint.explicitRechecks||[]),
  matches=[...(checkpoint.priorState?.matches||[]),...(checkpoint.matches||[])];
 const byUrl=new Map(matches.map(job=>[job.research_candidate_url||job.official_url,job]).filter(([u])=>typeof u==='string'));
 const pending=new Set(pendingVerification(checkpoint).map(([url])=>url));
 // A long report is expensive: queue only the AI-confirmed global top 50,
 // never every scored candidate or a provisional order during discovery.
 const reportSelection=new Set(checkpoint.phase==='reporting'&&checkpoint.globalRankState?.done===true&&Array.isArray(checkpoint.globalOrder)?checkpoint.globalOrder.slice(0,FINAL_TARGET):[]);
 const digest=async(url,lane,revision)=>{
  const job_key=await sha256Hex('HHBA_V4_JOB_WORK:'+taskKey+':'+url);
  const rev=await sha256Hex('HHBA_V4_JOB_REV:'+revision);
  const id=lane+':'+job_key;if(dedupe.has(id))return;
  dedupe.add(id);return {lane,job_key,revision:rev,state:'PENDING'};
 };
 for(const [url,job] of checkpoint.rows){
  if(typeof url!=='string'||!job||job.excluded_closed||job.excluded_board||job.availability_status==='CLOSED_LISTED')continue;
  const version=candidateRevision(job);
  const task=await digest(url,'verification',version);
  if(task){task.state=!pending.has(url)&&completed.has(url)&&revisions.get(url)===version&&!rechecks.has(url)?'COMPLETED':'PENDING';results.push(task);}
  const scored=byUrl.get(url);
  if(scored&&reportSelection.has(scored.official_url)&&(eligibleCuratedScore(scored)||qualifiedReport(scored))){
   const reportVersion=reportWorkRevision(job,scored);
   const report=await digest(url,'reporting',reportVersion);
   if(report){report.state=qualifiedReport(scored)?'COMPLETED':'PENDING';results.push(report);}
  }
 }
 return results;
}
const UPSERT=`INSERT INTO hhba_v4_job_work_queue
(task_key,generation,lane,job_key,revision,state,lease_owner,lease_until_ms,attempts,created_at_ms,updated_at_ms)
VALUES(?,?,?,?,?,?,NULL,0,0,?,?)
ON CONFLICT(task_key,generation,lane,job_key) DO UPDATE SET
revision=excluded.revision,
state=CASE WHEN revision!=excluded.revision OR excluded.state='COMPLETED' THEN excluded.state ELSE state END,
lease_owner=CASE WHEN revision!=excluded.revision OR excluded.state='COMPLETED' THEN NULL ELSE lease_owner END,
lease_until_ms=CASE WHEN revision!=excluded.revision OR excluded.state='COMPLETED' THEN 0 ELSE lease_until_ms END,
attempts=CASE WHEN revision!=excluded.revision THEN 0 ELSE attempts END,
updated_at_ms=excluded.updated_at_ms`;
export async function reconcileV4JobWork(db,taskKey,generation,checkpoint,{now=Date.now(),maxChanges=40}={}){
 if(!db?.prepare||!valid(taskKey,generation))return {available:false};
 const desired=await desiredV4JobWork(taskKey,generation,checkpoint);
 const found=await db.prepare('SELECT lane,job_key,revision,state FROM hhba_v4_job_work_queue WHERE task_key=? AND generation=?').bind(taskKey,generation).all();
 const existing=new Map((found.results||[]).map(r=>[r.lane+':'+r.job_key,r]));
 const expected=new Set(desired.map(r=>r.lane+':'+r.job_key));
 const updates=desired.filter(row=>{const prev=existing.get(row.lane+':'+row.job_key);return !prev||prev.revision!==row.revision||row.state==='COMPLETED'&&prev.state!=='COMPLETED';});
 const stale=[...existing.values()].filter(r=>!expected.has(r.lane+':'+r.job_key));
 const changes=Math.max(1,Math.min(100,Number.isSafeInteger(maxChanges)?maxChanges:40));
 const selected=updates.slice(0,changes);
 const deletions=stale.slice(0,Math.max(0,changes-selected.length));
 const queries=[...selected.map(r=>db.prepare(UPSERT).bind(taskKey,generation,r.lane,r.job_key,r.revision,r.state,now,now)),
   ...deletions.map(r=>db.prepare('DELETE FROM hhba_v4_job_work_queue WHERE task_key=? AND generation=? AND lane=? AND job_key=? AND (state!=? OR lease_until_ms<=?)').bind(taskKey,generation,r.lane,r.job_key,'LEASED',now))];
 if(queries.length)await db.batch(queries);
 return {available:true,work:desired.length,createdOrUpdated:selected.length,invalidated:deletions.length,remaining:Math.max(0,updates.length+stale.length-queries.length)};
}
// PENDING rows also use lease_until_ms as an eligible-after timestamp after
// failed attempts. They remain visible in the queue and are retried later;
// unlike the old attempts<3 guard, no job silently becomes unclaimable.
export const v4JobRetryDelayMs=(attempt,error='')=>{
 // The failure countdown controls only *when* a job may retry, never how many
 // jobs or AI research attempts the system may perform. Transient errors
 // recover in <=5m. Respect longer provider rate-limit and daily-cap recovery.
 const maximum=error==='AI_EDGE_DAILY_LIMIT'?3600000:
  error==='AI_PROVIDER_RATE_LIMITED'?600000:300000;
 const minimum=error==='AI_PROVIDER_RATE_LIMITED'?60000:
  error==='AI_EDGE_DAILY_LIMIT'?3600000:30000;
 return Math.min(maximum,Math.max(minimum,30000*2**Math.min(8,Math.max(0,(Number(attempt)||1)-1))));
};
// Atomic D1 UPDATE ... RETURNING fences duplicate lease owners. The worker
// must independently re-read encrypted checkpoint, verify revision, and check
// task authorization before doing any AI research.
export async function claimV4JobWork(db,taskKey,generation,lane,{now=Date.now(),leaseMs=120000,owner=crypto.randomUUID()}={}){
 if(!db?.prepare||!valid(taskKey,generation)||!laneOk(lane)||typeof owner!=='string'||!owner)return null;
 const until=now+Math.max(15000,Math.min(300000,Math.floor(leaseMs)));
 // Cloudflare Free has a finite concurrent-invocation/CPU budget. Atomically
 // reserve no more than two live job leases per task generation, regardless of
 // how many older Workflow instances dispatch at once. This controls only
 // simultaneous processing, never the research size or job queue length.
 const maxActiveLeases=2;
 const sql=`UPDATE hhba_v4_job_work_queue SET
 state='LEASED',lease_owner=?,lease_until_ms=?,attempts=attempts+1,updated_at_ms=?
 WHERE rowid=(SELECT rowid FROM hhba_v4_job_work_queue
 WHERE task_key=? AND generation=? AND lane=?
 AND ((state='PENDING' AND lease_until_ms<=?) OR (state='LEASED' AND lease_until_ms<=?))
 ORDER BY lease_until_ms,updated_at_ms,job_key LIMIT 1)
 AND (SELECT COUNT(*) FROM hhba_v4_job_work_queue
 WHERE task_key=? AND generation=? AND state='LEASED' AND lease_until_ms>?)<?
 RETURNING job_key,revision,attempts,lease_until_ms`;
 const result=await db.prepare(sql).bind(owner,until,now,taskKey,generation,lane,now,now,taskKey,generation,now,maxActiveLeases).all();
 const job=result?.results?.[0];
 return job?{...job,task_key:taskKey,generation,lane,owner}:null;
}
export async function renewV4JobWork(db,claim,{now=Date.now(),leaseMs=120000}={}){
 if(!db?.prepare||!valid(claim?.task_key,claim?.generation)||!laneOk(claim?.lane))return false;
 const until=now+Math.max(15000,Math.min(300000,Math.floor(leaseMs)));
 const r=await db.prepare(`UPDATE hhba_v4_job_work_queue SET lease_until_ms=?,updated_at_ms=? WHERE
 task_key=? AND generation=? AND lane=? AND job_key=? AND revision=? AND state='LEASED' AND lease_owner=? AND lease_until_ms>?`)
 .bind(until,now,claim.task_key,claim.generation,claim.lane,claim.job_key,claim.revision,claim.owner,now).run();
 return r?.meta?.changes===1;
}
export async function finishV4JobWork(db,claim,{now=Date.now(),completed=true,continued=false,error=''}={}){
 if(!db?.prepare||!valid(claim?.task_key,claim?.generation)||!laneOk(claim?.lane))return false;
 const state=completed?'COMPLETED':'PENDING';
 // Each real failure receives an increasing durable cooldown, not an
 // artificial maximum number of research attempts. A successful continuation
 // clears the cooldown and restores normal queue scheduling.
 const eligibleAt=completed||continued?0:now+v4JobRetryDelayMs(claim.attempts,error);
 const r=await db.prepare(`UPDATE hhba_v4_job_work_queue SET
 state=?,lease_owner=NULL,lease_until_ms=?,updated_at_ms=?,attempts=CASE WHEN ?=1 THEN MAX(0,attempts-1) ELSE attempts END
 WHERE task_key=? AND generation=? AND lane=? AND job_key=?
 AND revision=? AND state='LEASED' AND lease_owner=? AND lease_until_ms>?`)
 .bind(state,eligibleAt,now,continued?1:0,claim.task_key,claim.generation,claim.lane,claim.job_key,claim.revision,claim.owner,now).run();
 return r?.meta?.changes===1;
}
export async function clearV4JobWork(db,taskKey,generation){
 if(!db?.prepare||!valid(taskKey,generation))return false;
 const r=await db.prepare('DELETE FROM hhba_v4_job_work_queue WHERE task_key=? AND generation=?').bind(taskKey,generation).run();
 return r?.success!==false;
}
