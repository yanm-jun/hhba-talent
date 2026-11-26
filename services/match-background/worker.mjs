import {WorkflowEntrypoint} from 'cloudflare:workers';
import {driveBackgroundMatch,scheduleWorkflowInstance,registerWatchdogInstance,inspectWatchdogInstances} from './runner.mjs';
const hex64=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export class MatchBackgroundWorkflow extends WorkflowEntrypoint{
 async run(event,step){
  if(!hex64(event.payload?.ticket))return {status:'INVALID_TICKET'};
  return driveBackgroundMatch(step,event.payload.ticket,fetch);
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
  await registerWatchdogInstance(env.MATCH_REGISTRY,body.instance);
  return Response.json({ok:true});
 }
 if(url.pathname!=='/start')return new Response('Not found',{status:404});
 let body;try{body=await request.json();}catch{return new Response('Invalid',{status:400});}
 if(!hex64(body.instance)||!hex64(body.ticket))return new Response('Invalid',{status:400});
 const active=await scheduleWorkflowInstance(env.MATCH_WORKFLOW,body.instance,body.ticket);
 if(!active){const previous=await env.MATCH_WORKFLOW.get(body.instance);const state=await previous.status();if(state?.status==='complete'&&state.output?.status==='FAILED')return Response.json({ok:false,terminal_failure:true},{status:422});}
 if(active)try{await registerWatchdogInstance(env.MATCH_REGISTRY,body.instance);}catch{console.warn('HHBA_MATCH_WATCHDOG_REGISTER_FAILED');}
 return Response.json({ok:active},{status:active?200:409});
}};
