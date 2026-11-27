// Read-only delivery of newly COMPLETED independent job results. Called only
// after the existing managed match endpoint has authenticated the exact user,
// task and active generation. No job text or resume is written to D1.
import {sha256Hex} from './real-auth.js';
import {candidateRevision} from './v4-research-pipeline.js';
import {reportWorkRevision} from './v4-job-work-queue.js';
import {independentJobKey} from './v4-job-executor.js';
import {locateV4ClaimCandidate} from './v4-job-locator.js';
import {readMatchTask} from './v4-match-checkpoint-storage.js';

const safeKey=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const itemUrl=x=>x?.research_candidate_url||x?.official_url||x?.url||'';
export const v4JobDeltaCursor=(value)=>{
 if(!value||!Number.isSafeInteger(value.ms)||value.ms<0||!['verification','reporting',''].includes(value.lane)||
   typeof value.key!=='string'||value.key.length>64||value.key!==''&&!safeKey(value.key))return {ms:0,lane:'',key:''};
 return {ms:value.ms,lane:value.lane,key:value.key};
};
export function v4CompactProgress(progress,previousStamp){
 if(!progress||typeof previousStamp!=='string'||!previousStamp)return progress;
 const stamp=progress.delivery_stamp;
 const key=stamp&&Number.isSafeInteger(stamp.phase_started_at)&&Number.isSafeInteger(stamp.version)?stamp.phase_started_at+':'+stamp.version:null;
 if(!key||previousStamp!==key)return progress;
 const {jobs,job_events,...metadata}=progress;
 return metadata; // unchanged snapshots still include fresh heartbeat/activity
}
export async function completedV4JobDeltas(env,taskKey,generation,cursorValue,{read=readMatchTask,pageSize=12}={}){
 if(!safeKey(taskKey)||!Number.isSafeInteger(generation)||generation<0||
   !env?.HHBA_PNVS_AUTH_DB?.prepare)return {cursor:v4JobDeltaCursor(cursorValue),jobs:[],more:false};
 const cursor=v4JobDeltaCursor(cursorValue),limit=Math.max(1,Math.min(24,Math.floor(pageSize)||12));
 const result=await env.HHBA_PNVS_AUTH_DB.prepare(
  "SELECT lane,job_key,revision,updated_at_ms FROM hhba_v4_job_work_queue WHERE task_key=? AND generation=? AND state='COMPLETED' AND (updated_at_ms>? OR (updated_at_ms=? AND lane>?) OR (updated_at_ms=? AND lane=? AND job_key>?)) ORDER BY updated_at_ms,lane,job_key LIMIT ?"
 ).bind(taskKey,generation,cursor.ms,cursor.ms,cursor.lane,cursor.ms,cursor.lane,cursor.key,limit).all();
 const records=result?.results||[];
 if(!records.length)return {cursor,jobs:[],more:false};
 // Reading the large encrypted research head happens only when D1 confirms
 // a newly completed job. The main research Workflow remains the sole writer.
 const current=await read(env,taskKey);
 if(current?.generation!==generation||current.result||!current.checkpoint)return {cursor,jobs:[],more:false};
 const checkpoint=current.checkpoint,jobs=[];
 for(const record of records){
  const found=await locateV4ClaimCandidate(checkpoint,taskKey,record.job_key);
  if(!found)continue;
  const score=[...(checkpoint.priorState?.matches||[]),...(checkpoint.matches||[])]
   .find(x=>itemUrl(x)===found.url);
  const sourceVersion=record.lane==='reporting'?reportWorkRevision(found.source,score):candidateRevision(found.source);
  if(!sourceVersion||await sha256Hex('HHBA_V4_JOB_REV:'+sourceVersion)!==record.revision)continue;
  const key=await independentJobKey(taskKey,generation,record.lane,record.job_key,record.revision);
  const saved=await read(env,key);
  if(saved?.kind!=='V4_INDEPENDENT_JOB_V1'||!saved.complete||saved.generation!==generation||
   saved.lane!==record.lane||saved.revision!==record.revision||
   saved.source_url!==found.url||!saved.job||itemUrl(saved.job)!==found.url)continue;
  jobs.push(saved.job);
 }
 const last=records[records.length-1];
 return {cursor:{ms:last.updated_at_ms,lane:last.lane,key:last.job_key},jobs,more:records.length>=limit};
}
