// Independent driver. Only sanitized control status and error codes are
// persisted by the workflow; resumes, provider replies and tickets stay private.
const safeCode=(v,fallback)=>typeof v==='string'&&/^(?:AI_[A-Z0-9_]{3,90}|BACKGROUND_[A-Z0-9_]{3,90})$/.test(v)?v:fallback;
const retry=code=>Object.assign(Error('BACKGROUND_PHASE_RETRY:'+code),{code});
const retryCode=e=>safeCode(e?.code||String(e?.message||'').match(/^BACKGROUND_PHASE_RETRY:([A-Z0-9_]+)$/)?.[1],'AI_BACKGROUND_TRANSPORT_INTERRUPTED');
export async function requestPhase(fetcher,ticket,{diagnostic=false}={}){
 const terminal=(status,error)=>diagnostic?{status,...(error?{error}: {})}:status;
 let response;
 try{response=await fetcher('https://hhba.work/api/match-v4/background-step',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket})});}
 catch(e){if(e instanceof TypeError&&/invalid redirect|invalid url|invalid header/i.test(e.message))return terminal('FAILED','AI_BACKGROUND_REQUEST_INVALID');throw retry('AI_BACKGROUND_TRANSPORT_INTERRUPTED');}
 if(response.status>=300&&response.status<400){await response.body?.cancel().catch(()=>{});return terminal('FAILED','AI_BACKGROUND_REDIRECT_BLOCKED');}
 if(!response.ok){
  let raw='';try{raw=await response.text();}catch{}
  let body={};try{body=JSON.parse(raw)||{};}catch{}
  const code=safeCode(body.error,/\b1102\b|exceededResources|worker exceeded resource/i.test(raw)?'AI_EDGE_RESOURCE_EXHAUSTED':/\b1027\b/i.test(raw)?'AI_EDGE_DAILY_LIMIT':'AI_BACKGROUND_HTTP_'+response.status);
  if(['AI_AGENT_CANCELLED','AI_BACKGROUND_TICKET_INVALID','AI_CHECKPOINT_EXPIRED'].includes(code))return terminal('STOP');
  if((response.status===409&&code==='AI_TASK_IN_PROGRESS')||response.status===429||response.status>=500)throw retry(code);
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
   if(code==='AI_AGENT_CANCELLED')return terminal('STOP');
   if(value?.retryable)throw retry(code);
   return terminal('FAILED',code);
  }
  if(value?.status==='COMPLETE')return terminal('COMPLETE');
  if(value?.status==='CONTINUE')return terminal('CONTINUE');
 }
 throw retry('AI_BACKGROUND_RESPONSE_INCOMPLETE');
}
export async function driveBackgroundMatch(step,ticket,fetcher){
 for(let phase=0;;phase++){
  // A cooperative resource yield is CONTINUE, not a failed attempt. Only
  // real transport/provider failures consume this workflow retry budget.
  let state;
  try{
   state=await step.do('resume-research-phase-'+phase,{retries:{limit:5,delay:'15 seconds',backoff:'exponential'},timeout:'30 minutes'},async()=>{
    try{return await requestPhase(fetcher,ticket,{diagnostic:true});}
    catch(e){console.warn('HHBA_MATCH_PHASE_RETRY',JSON.stringify({phase,error:retryCode(e)}));throw e;}
   });
  }catch(e){const error=retryCode(e);console.warn('HHBA_MATCH_PHASE_RETRY_EXHAUSTED',JSON.stringify({phase,error}));return {status:'FAILED',error};}
  // Workflow step outputs from the previous deployment were strings.
  const result=typeof state==='string'?{status:state}:state;
  if(result?.status==='CONTINUE')continue;
  return result?.status?result:{status:'FAILED',error:'AI_BACKGROUND_RESPONSE_INVALID'};
 }
}

// Only return active on an accepted new instance or an existing instance
// that is actually running/queued/waiting. A terminal workflow may have
// persisted valid progress but must not be reported as still working.
export async function scheduleWorkflowInstance(workflow,instance,ticket){
 try{await workflow.create({id:instance,params:{ticket}});return true;}
 catch(e){if(!(e instanceof Error)||!e.message.includes('(instance.already_exists)'))throw e;}
 const existing=await workflow.get(instance);
 const current=await existing.status();
 if(['queued','running','waiting'].includes(current?.status))return true;
 // Only an authorized active ticket reaches this scheduler. Restart a
 // genuinely errored instance; the Pages lease and persisted phase remain
 // authoritative, so restarting the driver does not replay completed work.
 // Never restart a user-terminated, paused, or successfully completed run.
 if(current?.status==='errored'&&typeof existing.restart==='function'){
  try{await existing.restart();return true;}
  catch{
   const refreshed=await existing.status();
   return ['queued','running','waiting'].includes(refreshed?.status);
  }
 }
 return false;
}

 // Registry stores only opaque workflow instance IDs, not tickets, CVs,
 // applicant identities or session tokens. Restart uses the original workflow
 // parameters and Pages independently checks the active authorization.
export async function registerWatchdogInstance(db,instance,now=Date.now()){
 if(!db||! /^[a-f0-9]{64}$/.test(instance))return;
 await db.prepare('INSERT INTO match_watchdog_instances (instance_id,next_check,expires_at) VALUES (?,?,?) ON CONFLICT(instance_id) DO UPDATE SET expires_at=excluded.expires_at').bind(instance,now,now+24*3600000).run();
}
export async function inspectWatchdogInstances(db,workflow,{now=Date.now(),batch=20}={}){
 if(!db||!workflow)return {checked:0,restarted:0};
 // Fair, due-time pagination. A subsequent cron pass handles remaining rows.
 const result=await db.prepare('SELECT instance_id,expires_at FROM match_watchdog_instances WHERE next_check<=? ORDER BY next_check,instance_id LIMIT ?').bind(now,batch).all();
 let checked=0,restarted=0;
 for(const row of result.results||[]){
  const id=row.instance_id;checked++;
  if(!/^[a-f0-9]{64}$/.test(id)||row.expires_at<=now){await db.prepare('DELETE FROM match_watchdog_instances WHERE instance_id=?').bind(id).run();continue;}
  try{
   const instance=await workflow.get(id),state=await instance.status();
   if(state?.status==='errored'&&typeof instance.restart==='function'){
    await instance.restart();restarted++;
   }else if(['complete','terminated','paused'].includes(state?.status)){
    await db.prepare('DELETE FROM match_watchdog_instances WHERE instance_id=?').bind(id).run();continue;
   }
  }catch{/* a temporary platform failure must not discard an authorized instance */}
  await db.prepare('UPDATE match_watchdog_instances SET next_check=? WHERE instance_id=?').bind(now+5*60000,id).run();
 }
 return {checked,restarted};
}
