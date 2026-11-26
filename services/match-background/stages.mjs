// Dedicated Workflow instances for each stage; only opaque instance IDs.
export const STAGE_LANES=Object.freeze(['discovery','verification','reporting']);
export const validStageLane=v=>STAGE_LANES.includes(v);
export async function stageWorkflowId(instance,lane){
 if(!/^[a-f0-9]{64}$/.test(instance)||!validStageLane(lane))throw Error('INVALID_STAGE_INSTANCE');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('hhba:v4:stage-instance:'+instance+':'+lane));
 return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
}

export async function startStageWorkflows(workflow,registry,base,ticket,{register,schedule}={}){
 if(!workflow||!registry||typeof register!=='function'||typeof schedule!=='function')return {ok:false};
 // Active legacy Workflow (including recoverable error states) retains the
 // entire generation; a rollout never starts competing paid work.
 try{
  const old=await workflow.get(base),state=await old.status();
  if(['queued','running','waiting','errored'].includes(state?.status)||state?.status==='complete'&&state.output?.status==='RECOVERING')return {ok:true,mode:'legacy'};
 }catch{}
 for(const lane of ['verification','reporting','discovery']){
  const id=await stageWorkflowId(base,lane);
  await register(registry,id);
  const state=await schedule(workflow,id,ticket,{diagnostic:true,lane});
  if(state!==true&&state?.status!=='RECOVERING')throw Error('AI_BACKGROUND_STAGE_SCHEDULE_UNAVAILABLE');
 }
 return {ok:true,mode:'staged'};
}
export async function sendStageEvent(workflow,base,{lane,finish=false}={}){
 if(!workflow||! /^[a-f0-9]{64}$/.test(base)||!finish&&!validStageLane(lane))return {ok:false,delivered:0};
 const stages=finish?STAGE_LANES:[lane];
 let delivered=0;
 for(const name of stages){
  try{
   const id=await stageWorkflowId(base,name),instance=await workflow.get(id);
   await instance.sendEvent({type:'wake_'+name,payload:{done:!!finish}});
   delivered++;
  }catch{console.warn('HHBA_STAGE_WAKE_UNAVAILABLE',name);}
 }
 return {ok:finish||delivered===stages.length,delivered};
}
