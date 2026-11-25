import {WorkflowEntrypoint} from 'cloudflare:workers';
import {driveBackgroundMatch} from './runner.mjs';
const hex64=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export class MatchBackgroundWorkflow extends WorkflowEntrypoint{
 async run(event,step){
  if(!hex64(event.payload?.ticket))return {status:'INVALID_TICKET'};
  return driveBackgroundMatch(step,event.payload.ticket,fetch);
 }
}
// Only the Pages service binding may reach this Worker. Deployment must
// disable workers.dev and Preview URLs; no public route is configured.
export default {async fetch(request,env){
 if(new URL(request.url).pathname!=='/start'||request.method!=='POST')return new Response('Not found',{status:404});
 let body;try{body=await request.json();}catch{return new Response('Invalid',{status:400});}
 if(!hex64(body.instance)||!hex64(body.ticket))return new Response('Invalid',{status:400});
 await env.MATCH_WORKFLOW.createBatch([{id:body.instance,params:{ticket:body.ticket}}]);
 return Response.json({ok:true});
}};
