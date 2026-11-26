import {WorkflowEntrypoint} from 'cloudflare:workers';
import {driveBackgroundMatch,scheduleWorkflowInstance,registerWatchdogInstance,inspectWatchdogInstances} from './runner.mjs';
import {STAGE_LANES,validStageLane,stageWorkflowId,startStageWorkflows,sendStageEvent} from './stages.mjs';
const hex64=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export class MatchBackgroundWorkflow extends WorkflowEntrypoint{
 async run(event,step){
  if(!hex64(event.payload?.ticket))return {status:'INVALID_TICKET'};
  return driveBackgroundMatch(step,event.payload.ticket,fetch,{lane:event.payload?.lane});
 }
}
// Only the Pages service binding may reach this Worker. Deployment must
// disable workers.dev and Preview URLs; no public route is configured.
export default {async scheduled(event,env){
 const summary=await inspectWatchdogInstances(env.MATCH_REGISTRY,env.MATCH_WORKFLOW);
 console.info('HHBA_MATCH_WATCHDOG',JSON.stringify(summary));
},async fetch(request,env){
 const url=new URL(request.url);
 if(url.origin!=='https://hhba-internal.invalid'||request.method!=='POST')return new Response('Not found',{status:404});
 if(url.pathname==='/watchdog'){
  if(!env.MATCH_REGISTRY)return Response.json({ok:false},{status:503});
  const summary=await inspectWatchdogInstances(env.MATCH_REGISTRY,env.MATCH_WORKFLOW);
  console.info('HHBA_MATCH_WATCHDOG',JSON.stringify(summary));
  return Response.json({ok:true,...summary});
 }
 // Pages calls this only after checking the still-authorized session task.
 if(url.pathname==='/renew-watchdog'){
  if(!env.MATCH_REGISTRY)return Response.json({ok:false},{status:503});
  let body;try{body=await request.json();}catch{return new Response('Invalid',{status:400});}
  if(!hex64(body.instance))return new Response('Invalid',{status:400});
  if(body.staged===true){for(const lane of STAGE_LANES)await registerWatchdogInstance(env.MATCH_REGISTRY,await stageWorkflowId(body.instance,lane));}
  else await registerWatchdogInstance(env.MATCH_REGISTRY,body.instance);
  return Response.json({ok:true});
 }
 if(url.pathname==='/wake'||url.pathname==='/finish'){
   if(!env.MATCH_WORKFLOW)return Response.json({ok:false},{status:503});
   let body;try{body=await request.json();}catch{return new Response('Invalid',{status:400});}
   if(!hex64(body.instance)||url.pathname==='/wake'&&!validStageLane(body.lane))return new Response('Invalid',{status:400});
   const status=await sendStageEvent(env.MATCH_WORKFLOW,body.instance,{lane:body.lane,finish:url.pathname==='/finish'});
   return Response.json(status,{status:status.ok?200:503});
  }
  if(url.pathname!=='/start')return new Response('Not found',{status:404});
 let body;try{body=await request.json();}catch{return new Response('Invalid',{status:400});}
 if(!hex64(body.instance)||!hex64(body.ticket))return new Response('Invalid',{status:400});
 // Do not report a recoverable instance as active unless its watchdog is
 // registered. Pages may fall back to the same leased checkpoint driver.
 if(!env.MATCH_REGISTRY||!env.MATCH_WORKFLOW)return Response.json({ok:false},{status:503});
 if(body.mode==='staged'){
   try{const status=await startStageWorkflows(env.MATCH_WORKFLOW,env.MATCH_REGISTRY,body.instance,body.ticket,{register:registerWatchdogInstance,schedule:scheduleWorkflowInstance});return Response.json(status,{status:status.ok?200:503});}
   catch{await sendStageEvent(env.MATCH_WORKFLOW,body.instance,{finish:true}).catch(()=>{});console.warn('HHBA_STAGE_WORKFLOW_START_FAILED');return Response.json({ok:false},{status:503});}
  }
  try{await registerWatchdogInstance(env.MATCH_REGISTRY,body.instance);}
 catch{console.warn('HHBA_MATCH_WATCHDOG_REGISTER_FAILED');return Response.json({ok:false},{status:503});}
 const active=await scheduleWorkflowInstance(env.MATCH_WORKFLOW,body.instance,body.ticket,{diagnostic:true});
 if(active?.status==='RECOVERING')return Response.json({ok:true,recovering:true,error:active.error});
 if(!active){
  const previous=await env.MATCH_WORKFLOW.get(body.instance),state=await previous.status();
  const safeError=typeof state?.output?.error==='string'&&/^AI_[A-Z0-9_]{3,90}$/.test(state.output.error)?state.output.error:null;
  if(state?.status==='complete'&&['FAILED','STOP'].includes(state.output?.status))return Response.json({ok:false,terminal_failure:true,error:safeError||(state.output.status==='STOP'?'AI_AGENT_CANCELLED':'AI_BACKGROUND_EXECUTION_FAILED')},{status:422});
  if(['terminated','paused','waitingForPause'].includes(state?.status))return Response.json({ok:false,terminal_failure:true,error:state.status==='terminated'?'AI_AGENT_CANCELLED':'AI_BACKGROUND_TASK_PAUSED'},{status:422});
 }
 return Response.json({ok:active===true},{status:active===true?200:409});
}};
