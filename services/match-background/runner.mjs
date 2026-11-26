import {validStageLane} from './stages.mjs';
// Independent driver. Only sanitized control status and error codes are
// persisted by the workflow; resumes, provider replies and tickets stay private.
const safeCode=(v,fallback)=>typeof v==='string'&&/^(?:AI_[A-Z0-9_]{3,90}|BACKGROUND_[A-Z0-9_]{3,90})$/.test(v)?v:fallback;
const retry=code=>Object.assign(Error('BACKGROUND_PHASE_RETRY:'+code),{code});
const retryCode=e=>safeCode(e?.code||String(e?.message||'').match(/^BACKGROUND_PHASE_RETRY:([A-Z0-9_]+)$/)?.[1],'AI_BACKGROUND_TRANSPORT_INTERRUPTED');
const stopCodes=new Set(['AI_AGENT_CANCELLED','AI_BACKGROUND_TICKET_INVALID','AI_CHECKPOINT_EXPIRED']);
const permanentCodes=new Set(['AI_PROVIDER_KEY_REJECTED','AI_PROVIDER_BALANCE_INSUFFICIENT','AI_PROVIDER_NOT_CONFIGURED','AI_PROVIDER_UNSUPPORTED','AI_PROVIDER_REQUEST_REJECTED','AI_PROVIDER_REDIRECT_BLOCKED','AI_BACKGROUND_REQUEST_INVALID','AI_BACKGROUND_REDIRECT_BLOCKED','AI_CHECKPOINT_INVALID','AI_BACKGROUND_TASK_PAUSED','AI_CHECKPOINT_ALREADY_USED']);
const recoverableCodes=new Set(['AI_PHASE_RESOURCE_YIELD','AI_PIPELINE_STATE_INVALID','AI_BACKGROUND_EXECUTION_FAILED','AI_BACKGROUND_HTTP_408','AI_BACKGROUND_HTTP_425','AI_PROVIDER_NETWORK_ERROR','AI_PROVIDER_UPSTREAM_ERROR','AI_PROVIDER_TIMEOUT','AI_PROVIDER_RATE_LIMITED','AI_PROVIDER_UNAVAILABLE','AI_PROVIDER_RESPONSE_INVALID','AI_PROVIDER_RESPONSE_EMPTY','AI_PROVIDER_INCOMPLETE','AI_CHECKPOINT_DB_UNAVAILABLE','AI_CHECKPOINT_LEASE_LOST','AI_CHECKPOINT_STORAGE_UNAVAILABLE','AI_BACKGROUND_SCHEDULE_UNAVAILABLE','AI_EDGE_RESOURCE_EXHAUSTED','AI_EDGE_DAILY_LIMIT','AI_BACKGROUND_RESPONSE_INVALID','AI_BACKGROUND_TRANSPORT_INTERRUPTED','AI_BACKGROUND_RESPONSE_INCOMPLETE','AI_TASK_IN_PROGRESS']);
const pending=(error)=>({status:'RECOVERING',error});
export function recoveryDelaySeconds(code,streak=1){
 // A lease is released by its owner or expires after a few minutes. Do not
 // turn temporary ownership contention into a half-hour research delay.
 if(code==='AI_TASK_IN_PROGRESS')return Math.min(60,15*Math.max(1,streak));
 const ordinary=[15,30,60,120,300,600,1800][Math.min(6,Math.max(0,streak-1))];
 const minimum=code==='AI_EDGE_DAILY_LIMIT'?3600:code==='AI_EDGE_RESOURCE_EXHAUSTED'?180:code==='AI_PROVIDER_RATE_LIMITED'?60:15;
 return Math.max(minimum,ordinary);
}
export async function requestPhase(fetcher,ticket,{diagnostic=false,recovery,lane}={}){
 const terminal=(status,error)=>diagnostic?{status,...(error?{error}: {})}:status;
 let response;
 try{response=await fetcher('https://hhba.work/api/match-v4/background-step',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket,...(recovery&&recoverableCodes.has(recovery)?{recovery}:{}),...(validStageLane(lane)?{lane}:{})})});}
 catch(e){if(e instanceof TypeError&&/invalid redirect|invalid url|invalid header/i.test(e.message))return terminal('FAILED','AI_BACKGROUND_REQUEST_INVALID');throw retry('AI_BACKGROUND_TRANSPORT_INTERRUPTED');}
 if(response.status>=300&&response.status<400){await response.body?.cancel().catch(()=>{});return terminal('FAILED','AI_BACKGROUND_REDIRECT_BLOCKED');}
 if(!response.ok){
  let raw='';try{raw=await response.text();}catch{}
  let body={};try{body=JSON.parse(raw)||{};}catch{}
  const code=safeCode(body.error,/\b1102\b|exceededResources|worker exceeded resource/i.test(raw)?'AI_EDGE_RESOURCE_EXHAUSTED':/\b1027\b/i.test(raw)?'AI_EDGE_DAILY_LIMIT':'AI_BACKGROUND_HTTP_'+response.status);
  if(stopCodes.has(code))return terminal('STOP',code);
  if(permanentCodes.has(code))return terminal('FAILED',code);
  if(recoverableCodes.has(code)||response.status===408||response.status===425||response.status===429||response.status>=500)throw retry(code);
  return terminal('FAILED',code);
 }
 let text;try{text=await response.text();}catch{throw retry('AI_BACKGROUND_TRANSPORT_INTERRUPTED');}
 for(const event of text.replace(/\r\n/g,'\n').split('\n\n')){
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
  if(value?.status==='HANDOFF')return terminal('HANDOFF');
   if(value?.status==='CONTINUE')return value?.fallback===true&&diagnostic?{status:'CONTINUE',fallback:true}:terminal('CONTINUE');
 }
 throw retry('AI_BACKGROUND_RESPONSE_INCOMPLETE');
}
// Rotate before the free Workflow step ceiling; the Pages checkpoint, not
// the Workflow step history, is authoritative. This is not a task-wide cap.
export async function driveBackgroundMatch(step,ticket,fetcher,{maxSteps=400,lane}={}){
 let streak=0,recovery,currentLane=validStageLane(lane)?lane:null;
 // A sleeping stage consumes no new AI requests or repeated polling steps.
 // Cloudflare buffers an event even if it arrives before waitForEvent.
 if(currentLane&&currentLane!=='discovery'){
  const wake=await step.waitForEvent('initial-'+currentLane,{type:'wake_'+currentLane,timeout:'24 hours'});
  if(wake?.done||wake?.payload?.done)return {status:'COMPLETE'};
 }
 for(let phase=0;phase<maxSteps;phase++){
  let state;
  try{
   state=await step.do('resume-research-phase-'+phase,{retries:{limit:5,delay:'15 seconds',backoff:'exponential'},timeout:'30 minutes'},async()=>{
    try{return await requestPhase(fetcher,ticket,{diagnostic:true,recovery,lane:currentLane});}
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
  if(result?.status==='CONTINUE'){
    if(result.fallback===true)currentLane=null;
    streak=0;recovery=undefined;continue;
   }
   if(result?.status==='HANDOFF'){
    if(!currentLane){streak=0;continue;}
    const wake=await step.waitForEvent('next-'+currentLane+'-'+phase,{type:'wake_'+currentLane,timeout:'24 hours'});
    if(wake?.done||wake?.payload?.done)return {status:'COMPLETE'};
    streak=0;recovery=undefined;continue;
   }
  if(['COMPLETE','STOP','FAILED'].includes(result?.status))return result;
  const error=safeCode(result?.error,'AI_BACKGROUND_RESPONSE_INVALID');
  recovery=error;
  const seconds=recoveryDelaySeconds(error,++streak);
  console.info('HHBA_MATCH_RECOVERY_SCHEDULED',JSON.stringify({phase,error,streak,seconds}));
  // Durable sleep releases the execution slot. On wake, Pages re-checks
  // session authorization and acquires the same exclusive research lease.
  await step.sleep('recover-research-phase-'+phase,seconds);
 }
 return pending('AI_BACKGROUND_WORKFLOW_ROLLOVER');
}

// The scheduler never restarts a Workflow from an ordinary browser poll.
// A registered watchdog owns restarts, including planned step-limit rollover.
const recoverableInstance=state=>state?.status==='errored'||(state?.status==='complete'&&(state.output?.status==='RECOVERING'||state.output?.status==='FAILED'&&(!state.output?.error||recoverableCodes.has(state.output.error))));
export async function scheduleWorkflowInstance(workflow,instance,ticket,{diagnostic=false,lane}={}){
 try{await workflow.create({id:instance,params:{ticket,...(validStageLane(lane)?{lane}:{})}});return true;}
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
