// Separate Pages invocations consume D1-leased, revision-bound job work.
// The queue holds hashes only. Resume and model evidence remain in the
// authorized encrypted task checkpoint; no external Worker receives either.
import {sha256Hex} from './real-auth.js';
import {candidateRevision} from './v4-research-pipeline.js';
import {eligibleCuratedScore,qualifiedReport} from './v4-curated-reports.js';
import {claimV4JobWork,renewV4JobWork,finishV4JobWork,v4JobWorkQueueEnabled,reportWorkRevision} from './v4-job-work-queue.js';
import {readMatchTask,saveMatchTask} from './v4-match-checkpoint-storage.js';
import {loadBackgroundMatch} from './v4-background-match.js';
import {assertSessionTaskActive} from './v4-session-match-task.js';
import {v4JobProvider,v4Match} from './simple-match-v4.js';
import {v4ManagedResourceBudget} from './v4-phase-budget.js';

const keyOk=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
export async function pendingIndependentV4Work(env,taskKey,generation){
 if(!v4JobExecutorEnabled(env)||!keyOk(taskKey))return 0;
 const result=await env.HHBA_PNVS_AUTH_DB.prepare("SELECT COUNT(*) AS n FROM hhba_v4_job_work_queue WHERE task_key=? AND generation=? AND state IN ('PENDING','LEASED') AND attempts<3").bind(taskKey,generation).first();
 return Math.max(0,Number(result?.n)||0);
}

export const v4JobExecutorEnabled=env=>env?.HHBA_V4_JOB_EXECUTOR_ENABLED==='1'&&v4JobWorkQueueEnabled(env);
export const independentJobKey=(taskKey,generation,lane,jobKey,revision)=>
 sha256Hex(JSON.stringify(['HHBA_V4_INDEPENDENT_JOB_RESULT_V1',taskKey,generation,lane,jobKey,revision]));
const workKey=(taskKey,url)=>sha256Hex('HHBA_V4_JOB_WORK:'+taskKey+':'+url);
const revKey=revision=>sha256Hex('HHBA_V4_JOB_REV:'+revision);
const itemUrl=job=>job?.research_candidate_url||job?.official_url||job?.url||'';
const doneReport=job=>qualifiedReport(job)||['DECLINED','UNAVAILABLE'].includes(job?.report_status);
const suitableScore=job=>job&&(Number.isInteger(job.match_score)||job.evidence_score_status==='AI_REFERENCE_JD_SCORED'||job.score_evidence_status==='GROUNDED_JD_RESUME_QUOTES'||job.curated_suitable===false);
const eligibleJob=(checkpoint,url)=>new Map(checkpoint?.rows||[]).get(url);
const sourceFor=(checkpoint,url)=>[
 ...(checkpoint?.priorState?.matches||[]),...(checkpoint?.matches||[])
].find(job=>itemUrl(job)===url);
function oneJobCheckpoint(checkpoint,url,job,lane){
 const scored=sourceFor(checkpoint,url);
 const proofUrls=new Set([url,job.employer_proof_url,...(job.employer_proof_urls||[])].filter(Boolean));
 return {
  phase:lane==='verification'?'verification':'reporting',rows:[[url,structuredClone(job)]],
  toolUrls:(checkpoint.toolUrls||[]).filter(x=>proofUrls.has(x)),profile:checkpoint.profile,
  round:checkpoint.round||0,rounds:[],sourceLeads:[],observedSearchSources:[],
  publicEvidence:(checkpoint.publicEvidence||[]).filter(r=>proofUrls.has(r?.url)||proofUrls.has(r?.document_url)),
  candidateResearchMemory:(checkpoint.candidateResearchMemory||[]).filter(([u])=>u===url),
  researchNotes:[],researchDigest:'',processedEarlier:[],processedEvidence:[],explicitRechecks:[],
  rejectedBoards:[],verifiedReads:[],verificationReads:[],verificationDeferred:[],
  matches:lane==='reporting'&&scored?[structuredClone(scored)]:[],
  read:0,scored:0,archived:0,scoreFailures:0,reportFailures:0,reportWidth:1,
  next:0,verificationBatch:1,verificationLaneWidth:1,
  globalOrder:lane==='reporting'&&scored?[scored.official_url]:null
 };
}
function jobFromCheckpoint(checkpoint,url,original){
 const candidates=[...(checkpoint?.matches||[]),...(checkpoint?.priorState?.matches||[])];
 return candidates.find(x=>itemUrl(x)===url||x.official_url===original?.official_url)||null;
}
const errorCode=e=>typeof e?.code==='string'&&/^[A-Z][A-Z0-9_]{4,90}$/.test(e.code)?e.code:'AI_BACKGROUND_EXECUTION_FAILED';

// A claimed job runs with its own invocation budget and encrypted continuation.
// It never owns the main task lease; only its own D1 job lease may be renewed.
export async function runIndependentV4Job(env,ticket,lane,{fetcher=fetch}={}){
 if(!v4JobExecutorEnabled(env)||!['verification','reporting'].includes(lane))return {status:'DISABLED'};
 const {session,task,taskKey}=await loadBackgroundMatch(env,ticket);
 const generation=task.generation,db=env.HHBA_PNVS_AUTH_DB;
 const claim=await claimV4JobWork(db,taskKey,generation,lane,{leaseMs:300000});
 if(!claim)return {status:'EMPTY'};
 let heartbeat=null,leaseLost=false,done=false;
 try{
  const latest=await readMatchTask(env,taskKey);
  if(latest?.generation!==generation||latest.result||!latest.checkpoint)return {status:'STALE'};
  const checkpoint=latest.checkpoint;
  let url='',source=null;
  for(const [u,j] of checkpoint.rows||[]){
   if(await workKey(taskKey,u)===claim.job_key){url=u;source=j;break;}
  }
  if(!url||!source)return {status:'STALE'};
  const activeScore=sourceFor(checkpoint,url);
  const currentVersion=lane==='reporting'?reportWorkRevision(source,activeScore):candidateRevision(source);
  if(!currentVersion||await revKey(currentVersion)!==claim.revision)return {status:'STALE'};
  const resultKey=await independentJobKey(taskKey,generation,lane,claim.job_key,claim.revision);
  const previous=await readMatchTask(env,resultKey);
  if(previous?.kind==='V4_INDEPENDENT_JOB_V1'&&previous.complete&&previous.job){
   done=true;
   await finishV4JobWork(db,claim,{completed:true});
   return {status:'DONE',lane};
  }
  let child=previous?.kind==='V4_INDEPENDENT_JOB_V1'&&previous.generation===generation?
   previous.checkpoint:null;
  if(!child)child=oneJobCheckpoint(checkpoint,url,source,lane);
  const budget=v4ManagedResourceBudget({background:true,recovering:!!previous});
  const scoped=budget.env(env),provider=v4JobProvider(scoped);
  if(!provider)return {status:'DISABLED'};
  provider.phaseResourceBudget=budget;
  let recovery=()=>child;
  heartbeat=setInterval(()=>{void renewV4JobWork(db,claim,{leaseMs:300000}).then(ok=>{if(!ok)leaseLost=true;}).catch(()=>{leaseLost=true;});},45000);
  let run;
  try{
   run=await v4Match(budget.fetch(fetcher),provider,task.text,task.role,{
    env:scoped,excludeUrls:task.excludeUrls||[],checkpoint:child,stepMode:true,
    curated:true,officialOnly:true,parallelResearch:false,pipelineChild:true,
    resourceBudget:budget,allowContinue:true,onRecoveryState:get=>{recovery=get;}
   });
  }catch(e){
   if(e?.code==='AI_AGENT_CANCELLED')throw e;
   const snapshot=recovery();
   if(snapshot&&!leaseLost&&await renewV4JobWork(db,claim,{leaseMs:300000})){
    await saveMatchTask(env,resultKey,{kind:'V4_INDEPENDENT_JOB_V1',generation,lane,revision:claim.revision,job_key:claim.job_key,checkpoint:snapshot,complete:false});
   }
   return {status:'RETRY',error:errorCode(e)};
  }
  const snapshot=run.status==='CONTINUE'?run.checkpoint:run.resume_checkpoint||recovery();
  const result=jobFromCheckpoint(snapshot,url,source)||run.matches?.find(x=>itemUrl(x)===url)||null;
  done=lane==='verification'?!!result&&(snapshot?.phase==='reporting'||run.status==='COMPLETE'):
   !!result&&doneReport(result);
  await assertSessionTaskActive(env,session,task.id,generation);
  // Fence against a changed candidate, canceled task or reclaimed lease.
  const current=await readMatchTask(env,taskKey);
  const live=eligibleJob(current?.checkpoint,url);
  const liveVersion=lane==='reporting'?reportWorkRevision(live,sourceFor(current?.checkpoint,url)):live&&candidateRevision(live);
  if(current?.generation!==generation||current.result||!live||!liveVersion||await revKey(liveVersion)!==claim.revision)throw Object.assign(Error('AI_CHECKPOINT_INVALID'),{code:'AI_CHECKPOINT_INVALID'});
  if(leaseLost||!await renewV4JobWork(db,claim,{leaseMs:300000}))throw Object.assign(Error('AI_CHECKPOINT_LEASE_LOST'),{code:'AI_CHECKPOINT_LEASE_LOST'});
  await saveMatchTask(env,resultKey,{kind:'V4_INDEPENDENT_JOB_V1',generation,lane,revision:claim.revision,job_key:claim.job_key,checkpoint:snapshot,job:result,complete:done,source_url:url});
  await finishV4JobWork(db,claim,{completed:done});
  return {status:done?'DONE':'CONTINUE',lane};
 }catch(e){
  return {status:'RETRY',error:errorCode(e)};
 }finally{
  if(heartbeat)clearInterval(heartbeat);
  if(!done)await finishV4JobWork(db,claim,{completed:false}).catch(()=>{});
 }
}

// Main-phase checkpoints remain the only authority. Never merge stale job
// results: require matching user generation, input revision and current URL.
export async function mergeIndependentV4Jobs(env,taskKey,generation,checkpoint,{read=readMatchTask}={}){
 if(!v4JobExecutorEnabled(env)||!keyOk(taskKey)||!checkpoint?.rows)return {checkpoint,count:0};
 const db=env.HHBA_PNVS_AUTH_DB;
 const result=await db.prepare("SELECT lane,job_key,revision FROM hhba_v4_job_work_queue WHERE task_key=? AND generation=? AND state='COMPLETED' ORDER BY lane,job_key").bind(taskKey,generation).all();
 const entries=result?.results||[];
 if(!entries.length)return {checkpoint,count:0};
 const byKey=new Map();
 for(const [url,job] of checkpoint.rows||[]){const scored=sourceFor(checkpoint,url),rr=reportWorkRevision(job,scored);
  byKey.set(await workKey(taskKey,url),{url,job,revision:await revKey(candidateRevision(job)),reportRevision:rr?await revKey(rr):null});
 }
 const next=structuredClone(checkpoint),done=new Set(next.processedEarlier||[]),revisions=new Map(next.processedEvidence||[]);
 let count=0;
 for(const record of entries){
  const current=byKey.get(record.job_key);
  if(!current||(record.lane==='reporting'?current.reportRevision:current.revision)!==record.revision)continue;
  if(record.lane==='verification'&&done.has(current.url)&&revisions.get(current.url)===candidateRevision(current.job))continue;
  const resultKey=await independentJobKey(taskKey,generation,record.lane,record.job_key,record.revision);
  const saved=await read(env,resultKey);
  if(saved?.kind!=='V4_INDEPENDENT_JOB_V1'||!saved.complete||saved.generation!==generation||saved.revision!==record.revision||saved.source_url!==current.url||!saved.job)continue;
  if(record.lane==='reporting'&&!doneReport(saved.job))continue;
  const parent=next.phase==='research'?(next.priorState||(next.priorState={matches:[],read:0,scored:0,archived:0,scoreFailures:0,reportFailures:0})):next;
  const matches=parent.matches||(parent.matches=[]);
  const idx=matches.findIndex(x=>itemUrl(x)===current.url);
  if(record.lane==='verification'&&idx>=0&&suitableScore(matches[idx]))continue;
  if(record.lane==='reporting'&&idx<0)continue;
  if(record.lane==='reporting'&&doneReport(matches[idx]))continue;
  const row=structuredClone(saved.job);
  if(idx<0)matches.push(row);else matches[idx]={...matches[idx],...row};
  if(record.lane==='verification'){
   done.add(current.url);revisions.set(current.url,candidateRevision(current.job));
   for(const field of ['read','scored','archived','scoreFailures']){
    const amount=Number(saved.checkpoint?.[field]||0);
    if(amount>0)parent[field]=(parent[field]||0)+amount;
   }
  }
  count++;
 }
 if(count){next.processedEarlier=[...done];next.processedEvidence=[...revisions];next.diagnostics={...next.diagnostics,INDEPENDENT_JOB_RESULTS_MERGED:(next.diagnostics?.INDEPENDENT_JOB_RESULTS_MERGED||0)+count};}
 return {checkpoint:next,count};
}
