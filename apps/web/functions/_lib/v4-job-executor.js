// Separate Pages invocations consume D1-leased, revision-bound job work.
// The queue holds hashes only. Resume and model evidence remain in the
// authorized encrypted task checkpoint; no external Worker receives either.
import {sha256Hex} from './real-auth.js';
import {candidateRevision} from './v4-research-pipeline.js';
import {eligibleCuratedScore,qualifiedReport} from './v4-curated-reports.js';
import {claimV4JobWork,renewV4JobWork,finishV4JobWork,v4JobWorkQueueEnabled,reportWorkRevision} from './v4-job-work-queue.js';
import {readMatchTask,saveMatchTask,readMatchProgress} from './v4-match-checkpoint-storage.js';
import {loadBackgroundMatch} from './v4-background-match.js';
import {assertSessionTaskActive} from './v4-session-match-task.js';
import {v4JobProvider,v4Match} from './simple-match-v4.js';
import {v4IndependentJobBudget,phaseModelReplay} from './v4-phase-budget.js';
import {locateV4ClaimCandidate,v4VerifiedJobLocator} from './v4-job-locator.js';

const keyOk=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
export async function pendingIndependentV4Work(env,taskKey,generation){
 if(!v4JobExecutorEnabled(env)||!keyOk(taskKey))return 0;
 const result=await env.HHBA_PNVS_AUTH_DB.prepare("SELECT COUNT(*) AS n FROM hhba_v4_job_work_queue WHERE task_key=? AND generation=? AND state IN ('PENDING','LEASED')").bind(taskKey,generation).first();
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
  phase:lane==='verification'?'verification':'reporting',
   search_mode:checkpoint.search_mode,candidate_target:checkpoint.candidate_target,final_target:checkpoint.final_target,
   rows:[[url,structuredClone(job)]],
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
// A failed provider SSE is a per-job transport problem, not an instruction to
// discard the verified JD research or retry the same failing stream forever.
// Persist this flag in the encrypted, revision-fenced job continuation so the
// next invocation uses Responses JSON with identical model/search parameters.
export const v4IndependentJobTransport=(previous,error,providerStream=true,attempts=0)=>
 previous?.transport_mode==='json'||providerStream===true&&(
 (error?.code==='AI_PROVIDER_UPSTREAM_ERROR'&&error?.upstreamKind==='SSE_FAILED')||
 // Some relays sever the SSE connection before emitting response.failed,
 // exposing only a generic NETWORK_ERROR. After a *second* attempt for the
 // SAME revision-fenced job, persist an alternate JSON transport. This does
 // not add a model call, shorten prompts or weaken the JD verification.
 (error?.code==='AI_PROVIDER_NETWORK_ERROR'&&attempts>=2))
 ?'json':'configured';

// A claimed job runs with its own invocation budget and encrypted continuation.
// It never owns the main task lease; only its own D1 job lease may be renewed.
export async function runIndependentV4Job(env,ticket,lane,{fetcher=fetch}={}){
 if(!v4JobExecutorEnabled(env)||!['verification','reporting'].includes(lane))return {status:'DISABLED'};
 const {session,task,taskKey}=await loadBackgroundMatch(env,ticket);
 const generation=task.generation,db=env.HHBA_PNVS_AUTH_DB;
 const claim=await claimV4JobWork(db,taskKey,generation,lane,{leaseMs:300000});
 if(!claim){
  // This lane has no more claimable work *right now*. Do not mistake a
  // temporarily empty queue for job completion while discovery is still
  // producing candidates. The separately encrypted progress record is a
  // cheap, authorized completion signal and avoids decoding a 500-job
  // checkpoint on each idle Workflow pass.
  const progress=await readMatchProgress(env,taskKey).catch(()=>null);
  if(progress?.generation===generation&&progress.status==='COMPLETE')return {status:'FINISHED'};
  return {status:'EMPTY'};
 }
 let heartbeat=null,leaseLost=false,done=false,retryError=null;
 try{
  // Reuse an encrypted one-job continuation, fenced to this exact D1
  // generation, claim, original job URL and source revision. Fall back to the
  // authoritative full research checkpoint for first attempts/legacy state.
  const resultKey=await independentJobKey(taskKey,generation,lane,claim.job_key,claim.revision);
  const previous=await readMatchTask(env,resultKey);
  const seedUrl=previous?.source_url,seedSource=previous?.seed_source,seedScore=previous?.seed_score;
  const exactSeed=previous?.kind==='V4_INDEPENDENT_JOB_V1'&&previous.generation===generation&&
   previous.lane===lane&&previous.job_key===claim.job_key&&previous.revision===claim.revision&&
   typeof seedUrl==='string'&&seedSource&&previous.checkpoint&&
   await workKey(taskKey,seedUrl)===claim.job_key&&
   await revKey(lane==='reporting'?reportWorkRevision(seedSource,seedScore):candidateRevision(seedSource))===claim.revision;
  let checkpoint=null,url=seedUrl,source=seedSource,activeScore=seedScore;
  if(!exactSeed){
   const latest=await readMatchTask(env,taskKey);
   if(latest?.generation!==generation||latest.result||!latest.checkpoint)return {status:'STALE'};
   checkpoint=latest.checkpoint;
   const located=await locateV4ClaimCandidate(checkpoint,taskKey,claim.job_key);
   url=located?.url;source=located?.source;
   activeScore=url?sourceFor(checkpoint,url):null;
   const version=source?(lane==='reporting'?reportWorkRevision(source,activeScore):candidateRevision(source)):null;
   if(!url||!source||!version||await revKey(version)!==claim.revision){
    // Once the authoritative checkpoint no longer contains this revision,
    // retire the obsolete queue row. Otherwise the 500-job incremental
    // reconciler could repeatedly lease the same invalid row forever.
    done=await finishV4JobWork(db,claim,{completed:true});
    return {status:'STALE'};
   }
  }
  // Legacy saved per-job checkpoints predate the original-source seed.
  // After the authoritative checkpoint validated this job revision, these
  // encrypted continuations are still safe to reuse (no duplicate AI calls).
  const vettedPrevious=previous?.kind==='V4_INDEPENDENT_JOB_V1'&&previous.generation===generation&&
   previous.lane===lane&&previous.revision===claim.revision&&previous.job_key===claim.job_key&&
   previous.source_url===url;
  if(vettedPrevious&&previous.complete&&previous.job){
   done=true;await finishV4JobWork(db,claim,{completed:true});
   return {status:'DONE',lane,cached:true};
  }
  let child=(exactSeed||vettedPrevious)?previous.checkpoint:null;
  if(!child)child=oneJobCheckpoint(checkpoint,url,source,lane);
  const budget=v4IndependentJobBudget();
  const scoped=budget.env(env),provider=v4JobProvider(scoped);
  if(!provider)return {status:'DISABLED'};
  provider.phaseResourceBudget=budget;
  const jobTransport=v4IndependentJobTransport(vettedPrevious?previous:null);
  if(jobTransport==='json'){
   provider.stream=false;
   console.info('HHBA_V4_INDEPENDENT_JOB_JSON_RECOVERY',JSON.stringify({lane}));
  }
  let recovery=()=>child;
  // A long employer-JD review can complete several paid provider calls, then
  // fail on a later page read or Cloudflare 1102. Save each *completed* model
  // response against this revision-fenced, encrypted job sidecar immediately.
  // On retry, the exact same prompt/payload is replayed once; the model still
  // researches any new/changed prompt normally. No task-wide AI cap is added.
  const replay=phaseModelReplay(vettedPrevious?previous?.phaseReplay:[],{
   onRemember:async entries=>{
    if(leaseLost||!await renewV4JobWork(db,claim,{leaseMs:300000})){
     leaseLost=true;throw Object.assign(Error('AI_CHECKPOINT_LEASE_LOST'),{code:'AI_CHECKPOINT_LEASE_LOST'});
    }
    await assertSessionTaskActive(env,session,task.id,generation);
    await saveMatchTask(env,resultKey,{kind:'V4_INDEPENDENT_JOB_V1',generation,lane,revision:claim.revision,
     job_key:claim.job_key,source_url:url,seed_source:source,seed_score:activeScore,
     ...(jobTransport==='json'?{transport_mode:'json'}:{}),
     checkpoint:recovery()||child,phaseReplay:entries,complete:false});
    console.info('HHBA_V4_JOB_MODEL_RESULT_CHECKPOINTED',JSON.stringify({lane,completed_calls:entries.length}));
   }
  });
  provider.phaseReplay=replay;
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
   const transportMode=v4IndependentJobTransport(vettedPrevious?previous:null,e,provider.stream,claim.attempts);
   if(transportMode==='json'&&jobTransport!=='json')console.warn('HHBA_V4_INDEPENDENT_JOB_SSE_FALLBACK_NEXT_STEP',JSON.stringify({lane}));
   if(snapshot&&!leaseLost&&await renewV4JobWork(db,claim,{leaseMs:300000})){
    await saveMatchTask(env,resultKey,{kind:'V4_INDEPENDENT_JOB_V1',generation,lane,revision:claim.revision,
     job_key:claim.job_key,source_url:url,seed_source:source,seed_score:activeScore,
     ...(transportMode==='json'?{transport_mode:'json'}:{}),checkpoint:snapshot,phaseReplay:replay.snapshot(),complete:false});
   }
   retryError=errorCode(e);
   if(retryError==='AI_PHASE_RESOURCE_YIELD')console.warn('HHBA_V4_INDEPENDENT_JOB_BUDGET_YIELD',JSON.stringify({lane,resource:e?.resource_kind||'unknown',budget:budget.snapshot()}));
   return {status:'RETRY',error:retryError};
  }
  const snapshot=run.status==='CONTINUE'?run.checkpoint:run.resume_checkpoint||recovery();
  const result=jobFromCheckpoint(snapshot,url,source)||run.matches?.find(x=>itemUrl(x)===url)||null;
  done=lane==='verification'?!!result&&(snapshot?.phase==='reporting'||run.status==='COMPLETE'):
   !!result&&doneReport(result);
  await assertSessionTaskActive(env,session,task.id,generation);
  // The active session plus exact D1 lease authorize tentative job storage.
  // The authoritative master snapshot is verified later by both merge and
  // browser delta readers; a stale sidecar can never become deliverable JD.
  // Avoid decrypting a 500-job master checkpoint again after the AI call.
  if(leaseLost||!await renewV4JobWork(db,claim,{leaseMs:300000}))throw Object.assign(Error('AI_CHECKPOINT_LEASE_LOST'),{code:'AI_CHECKPOINT_LEASE_LOST'});
  await saveMatchTask(env,resultKey,{kind:'V4_INDEPENDENT_JOB_V1',generation,lane,revision:claim.revision,
   job_key:claim.job_key,checkpoint:snapshot,phaseReplay:replay.snapshot(),job:result,complete:done,source_url:url,seed_source:source,seed_score:activeScore,
   ...(jobTransport==='json'?{transport_mode:'json'}:{})});
  await finishV4JobWork(db,claim,{completed:done,continued:!done});
  return {status:done?'DONE':'CONTINUE',lane,
   ...(done?{evidence:{verified_jd:lane==='verification'&&result?.jd_source_status==='VERIFIED_JD',
     scored:lane==='verification'&&Number.isInteger(result?.match_score),
     report:lane==='reporting'&&qualifiedReport(result)}}:{})};
 }catch(e){
  retryError=errorCode(e);return {status:'RETRY',error:retryError};
 }finally{
  if(heartbeat)clearInterval(heartbeat);
  if(!done)await finishV4JobWork(db,claim,{completed:false,error:retryError}).catch(()=>{});
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
 const byKey=new Map(),locator=await v4VerifiedJobLocator(checkpoint,taskKey);
 const scoredByUrl=new Map();
 for(const scored of [...(checkpoint.priorState?.matches||[]),...(checkpoint.matches||[])]){
  const url=itemUrl(scored);if(url&&!scoredByUrl.has(url))scoredByUrl.set(url,scored);
 }
 for(let i=0;i<checkpoint.rows.length;i++){
  const [url,job]=checkpoint.rows[i];
  if(typeof url!=='string'||!job)continue;
  const scored=scoredByUrl.get(url),rr=reportWorkRevision(job,scored);
  const key=locator?.[i]||await workKey(taskKey,url);
  byKey.set(key,{url,job,revision:await revKey(candidateRevision(job)),reportRevision:rr?await revKey(rr):null});
 }
 let next=null;
 const done=new Set(checkpoint.processedEarlier||[]),revisions=new Map(checkpoint.processedEvidence||[]);
 let count=0;
 for(const record of entries){
  const current=byKey.get(record.job_key);
  if(!current||(record.lane==='reporting'?current.reportRevision:current.revision)!==record.revision)continue;
  if(record.lane==='verification'&&done.has(current.url)&&revisions.get(current.url)===candidateRevision(current.job))continue;
  // The encrypted locator is an optimization hint, not authorization:
  // re-check the actual candidate URL against the D1 claim before merging.
  if(await workKey(taskKey,current.url)!==record.job_key)continue;
  const resultKey=await independentJobKey(taskKey,generation,record.lane,record.job_key,record.revision);
  const saved=await read(env,resultKey);
  if(saved?.kind!=='V4_INDEPENDENT_JOB_V1'||!saved.complete||saved.generation!==generation||saved.revision!==record.revision||saved.source_url!==current.url||!saved.job)continue;
  if(record.lane==='reporting'&&!doneReport(saved.job))continue;
  const available=(next||checkpoint);
  const existingMatches=(available.phase==='research'?available.priorState?.matches:available.matches)||[];
  const present=existingMatches.findIndex(x=>itemUrl(x)===current.url);
  if(record.lane==='verification'&&present>=0&&suitableScore(existingMatches[present]))continue;
  if(record.lane==='reporting'&&present<0)continue;
  if(record.lane==='reporting'&&doneReport(existingMatches[present]))continue;
  // Most resume phases have no new independent evidence. Clone the large
  // checkpoint only after a revision-fenced, not-yet-applied result exists.
  if(!next)next=structuredClone(checkpoint);
  const parent=next.phase==='research'?(next.priorState||(next.priorState={matches:[],read:0,scored:0,archived:0,scoreFailures:0,reportFailures:0})):next;
  const matches=parent.matches||(parent.matches=[]);
  const idx=matches.findIndex(x=>itemUrl(x)===current.url);
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
 return {checkpoint:next||checkpoint,count};
}
