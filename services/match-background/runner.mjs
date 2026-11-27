import {validStageLane} from './stages.mjs';
// Independent driver. Only sanitized control status and error codes are
// persisted by the workflow; resumes, provider replies and tickets stay private.
const safeCode=(v,fallback)=>typeof v==='string'&&/^(?:AI_[A-Z0-9_]{3,90}|BACKGROUND_[A-Z0-9_]{3,90})$/.test(v)?v:fallback;
const retry=code=>Object.assign(Error('BACKGROUND_PHASE_RETRY:'+code),{code});
const retryCode=e=>safeCode(e?.code||String(e?.message||'').match(/^BACKGROUND_PHASE_RETRY:([A-Z0-9_]+)$/)?.[1],'AI_BACKGROUND_TRANSPORT_INTERRUPTED');
const stopCodes=new Set(['AI_AGENT_CANCELLED','AI_TASK_USER_CANCELLED','AI_AUTH_SESSION_EXPIRED','AI_TASK_SUPERSEDED','AI_TASK_CLOSED','AI_TASK_NOT_ACTIVE','AI_BACKGROUND_TICKET_INVALID','AI_CHECKPOINT_EXPIRED']);
const permanentCodes=new Set(['AI_PROVIDER_KEY_REJECTED','AI_PROVIDER_BALANCE_INSUFFICIENT','AI_PROVIDER_NOT_CONFIGURED','AI_PROVIDER_UNSUPPORTED','AI_PROVIDER_REQUEST_REJECTED','AI_PROVIDER_REDIRECT_BLOCKED','AI_BACKGROUND_REQUEST_INVALID','AI_BACKGROUND_REDIRECT_BLOCKED','AI_CHECKPOINT_INVALID','AI_BACKGROUND_TASK_PAUSED','AI_CHECKPOINT_ALREADY_USED']);
const recoverableCodes=new Set(['AI_PHASE_RESOURCE_YIELD','AI_PIPELINE_STATE_INVALID','AI_BACKGROUND_EXECUTION_FAILED','AI_BACKGROUND_HTTP_408','AI_BACKGROUND_HTTP_425','AI_PROVIDER_NETWORK_ERROR','AI_PROVIDER_UPSTREAM_ERROR','AI_PROVIDER_TIMEOUT','AI_PROVIDER_RATE_LIMITED','AI_PROVIDER_UNAVAILABLE','AI_PROVIDER_RESPONSE_INVALID','AI_PROVIDER_RESPONSE_EMPTY','AI_PROVIDER_INCOMPLETE','AI_CHECKPOINT_DB_UNAVAILABLE','AI_CHECKPOINT_LEASE_LOST','AI_CHECKPOINT_STORAGE_UNAVAILABLE','AI_BACKGROUND_SCHEDULE_UNAVAILABLE','AI_EDGE_RESOURCE_EXHAUSTED','AI_EDGE_DAILY_LIMIT','AI_BACKGROUND_RESPONSE_INVALID','AI_BACKGROUND_TRANSPORT_INTERRUPTED','AI_BACKGROUND_RESPONSE_INCOMPLETE','AI_TASK_IN_PROGRESS']);
const pending=(error)=>({status:'RECOVERING',error});
export function recoveryDelaySeconds(code,streak=1){
 // A lease is released by its owner or expires after a few minutes. Do not
 // turn temporary ownership contention into a half-hour research delay.
 if(code==='AI_TASK_IN_PROGRESS')return Math.min(60,15*Math.max(1,streak));
 // Transient network, provider or Cloudflare resource trouble must not park
 // the matching workflow for a half hour. The sleep is durable and does not
 // consume paid AI calls while waiting; there is no task-wide attempt cap.
 const ordinary=[15,30,60,120,300,600,1800][Math.min(6,Math.max(0,streak-1))];
 if(code==='AI_EDGE_DAILY_LIMIT')return 3600;
 if(code==='AI_PROVIDER_RATE_LIMITED')return Math.min(600,Math.max(60,ordinary));
 if(code==='AI_EDGE_RESOURCE_EXHAUSTED')return Math.min(300,Math.max(180,ordinary));
 return Math.min(300,ordinary);
}
export async function requestPhase(fetcher,ticket,{diagnostic=false,recovery,lane,stagedFallback=false}={}){
 const terminal=(status,error)=>diagnostic?{status,...(error?{error}: {})}:status;
 let response;
 try{response=await fetcher('https://hhba.work/api/match-v4/background-step',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket,...(recovery&&recoverableCodes.has(recovery)?{recovery}:{}),...(validStageLane(lane)?{lane}:{}),...(stagedFallback===true?{staged_fallback:true}:{})})});}
 catch(e){if(e instanceof TypeError&&/invalid redirect|invalid url|invalid header/i.test(e.message))return terminal('FAILED','AI_BACKGROUND_REQUEST_INVALID');throw retry('AI_BACKGROUND_TRANSPORT_INTERRUPTED');}
 if(response.status>=300&&response.status<400){await response.body?.cancel().catch(()=>{});return terminal('FAILED','AI_BACKGROUND_REDIRECT_BLOCKED');}
 if(!response.ok){
  let raw='';try{raw=await response.text();}catch{}
  let body={};try{body=JSON.parse(raw)||{};}catch{}
  const code=safeCode(body.error,/\b1102\b|exceededResources|worker exceeded resource/i.test(raw)?'AI_EDGE_RESOURCE_EXHAUSTED':/\b1027\b/i.test(raw)?'AI_EDGE_DAILY_LIMIT':'AI_BACKGROUND_HTTP_'+response.status);
  if(stopCodes.has(code))return terminal('STOP',code);
  if(permanentCodes.has(code))return terminal('FAILED',code);
  if(code==='AI_TASK_IN_PROGRESS'&&diagnostic){
   const delay=Number(body.retry_after_seconds),lease=body.lease_state;
   return {status:'RECOVERING',error:code,...(Number.isSafeInteger(delay)&&delay>=3&&delay<=60?{retry_after_seconds:delay}:{}),...(['ACTIVE','EXPIRED','FREE'].includes(lease)?{lease_state:lease}:{})};
  }
  if(recoverableCodes.has(code)||response.status===408||response.status===425||response.status===429||response.status>=500)throw retry(code);
  return terminal('FAILED',code);
 }
 // Consume SSE incrementally: a committed terminal event is authoritative even
 // if the connection subsequently drops during metrics or cleanup.
 const reader=response.body?.getReader();if(!reader)throw retry('AI_BACKGROUND_RESPONSE_INCOMPLETE');
 const decoder=new TextDecoder();let buffer='';
 try{while(true){
  let chunk;try{chunk=await reader.read();}catch{throw retry('AI_BACKGROUND_TRANSPORT_INTERRUPTED');}
  buffer+=(chunk.done?decoder.decode():decoder.decode(chunk.value,{stream:true}));
  buffer=buffer.replace(/\r\n/g,'\n');
  const frames=buffer.split('\n\n');buffer=frames.pop()||'';
  if(chunk.done&&buffer.trim())frames.push(buffer);
  for(const event of frames){
  const kind=event.split('\n').find(x=>x.startsWith('event: '))?.slice(7);
  if(kind!=='complete'&&kind!=='failure')continue;
  const line=event.split('\n').find(x=>x.startsWith('data: '));
  if(!line)continue;
  let value;try{value=JSON.parse(line.slice(6));}catch{throw retry('AI_BACKGROUND_RESPONSE_INVALID');}
  if(kind==='failure'){
   const code=safeCode(value?.error,'AI_BACKGROUND_EXECUTION_FAILED');
   if(stopCodes.has(code))return terminal('STOP',code);
   if(permanentCodes.has(code))return terminal('FAILED',code);
   if(value?.retryable||recoverableCodes.has(code))throw retry(code);
   return terminal('FAILED',code);
  }
  if(value?.status==='COMPLETE')return terminal('COMPLETE');
  if(value?.status==='HANDOFF')return diagnostic&&validStageLane(value.next_lane)?{status:'HANDOFF',next_lane:value.next_lane}:terminal('HANDOFF');
   if(value?.status==='CONTINUE'&&value?.waiting_for_jobs===true)return terminal('WAIT_JOBS');
   if(value?.status==='CONTINUE')return value?.fallback===true&&diagnostic?{status:'CONTINUE',fallback:true}:terminal('CONTINUE');
  }
  if(chunk.done)break;
 }}finally{try{reader.releaseLock();}catch{}}
 throw retry('AI_BACKGROUND_RESPONSE_INCOMPLETE');
}
// Each job-step is a distinct Pages invocation with its own resource budget,
// encrypted continuation and revision-fenced D1 lease. The Workflow carries
// only an opaque ticket; no CV, job URL or model response leaves Pages.
export async function requestIndependentJobPhase(fetcher,ticket,lane){
 if(!['verification','reporting'].includes(lane))return {status:'INVALID'};
 try{
  const response=await fetcher('https://hhba.work/api/match-v4/background-job-step',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket,lane})});
  if(!response.ok){
   const body=await response.json().catch(()=>null),code=safeCode(body?.error,'AI_BACKGROUND_EXECUTION_FAILED');
   if(stopCodes.has(code))return {status:'STOP',error:code};
   if(permanentCodes.has(code))return {status:'FAILED',error:code};
   return {status:'DEFERRED'};
  }
  const data=await response.json().catch(()=>null);
  return {status:['DONE','CONTINUE','EMPTY','RETRY','STALE','DISABLED','FINISHED'].includes(data?.status)?data.status:'DEFERRED'};
 }catch{return {status:'DEFERRED'};}
}
// Dedicated verification and reporting Workflows MUST NEVER call
// /background-step: it holds the discovery/master-checkpoint D1 lease.
// They consume only revision-fenced per-job reservations, so a long AI
// discovery call cannot block JD verification and neither side steals a lease.
export async function driveIndependentJobLane(step,ticket,fetcher,{lane,maxSteps=400}={}){
 if(!['verification','reporting'].includes(lane))return {status:'FAILED',error:'AI_BACKGROUND_REQUEST_INVALID'};
 for(let phase=0;phase<maxSteps;phase++){
  let state;
  try{
   state=await step.do('independent-'+lane+'-'+phase,{retries:{limit:5,delay:'15 seconds',backoff:'exponential'},timeout:'30 minutes'},async()=>{
    const responses=await Promise.allSettled([requestIndependentJobPhase(fetcher,ticket,lane),requestIndependentJobPhase(fetcher,ticket,lane)]);
    const values=responses.map(x=>x.status==='fulfilled'?x.value:{status:'DEFERRED'});
    const stopping=values.find(x=>x.status==='STOP'||x.status==='FAILED');
    if(stopping)return stopping;
    if(values.some(x=>x.status==='FINISHED'))return {status:'COMPLETE'};
    const completed=values.filter(x=>x.status==='DONE').length;
    if(completed)console.info('HHBA_V4_INDEPENDENT_JOB_COMPLETED',JSON.stringify({count:completed,lane}));
    if(values.some(x=>x.status==='DONE'||x.status==='CONTINUE'))return {status:'CONTINUE'};
    if(values.every(x=>x.status==='DISABLED'))return {status:'FAILED',error:'AI_JOB_EXECUTOR_DISABLED'};
    if(values.some(x=>x.status==='RETRY'||x.status==='DEFERRED'))return {status:'RETRY'};
    return {status:'IDLE'};
   });
  }catch(e){
   const error=retryCode(e);
   console.warn('HHBA_V4_INDEPENDENT_LANE_RECOVERY',JSON.stringify({lane,phase,error}));
   state={status:'RETRY'};
  }
  if(state?.status==='COMPLETE'||state?.status==='STOP'||state?.status==='FAILED')return state;
  if(state?.status==='CONTINUE')continue;
  // Empty or cooled-down job queues are not terminal. The next discovery
  // checkpoint can enqueue more rows, so sleep durably and re-check the same
  // authenticated ticket without any new main research invocation.
  await step.sleep('independent-'+lane+'-idle-'+phase,state?.status==='RETRY'?'45 seconds':'30 seconds');
 }
 return pending('AI_BACKGROUND_WORKFLOW_ROLLOVER');
}

// Rotate before the free Workflow step ceiling; the Pages checkpoint, not
// the Workflow step history, is authoritative. This is not a task-wide cap.
export async function driveBackgroundMatch(step,ticket,fetcher,{maxSteps=400,lane,jobsEnabled=false}={}){
 let streak=0,recovery,currentLane=validStageLane(lane)?lane:null,stagedOrigin=validStageLane(lane);
 // A sleeping stage consumes no new AI requests or repeated polling steps.
 // Cloudflare buffers an event even if it arrives before waitForEvent.
 if(currentLane&&currentLane!=='discovery'){
  const wake=await step.waitForEvent('initial-'+currentLane,{type:'wake_'+currentLane,timeout:'24 hours'});
  if(wake?.done||wake?.payload?.done)return {status:'COMPLETE'};
  if(jobsEnabled)return driveIndependentJobLane(step,ticket,fetcher,{lane:currentLane,maxSteps});
 }
 for(let phase=0;phase<maxSteps;phase++){
  let state;
  try{
   state=await step.do('resume-research-phase-'+phase,{retries:{limit:5,delay:'15 seconds',backoff:'exponential'},timeout:'30 minutes'},async()=>{
    try{
     const primary=requestPhase(fetcher,ticket,{diagnostic:true,recovery,lane:currentLane,stagedFallback:stagedOrigin&&!currentLane});
     // A staged discovery worker must not await expensive JD invocations.
     // Verification has its own durable Workflow, awakened as soon as the
     // first encrypted candidate checkpoint is queued. Legacy single-driver
     // mode still fans out work here for backward compatibility.
     if(!jobsEnabled||currentLane==='discovery')return await primary;
     // Keep the primary discovery phase moving. Large parallel Pages/model
     // bursts risk exhausting a Cloudflare Free invocation and delaying the
     // workflow even when its own research step has already finished. Spread
     // the *same queued jobs* across future durable phases (no task/job cap).
     const jobs=currentLane==='reporting'?['reporting','reporting']:
      currentLane==='verification'?['verification','reporting']:
      phase%3===2?['verification','reporting']:['verification','verification'];
     const result=await Promise.allSettled([primary,...jobs.map(name=>requestIndependentJobPhase(fetcher,ticket,name))]);
     const main=result[0];
     if(main.status==='rejected')throw main.reason;
     const completed=result.slice(1).filter(x=>x.status==='fulfilled'&&x.value.status==='DONE').length;
     if(completed)console.info('HHBA_V4_INDEPENDENT_JOB_COMPLETED',JSON.stringify({count:completed}));
     return main.value;
    }
    catch(e){
     const error=retryCode(e);
     // Expected transport/host/provider failure is a durable recovery outcome,
     // NOT a terminal Workflow failure or a discarded research task.
     console.warn('HHBA_MATCH_RECOVERY_WAIT',JSON.stringify({phase,error}));
     return pending(error);
    }
   });
  }catch(e){
   // Actual Workflow/runtime failure leaves an errored instance for the
   // registered watchdog. Never turn it into a terminal successful instance.
   const error=retryCode(e);console.warn('HHBA_MATCH_WORKFLOW_INTERRUPTED',JSON.stringify({phase,error}));throw retry(error);
  }
  const result=typeof state==='string'?{status:state}:state;
  if(result?.status==='WAIT_JOBS'){
    // Independent job invocations were already dispatched during this
    // phase. Sleep durably rather than hot-looping on the same R2 checkpoint.
    // There is no cap on jobs or total research rounds.
    streak=0;recovery=undefined;
    await step.sleep('wait-independent-jobs-'+phase,'30 seconds');
    continue;
   }
  if(result?.status==='CONTINUE'){
    if(result.fallback===true)currentLane=null;
    streak=0;recovery=undefined;continue;
   }
   if(result?.status==='HANDOFF'){
    if(currentLane==='verification'&&jobsEnabled&&result.next_lane==='discovery'){
     // Verification is allowed to research already queued JDs before the
     // discovery stage finishes. Never take over its main checkpoint lease.
     // The two revision-fenced job calls above are independent and persisted.
     await step.sleep('early-verification-'+phase,'30 seconds');
     streak=0;recovery=undefined;continue;
    }
    if(!currentLane){streak=0;continue;}
    const wake=await step.waitForEvent('next-'+currentLane+'-'+phase,{type:'wake_'+currentLane,timeout:'24 hours'});
    if(wake?.done||wake?.payload?.done)return {status:'COMPLETE'};
    streak=0;recovery=undefined;continue;
   }
  if(['COMPLETE','STOP','FAILED'].includes(result?.status))return result;
  const error=safeCode(result?.error,'AI_BACKGROUND_RESPONSE_INVALID');
  recovery=error;
  const ordinaryDelay=recoveryDelaySeconds(error,++streak);
  const seconds=error==='AI_TASK_IN_PROGRESS'&&Number.isSafeInteger(result?.retry_after_seconds)?Math.max(3,Math.min(60,result.retry_after_seconds)):ordinaryDelay;
  console.info('HHBA_MATCH_RECOVERY_SCHEDULED',JSON.stringify({phase,error,streak,seconds,...(result?.lease_state?{lease_state:result.lease_state}:{})}));
  // Durable sleep releases the execution slot. On wake, Pages re-checks
  // session authorization and acquires the same exclusive research lease.
  // Cloudflare WorkflowStep.sleep(number) interprets numbers as MILLISECONDS,
  // while recoveryDelaySeconds deliberately computes SECONDS. An old 1800
  // second backoff became a 1.8 second busy loop and exhausted recovery steps.
  // Use the explicit duration string to preserve the intended pacing.
  await step.sleep('recover-research-phase-'+phase,seconds+' seconds');
 }
 return pending('AI_BACKGROUND_WORKFLOW_ROLLOVER');
}

// The registered watchdog remains the primary recovery authority. An
// explicitly authorized task request may also claim a due restart atomically,
// so an interrupted research task need not wait for a scheduled cron tick.
const recoverableInstance=state=>state?.status==='errored'||(state?.status==='complete'&&(state.output?.status==='RECOVERING'||state.output?.status==='FAILED'&&(!state.output?.error||recoverableCodes.has(state.output.error))));
export async function scheduleWorkflowInstance(workflow,instance,ticket,{diagnostic=false,lane,jobsEnabled=false}={}){
 try{await workflow.create({id:instance,params:{ticket,...(validStageLane(lane)?{lane}:{}),...(jobsEnabled?{jobsEnabled:true}:{})}});return true;}
 catch(e){if(!(e instanceof Error)||!e.message.includes('(instance.already_exists)'))throw e;}
 const existing=await workflow.get(instance),current=await existing.status();
 if(current?.status==='waiting'||recoverableInstance(current)){
  const error=safeCode(current?.output?.error,current?.output?.status==='FAILED'?'AI_BACKGROUND_EXECUTION_FAILED':'AI_BACKGROUND_RECOVERING');
  return diagnostic?pending(error):true;
 }
 return ['queued','running'].includes(current?.status);
}

 // Registry stores only opaque workflow instance IDs, not tickets, CVs,
 // applicant identities or session tokens. Restart uses the original workflow
 // parameters and Pages independently checks the active authorization.
// A due recoverable instance may be restarted when a Pages-authorized task
// asks to resume. The same D1 compare-and-set as the cron watchdog fences
// concurrent callers; Workflow itself never decides task authorization.
export async function restartRecoveredWorkflowOnAuthorizedStart(db,workflow,id,{now=Date.now()}={}){
 if(!db?.prepare||!workflow||! /^[a-f0-9]{64}$/.test(id))return false;
 try{
  const instance=await workflow.get(id),state=await instance.status();
  if(!recoverableInstance(state)||typeof instance.restart!=='function')return false;
  const claim=await db.prepare('UPDATE match_watchdog_instances SET next_check=? WHERE instance_id=? AND next_check<=? AND expires_at>?')
   .bind(now+5*60000,id,now,now).run();
  if(claim?.meta?.changes!==1)return false;
  await instance.restart();
  console.info('HHBA_MATCH_AUTHORIZED_WORKFLOW_RESUME',JSON.stringify({state:state.status}));
  return true;
 }catch{console.warn('HHBA_MATCH_AUTHORIZED_WORKFLOW_RESUME_DEFERRED');return false;}
}
export async function registerWatchdogInstance(db,instance,now=Date.now()){
 if(!db||! /^[a-f0-9]{64}$/.test(instance))return;
 const registered=await db.prepare('INSERT INTO match_watchdog_instances (instance_id,next_check,expires_at) VALUES (?,?,?) ON CONFLICT(instance_id) DO UPDATE SET expires_at=excluded.expires_at').bind(instance,now,now+24*3600000).run();
 if(registered?.success!==true)throw Error('AI_BACKGROUND_WATCHDOG_UNAVAILABLE');
}
export async function inspectWatchdogInstances(db,workflow,{now=Date.now(),batch=8}={}){
 if(!db||!workflow)return {checked:0,restarted:0};
 // Fair, due-time pagination. A subsequent cron pass handles remaining rows.
 const result=await db.prepare('SELECT instance_id,expires_at FROM match_watchdog_instances WHERE next_check<=? ORDER BY next_check,instance_id LIMIT ?').bind(now,batch).all();
 let checked=0,restarted=0;
 for(const row of result.results||[]){
  const id=row.instance_id;checked++;
  if(!/^[a-f0-9]{64}$/.test(id)){await db.prepare('DELETE FROM match_watchdog_instances WHERE instance_id=?').bind(id).run();continue;}
  if(row.expires_at<=now){await db.prepare('DELETE FROM match_watchdog_instances WHERE instance_id=? AND expires_at<=?').bind(id,now).run();continue;}
  // Atomically claim the due check before attempting restart. A concurrent
  // cron or manual watchdog invocation cannot start another recovery.
  const claim=await db.prepare('UPDATE match_watchdog_instances SET next_check=? WHERE instance_id=? AND next_check<=? AND expires_at>?').bind(now+5*60000,id,now,now).run();
  if(claim?.meta?.changes!==1)continue;
  try{
   const instance=await workflow.get(id),state=await instance.status();
   if(recoverableInstance(state)){
    if(typeof instance.restart==='function'){await instance.restart();restarted++;}
   }else if(['complete','terminated','paused'].includes(state?.status)){
    await db.prepare('DELETE FROM match_watchdog_instances WHERE instance_id=?').bind(id).run();continue;
   }
  }catch{/* a temporary platform failure must not discard an authorized instance */}

 }
 return {checked,restarted};
}
