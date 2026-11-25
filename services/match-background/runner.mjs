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
