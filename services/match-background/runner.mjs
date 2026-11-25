// Independent driver. The only retained step output is a control status;
// every CV, research result and checkpoint remains in HHBA's private storage.
export async function requestPhase(fetcher,ticket){
 const response=await fetcher('https://hhba.work/api/match-v4/background-step',{method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket})});
 if(!response.ok){
  const body=await response.json().catch(()=>({}));
  if(['AI_AGENT_CANCELLED','AI_BACKGROUND_TICKET_INVALID','AI_CHECKPOINT_EXPIRED'].includes(body.error))return 'STOP';
  if(response.status===409&&body.error==='AI_TASK_IN_PROGRESS'||response.status===429||response.status>=500)throw Error('BACKGROUND_PHASE_RETRY');
  throw Error('BACKGROUND_PHASE_REJECTED');
 }
 // The endpoint deliberately emits no applicant/result data.
 const text=await response.text();
 for(const event of text.split('\n\n')){
  const kind=event.split('\n').find(x=>x.startsWith('event: '))?.slice(7);
  if(kind!=='complete'&&kind!=='failure')continue;
  const line=event.split('\n').find(x=>x.startsWith('data: '));
  if(!line)continue;
  const value=JSON.parse(line.slice(6));
  if(kind==='failure'){
   if(value.error==='AI_AGENT_CANCELLED')return 'STOP';
   if(value.retryable)throw Error('BACKGROUND_PHASE_RETRY');
   return 'FAILED';
  }
  if(value.status==='COMPLETE')return 'COMPLETE';
  if(value.status==='CONTINUE')return 'CONTINUE';
 }
 throw Error('BACKGROUND_PHASE_RETRY');
}
export async function driveBackgroundMatch(step,ticket,fetcher){
 for(let phase=0;;phase++){
  // One durable workflow step per already-checkpointed V4 phase. The retry
  // count is the platform maximum, not a cap on AI searches or model calls.
  const state=await step.do('resume-research-phase-'+phase,{retries:{limit:10000,delay:'15 seconds',backoff:'constant'},timeout:'30 minutes'},()=>requestPhase(fetcher,ticket));
  if(state!=='CONTINUE')return {status:state};
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
