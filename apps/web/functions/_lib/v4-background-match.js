// The workflow receives only an opaque capability. No resume, bearer token,
// phone, result, model credential or model prompt leaves Pages for orchestration.
import {matchTaskKey,readMatchTask,saveMatchTask} from './v4-match-checkpoint-storage.js';
import {renewActiveSessionTask,researchTaskKey,taskError} from './v4-session-match-task.js';
import {sha256Hex} from './real-auth.js';

export const backgroundEnabled=(env,request)=>env?.HHBA_V4_BACKGROUND_ENABLED==='1'&&typeof env.HHBA_MATCH_BACKGROUND?.fetch==='function'&&['https://hhba.work','https://www.hhba.work'].includes(new URL(request.url).origin);
const validTicket=t=>typeof t==='string'&&/^[a-f0-9]{64}$/.test(t);
export async function scheduleBackgroundMatch(env,session,task,{diagnostic=false}={}){
 const ticket=await matchTaskKey(env,session.phone,task.id,{scope:'workflow-ticket-v1',session_hash:session.token_hash,generation:task.generation});
 const previous=await readMatchTask(env,ticket);
 if(previous?.kind!=='HHBA_V4_BACKGROUND_TICKET_V1'||Date.now()-(previous.renewed_at||0)>=3600000)await saveMatchTask(env,ticket,{kind:'HHBA_V4_BACKGROUND_TICKET_V1',phone:session.phone,session_hash:session.token_hash,task_id:task.id,generation:task.generation,renewed_at:Date.now()});
 const instance=await sha256Hex('hhba-workflow-instance:'+ticket);
 const r=await env.HHBA_MATCH_BACKGROUND.fetch('https://hhba-internal.invalid/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({instance,ticket})});
 if(!r.ok){const data=await r.json().catch(()=>null);if(data?.terminal_failure===true)return diagnostic?{status:'FAILED',error:typeof data.error==='string'&&/^AI_[A-Z0-9_]{3,90}$/.test(data.error)?data.error:'AI_BACKGROUND_EXECUTION_FAILED'}:'FAILED';throw taskError('AI_BACKGROUND_SCHEDULE_UNAVAILABLE',503);}
 const result=await r.json().catch(()=>null);
 if(result?.ok!==true)throw taskError('AI_BACKGROUND_SCHEDULE_UNAVAILABLE',503);
 return true;
}
// Fall back only to the existing authorized checkpoint driver. No duplicate
// paid work: the same per-task DB lease fences both execution paths.
export async function tryScheduleBackgroundMatch(env,request,session,task,options){
 if(!task||!backgroundEnabled(env,request))return false;
 try{return await scheduleBackgroundMatch(env,session,task,options);}
 catch{console.warn('HHBA_V4_BACKGROUND_SCHEDULE_FALLBACK');return false;}
}
export async function loadBackgroundMatch(env,ticket){
 if(!validTicket(ticket))throw taskError('AI_BACKGROUND_TICKET_INVALID',403);
 const record=await readMatchTask(env,ticket);
 if(record?.kind!=='HHBA_V4_BACKGROUND_TICKET_V1')throw taskError('AI_BACKGROUND_TICKET_INVALID',403);
 const session={phone:record.phone,token_hash:record.session_hash};
 const task=await renewActiveSessionTask(env,session,record.task_id,record.generation);
 if(Date.now()-(record.renewed_at||0)>=3600000){
  // Renew the watchdog only for a freshly authorized active task. Its
  // registry contains no session identifiers, resume data or credentials.
  await saveMatchTask(env,ticket,{...record,renewed_at:Date.now()});
  try{
   const instance=await sha256Hex('hhba-workflow-instance:'+ticket);
   const r=await env.HHBA_MATCH_BACKGROUND.fetch('https://hhba-internal.invalid/renew-watchdog',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({instance})});
   if(!r.ok||(await r.json())?.ok!==true)throw Error('WATCHDOG_RENEW_FAILED');
  }catch{console.warn('HHBA_MATCH_WATCHDOG_RENEW_FAILED');}
 }
 return {session,task,taskKey:await researchTaskKey(env,session,task)};
}
